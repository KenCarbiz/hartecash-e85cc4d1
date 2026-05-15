// Mark a BDC call task complete and feed the outcome back into the
// cadence engine + submission state.
//
// Outcomes (rep-selected):
//   booked_appointment    → flips submission.progress_status to
//                           'appointment_scheduled' (cadence trigger
//                           transitions cadence_state to 'completed').
//                           Also creates the appointment row.
//   re_quoted             → records the new offer; cadence continues.
//                           If new amount > previous offered_price,
//                           writes offered_price + fires
//                           customer_offer_increased (matches the
//                           SubmissionDetailSheet pattern).
//   customer_pushed_back  → captures rep notes, no state change.
//                           Cadence continues with the next touch.
//   left_voicemail        → schedules ANOTHER voice touch in 48h
//                           (overrides the cadence's next_due_at)
//                           since voicemail-only doesn't count as
//                           a real contact.
//   no_answer             → same as voicemail but 24h backoff.
//   not_interested        → flips progress_status to 'declined' which
//                           cascades to cadence_state='reengage'
//                           with a 7-day cooldown via the bootstrap
//                           trigger.
//   wrong_number          → marks submission with wrong_number flag;
//                           cadence pauses indefinitely.
//
// Auth: standard user JWT — RLS on bdc_call_tasks gates by tenant.

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

interface CompletePayload {
  task_id: string;
  outcome:
    | "booked_appointment"
    | "re_quoted"
    | "customer_pushed_back"
    | "left_voicemail"
    | "no_answer"
    | "not_interested"
    | "wrong_number";
  notes?: string;
  // Outcome-specific fields:
  appointment_iso?: string;     // booked_appointment
  appointment_location?: string;
  re_quoted_amount?: number;    // re_quoted
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "POST only" }), {
      status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const authHeader = req.headers.get("Authorization");
  if (!authHeader) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // User-scoped client so RLS applies (we want the rep's own user_id
  // recorded as completed_by).
  const supabaseUser = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { global: { headers: { Authorization: authHeader } } },
  );
  // Service-role client for the cross-table writes that follow.
  const supabaseSvc = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  let payload: CompletePayload;
  try {
    payload = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON" }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  if (!payload.task_id || !payload.outcome) {
    return new Response(JSON.stringify({ error: "task_id, outcome required" }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Resolve the calling user.
  const { data: { user } } = await supabaseUser.auth.getUser();
  if (!user) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Load the task (RLS-gated — rep can only see their own tenant's tasks).
  const { data: task, error: taskErr } = await supabaseUser
    .from("bdc_call_tasks")
    .select("id, submission_id, dealership_id, status, intent")
    .eq("id", payload.task_id)
    .maybeSingle();
  if (taskErr || !task) {
    return new Response(JSON.stringify({ error: "Task not found or not accessible" }), {
      status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  if ((task as any).status === "completed" || (task as any).status === "expired") {
    return new Response(JSON.stringify({ error: `Task already ${(task as any).status}` }), {
      status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Mark task complete.
  await supabaseSvc.from("bdc_call_tasks").update({
    status: "completed",
    outcome: payload.outcome,
    outcome_notes: payload.notes || null,
    completed_at: new Date().toISOString(),
    completed_by: user.id,
  }).eq("id", payload.task_id);

  // Outcome-specific side effects.
  const subId = (task as any).submission_id;

  switch (payload.outcome) {
    case "booked_appointment": {
      const when = payload.appointment_iso ? new Date(payload.appointment_iso) : null;
      if (when) {
        await supabaseSvc.from("appointments").insert({
          submission_id: subId,
          dealership_id: (task as any).dealership_id,
          preferred_date: when.toISOString().slice(0, 10),
          preferred_time: when.toISOString().slice(11, 16),
          location: payload.appointment_location || null,
          status: "scheduled",
          source: "bdc_call",
        } as any).catch((e: unknown) => console.warn("appt insert failed:", e));
      }
      // Flip submission status — bootstrap trigger does the cadence transition.
      await supabaseSvc.from("submissions").update({
        progress_status: "appointment_scheduled",
      }).eq("id", subId);
      break;
    }
    case "re_quoted": {
      if (typeof payload.re_quoted_amount === "number" && payload.re_quoted_amount > 0) {
        const { data: sub } = await supabaseSvc
          .from("submissions")
          .select("offered_price, dealership_id")
          .eq("id", subId)
          .maybeSingle();
        const previousOffer = (sub as any)?.offered_price ?? null;
        await supabaseSvc.from("submissions").update({
          offered_price: payload.re_quoted_amount,
        }).eq("id", subId);
        // Fire customer_offer_increased only when the new amount is
        // higher (matches AppraisalTool + SubmissionDetailSheet behavior).
        if (previousOffer && payload.re_quoted_amount > previousOffer) {
          await supabaseSvc.functions.invoke("send-notification", {
            body: { trigger_key: "customer_offer_increased", submission_id: subId },
          }).catch((e: unknown) => console.warn("offer_increased notify failed:", e));
        }
      }
      break;
    }
    case "left_voicemail":
    case "no_answer": {
      // Schedule another voice touch — voicemail-only doesn't count as
      // contact, so the cadence shouldn't move past this step.
      const backoffHours = payload.outcome === "left_voicemail" ? 48 : 24;
      const next = new Date(Date.now() + backoffHours * 60 * 60_000).toISOString();
      await supabaseSvc.from("submissions").update({
        cadence_next_due_at: next,
        // Roll the step back so the SAME voice touch fires again.
        // We do this by decrementing cadence_step by 1.
        cadence_step: Math.max(0, ((await supabaseSvc.from("submissions").select("cadence_step").eq("id", subId).maybeSingle()).data as any)?.cadence_step - 1 || 0),
      }).eq("id", subId);
      break;
    }
    case "not_interested": {
      // Triggers the bootstrap rule: declined → reengage with 7d cooldown.
      await supabaseSvc.from("submissions").update({
        progress_status: "declined",
      }).eq("id", subId);
      break;
    }
    case "wrong_number": {
      // Pause cadence indefinitely. Staff can manually fix the phone
      // number and unpause — that's a separate workflow.
      await supabaseSvc.from("submissions").update({
        cadence_paused_until: new Date(Date.now() + 365 * 24 * 60 * 60_000).toISOString(),
      }).eq("id", subId);
      break;
    }
    case "customer_pushed_back":
      // No state change — cadence continues with the next scheduled touch.
      break;
  }

  // Audit trail.
  await supabaseSvc.from("activity_log").insert({
    submission_id: subId,
    action: "BDC Call Completed",
    new_value: payload.outcome,
    notes: payload.notes || null,
    performed_by: user.email || user.id,
  } as any).catch((e) => console.warn("[complete-bdc-call] activity_log insert failed:", e));

  return new Response(JSON.stringify({ ok: true, task_id: payload.task_id, outcome: payload.outcome }), {
    status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
