// Bland.AI warm-transfer endpoint.
//
// The voice agent calls this when it needs to hand the conversation
// to a human BDC rep. Triggers, defined in the agent prompt:
//   - explicit: "I want to talk to a person"
//   - price negotiation beyond the authorized bump band
//   - lien/title complications the agent can't resolve
//   - any frustration / complaint signal
//   - competitor quote disclosed
//
// We:
//   1. Persist a structured "transfer summary" to the submission so
//      the rep sees full context the moment they pick up.
//   2. Notify the on-call BDC rep via SMS + Slack with a single-tap
//      callback link.
//   3. Mark the cadence_paused_until = now+24h so the engine doesn't
//      re-call them while a human is actively handling.
//   4. Return a phone number the agent reads aloud: "I'm transferring
//      you to {rep_name} right now — please hold."
//
// Auth: shared X-Webhook-Secret (BLAND_WEBHOOK_SECRET), same as the
// other Bland integrations. No JWT.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-webhook-secret",
};

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

interface WarmTransferPayload {
  submission_id: string;
  call_id?: string;            // Bland's internal call id, for cross-ref
  trigger: string;             // "explicit_request" | "price_negotiation" | "lien_complication" | "frustration" | "competitor_quote" | "other"
  intent_summary: string;      // 1-2 sentences from the agent
  customer_quote?: string;     // verbatim what the customer said (last turn)
  attempted_actions?: string[]; // what the agent already tried
  competitor_offer?: number;   // if they disclosed a number
  preferred_callback_time?: string; // if customer asked for a callback
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "POST only" }), {
      status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // ── Auth ──
  const expectedSecret = Deno.env.get("BLAND_WEBHOOK_SECRET");
  if (!expectedSecret) {
    return new Response(JSON.stringify({ error: "Webhook secret not configured" }), {
      status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  const url = new URL(req.url);
  const providedSecret = req.headers.get("x-webhook-secret") || url.searchParams.get("secret") || "";
  if (!timingSafeEqual(providedSecret, expectedSecret)) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  let payload: WarmTransferPayload;
  try {
    payload = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON" }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  if (!payload.submission_id || !payload.trigger || !payload.intent_summary) {
    return new Response(JSON.stringify({ error: "submission_id, trigger, intent_summary required" }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  // Pull submission + assigned rep + dealer phone.
  const { data: sub } = await supabase
    .from("submissions")
    .select("id, name, phone, vehicle_year, vehicle_make, vehicle_model, offered_price, dealership_id, assigned_rep_email, store_location_id")
    .eq("id", payload.submission_id)
    .maybeSingle();
  if (!sub) {
    return new Response(JSON.stringify({ error: "submission not found" }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" }, // 200 to prevent Bland retries
    });
  }

  // Resolve rep phone (assigned rep first, then BDC fallback).
  let repPhone: string | null = null;
  let repName = "the team";
  if (sub.assigned_rep_email) {
    const { data: rep } = await supabase
      .from("user_roles")
      .select("phone, display_name")
      .eq("email", sub.assigned_rep_email)
      .maybeSingle();
    if (rep) {
      repPhone = (rep as any).phone || null;
      repName = ((rep as any).display_name || sub.assigned_rep_email.split("@")[0]).split(/[\s.]/)[0];
    }
  }
  if (!repPhone) {
    const { data: site } = await supabase
      .from("site_config")
      .select("phone, dealership_name")
      .eq("dealership_id", sub.dealership_id)
      .maybeSingle();
    repPhone = (site as any)?.phone || null;
  }

  // Persist a structured transfer record so the rep dashboard can
  // show "AI just transferred a call to you" with full context.
  await supabase.from("activity_log").insert({
    submission_id: sub.id,
    action: "AI Voice Warm Transfer",
    new_value: payload.trigger,
    notes: JSON.stringify({
      summary: payload.intent_summary,
      quote: payload.customer_quote ?? null,
      tried: payload.attempted_actions ?? [],
      competitor_offer: payload.competitor_offer ?? null,
      preferred_callback: payload.preferred_callback_time ?? null,
      bland_call_id: payload.call_id ?? null,
    }),
    performed_by: "AI Voice Agent",
  } as any).catch((e: unknown) => console.warn("activity_log insert failed:", e));

  // Pause cadence so we don't fire SMS/email at the customer mid-handoff.
  await supabase.from("submissions").update({
    cadence_paused_until: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
  }).eq("id", sub.id);

  // Ping the BDC rep via SMS so they pick up live or call back fast.
  // Reuses send-notification infrastructure for tenant template + log.
  if (repPhone) {
    const vehicleStr = [sub.vehicle_year, sub.vehicle_make, sub.vehicle_model].filter(Boolean).join(" ");
    const customerStr = sub.name || sub.phone || "Customer";
    const triggerLabel = ({
      explicit_request: "asked for a person",
      price_negotiation: "wants to negotiate price",
      lien_complication: "has a lien/title issue",
      frustration: "sounds frustrated",
      competitor_quote: `disclosed competitor offer: $${payload.competitor_offer ?? "?"}`,
    } as Record<string, string>)[payload.trigger] || payload.trigger;

    const smsBody = `🚨 AI transfer: ${customerStr} (${vehicleStr}) ${triggerLabel}. ${payload.intent_summary} — call back: ${sub.phone}`;
    await supabase.functions.invoke("send-notification", {
      body: {
        trigger_key: "ai_warm_transfer_alert",
        submission_id: sub.id,
        recipient_phone: repPhone,
        custom_body: smsBody,
      },
    }).catch((e: unknown) => console.warn("warm-transfer SMS alert failed:", e));
  }

  return new Response(JSON.stringify({
    ok: true,
    rep_phone: repPhone,
    rep_name: repName,
    // Bland reads `agent_message` aloud verbatim before the transfer.
    agent_message: repPhone
      ? `OK ${sub.name?.split(" ")[0] || "there"}, I'm transferring you to ${repName} right now — please hold.`
      : `OK ${sub.name?.split(" ")[0] || "there"}, the team isn't reachable right now. They'll call you back within an hour at this number — sound good?`,
  }), {
    status: 200,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
