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
//   2. Pause cadence so SMS/email don't fire mid-handoff.
//   3. Resolve the on-call rep phone (assigned rep → site fallback)
//      and return Bland's structured transfer instruction so Bland
//      bridges the live call from the customer to that number.
//   4. If no rep can be reached: skip the transfer instruction, send
//      a "missed transfer" SMS alert to the on-call queue, and return
//      a callback-promise agent_message instead so the AI doesn't dead-
//      air the customer.
//
// Bland response contract (per Bland tool/webhook spec):
//   - `agent_message`   — verbatim text the AI reads aloud first.
//   - `transfer_to`     — E.164 phone number Bland will dial + bridge
//                         the live call to. Presence of this field is
//                         what makes Bland actually transfer (vs just
//                         continuing the conversation).
//   - `transfer_list`   — alternate format; included for forward-compat
//                         with Bland's newer multi-target transfers.
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

// Normalize a phone string to E.164 (+1XXXXXXXXXX for US).
// Bland will refuse a transfer instruction without the leading + and
// country code — silently continuing the AI conversation instead of
// bridging — so we have to guarantee the format here, not at the edge.
function toE164(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const digits = String(raw).replace(/\D/g, "");
  if (!digits) return null;
  if (raw.trim().startsWith("+")) return "+" + digits;
  if (digits.length === 10) return "+1" + digits;
  if (digits.length === 11 && digits.startsWith("1")) return "+" + digits;
  // Other lengths — return as-is with leading + so Bland's own validator
  // can produce a useful error.
  return "+" + digits;
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
  let repPhoneRaw: string | null = null;
  let repName = "the team";
  if (sub.assigned_rep_email) {
    const { data: rep } = await supabase
      .from("user_roles")
      .select("phone, display_name")
      .eq("email", sub.assigned_rep_email)
      .maybeSingle();
    if (rep) {
      repPhoneRaw = (rep as { phone?: string | null }).phone || null;
      repName = ((rep as { display_name?: string | null }).display_name
        || sub.assigned_rep_email.split("@")[0]).split(/[\s.]/)[0];
    }
  }
  if (!repPhoneRaw) {
    const { data: site } = await supabase
      .from("site_config")
      .select("phone, dealership_name")
      .eq("dealership_id", sub.dealership_id)
      .maybeSingle();
    repPhoneRaw = (site as { phone?: string | null } | null)?.phone || null;
  }
  const repPhoneE164 = toE164(repPhoneRaw);
  const transferAvailable = !!repPhoneE164;

  // Persist a structured transfer record so the rep dashboard can
  // show "AI just transferred a call to you" with full context.
  await supabase.from("activity_log").insert({
    submission_id: sub.id,
    action: transferAvailable ? "AI Voice Warm Transfer" : "AI Voice Transfer Unreachable",
    new_value: payload.trigger,
    notes: JSON.stringify({
      summary: payload.intent_summary,
      quote: payload.customer_quote ?? null,
      tried: payload.attempted_actions ?? [],
      competitor_offer: payload.competitor_offer ?? null,
      preferred_callback: payload.preferred_callback_time ?? null,
      bland_call_id: payload.call_id ?? null,
      rep_phone_resolved: repPhoneE164,
      rep_name: repName,
      transfer_attempted: transferAvailable,
    }),
    performed_by: "AI Voice Agent",
  } as never).catch((e: unknown) => console.warn("activity_log insert failed:", e));

  // Pause cadence so we don't fire SMS/email at the customer mid-handoff.
  await supabase.from("submissions").update({
    cadence_paused_until: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
  }).eq("id", sub.id);

  // Ping the BDC rep via SMS — both as a heads-up before Bland bridges
  // and as the primary alert when no transfer is possible.
  const vehicleStr = [sub.vehicle_year, sub.vehicle_make, sub.vehicle_model].filter(Boolean).join(" ");
  const customerStr = sub.name || sub.phone || "Customer";
  const triggerLabel = ({
    explicit_request: "asked for a person",
    price_negotiation: "wants to negotiate price",
    lien_complication: "has a lien/title issue",
    frustration: "sounds frustrated",
    competitor_quote: `disclosed competitor offer: $${payload.competitor_offer ?? "?"}`,
  } as Record<string, string>)[payload.trigger] || payload.trigger;

  if (repPhoneE164) {
    const smsBody = transferAvailable
      ? `🚨 AI is transferring NOW: ${customerStr} (${vehicleStr}) ${triggerLabel}. ${payload.intent_summary} — pick up or call back ${sub.phone}`
      : `🚨 AI transfer (no bridge): ${customerStr} (${vehicleStr}) ${triggerLabel}. ${payload.intent_summary} — call back ${sub.phone}`;
    await supabase.functions.invoke("send-notification", {
      body: {
        trigger_key: "ai_warm_transfer_alert",
        submission_id: sub.id,
        recipient_phone: repPhoneE164,
        custom_body: smsBody,
      },
    }).catch((e: unknown) => console.warn("warm-transfer SMS alert failed:", e));
  } else {
    // No rep phone at all — escalate via the on-call email channel so
    // the BDC manager sees the unreachable transfer and can decide who
    // covers. Falls back silently if the trigger key isn't configured.
    await supabase.functions.invoke("send-notification", {
      body: {
        trigger_key: "ai_warm_transfer_unreachable",
        submission_id: sub.id,
        custom_body: `AI tried to warm-transfer ${customerStr} (${vehicleStr}) — ${triggerLabel}. No rep phone resolved. Customer #: ${sub.phone}. Summary: ${payload.intent_summary}`,
      },
    }).catch((e: unknown) => console.warn("warm-transfer unreachable alert failed:", e));
  }

  // ── Bland response ─────────────────────────────────────────────────
  // When transfer is available, include the Bland-recognized fields so
  // Bland actually bridges the live call. When unavailable, omit them
  // and read a callback-promise message so the AI doesn't dead-air.
  const firstName = sub.name?.split(" ")[0] || "there";

  if (transferAvailable) {
    return new Response(JSON.stringify({
      ok: true,
      rep_phone: repPhoneE164,
      rep_name: repName,
      // Bland reads `agent_message` aloud verbatim before the transfer.
      agent_message: `OK ${firstName}, I'm transferring you to ${repName} right now — please hold.`,
      // Bland's transfer instruction. Either field name is supported by
      // Bland's webhook tool spec across versions; including both is
      // safer than guessing which deployment a tenant is on.
      transfer_to: repPhoneE164,
      transfer_list: { [repName]: repPhoneE164 },
    }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Fallback path — no transfer instruction, callback promise instead.
  return new Response(JSON.stringify({
    ok: true,
    rep_phone: null,
    rep_name: repName,
    transfer_attempted: false,
    transfer_failure_reason: "no_rep_phone_resolved",
    agent_message:
      `OK ${firstName}, the team isn't reachable on a live line right now. ` +
      `I've flagged this as a priority — they'll call you back within an hour at this number. Does that work?`,
  }), {
    status: 200,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
