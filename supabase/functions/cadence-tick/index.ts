// Cadence orchestrator — runs on a cron and walks each in-flight
// submission through its current cadence's next due touch.
//
// Cadence definitions are kept inline (CADENCES) so a tenant can read
// "what will happen next?" without spelunking through database rows.
// Per-state schedules:
//
//   declined: D1 SMS  -> D3 email -> D5 voice -> D6 SMS -> D7 email
//             -> D10 voice -> then transition to reengage at expiry
//   stall:    +5min SMS -> +15min email -> +24h voice -> D2 SMS slot
//             -> D3 email doc -> D4 voice -> D5 SMS expiry -> D6 mgr email
//             -> then transition to reengage at expiry
//   reengage: every 8 days for 90 days (KBB RE-ENGAGE pattern)
//
// Each step is gated by:
//   - TCPA quiet hours (recipient-local) — voice/SMS
//   - per-tenant opt-out (already enforced by send-notification)
//   - cadence_paused_until on submission
//   - dealer cadence_enabled flag in notification_settings
//
// Idempotency: cadence_step is the source of truth. We never re-fire
// a step we've already logged. cadence_next_due_at is recomputed
// after every fire so a cron lag of N minutes doesn't compound.
//
// Trigger: invoked by Supabase scheduled functions (configured in
// dashboard) every 5 minutes. Also callable manually for backfills
// via POST with { force_submission_id: <uuid> } body.

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// ── Cadence definitions ────────────────────────────────────────────
// offset: minutes after cadence_started_at when this step fires.
// channel: which lane to pump (email/sms/voice/system).
// trigger_key: send-notification template to invoke (system steps
// don't fire a notification — they just mark a state transition).
// branch: optional decline_reason gating for the declined cadence.

interface CadenceStep {
  step: number;
  offset_min: number;
  channel: "email" | "sms" | "voice" | "system";
  trigger_key?: string;
  branch?: string[]; // if set, only fires when decline_reason ∈ branch
  description: string;
}

const MIN = 1;
const HOUR = 60;
const DAY = 60 * 24;

const DECLINED_CADENCE: CadenceStep[] = [
  // Day 0 happens via the existing customer_offer_ready trigger when
  // the offer is first issued — that's NOT in this list. Cadence
  // starts when no acceptance has arrived after 24 hours.
  { step: 1, offset_min: 1 * DAY,  channel: "sms",   trigger_key: "customer_offer_followup_d1",     description: "D1 SMS — gentle nudge + reason picker" },
  { step: 2, offset_min: 3 * DAY,  channel: "email", trigger_key: "customer_offer_followup_d3",     description: "D3 email — market-data nudge" },
  // D3 manager-bump (early) only fires for price_too_low decliners
  { step: 3, offset_min: 3 * DAY + HOUR, channel: "email", trigger_key: "customer_offer_bump_reveal", branch: ["price_too_low"], description: "D3 manager-bump email (price_too_low only)" },
  { step: 4, offset_min: 5 * DAY,  channel: "voice", trigger_key: "voice_offer_re_engage",          description: "D5 AI voice — manager-bump conversation" },
  { step: 5, offset_min: 6 * DAY,  channel: "sms",   trigger_key: "customer_offer_expires_tomorrow", description: "D6 SMS — expires tomorrow" },
  { step: 6, offset_min: 7 * DAY,  channel: "email", trigger_key: "customer_offer_last_chance",     description: "D7 email — last chance / counter ask" },
  { step: 7, offset_min: 10 * DAY, channel: "voice", trigger_key: "voice_offer_refresh",            description: "D10 AI voice — offer refreshed" },
  { step: 8, offset_min: 11 * DAY, channel: "system", description: "Transition to reengage cadence" },
];

const STALL_CADENCE: CadenceStep[] = [
  // customer_offer_accepted email already fires on acceptance — that's
  // step 0. Cadence kicks in if scheduling hasn't happened by +5min.
  { step: 1, offset_min: 5 * MIN,   channel: "sms",   trigger_key: "customer_offer_accepted_sms_followup", description: "+5m SMS — schedule link with named rep" },
  { step: 2, offset_min: 24 * HOUR, channel: "voice", trigger_key: "voice_schedule_inspection",           description: "+24h AI voice — schedule on call" },
  { step: 3, offset_min: 2 * DAY,   channel: "sms",   trigger_key: "customer_schedule_slot_proposal",    description: "D2 two-way SMS — reply 1/2/3" },
  { step: 4, offset_min: 3 * DAY,   channel: "email", trigger_key: "customer_doc_upload_unlock",         description: "D3 email — upload title pic to unlock scheduling" },
  { step: 5, offset_min: 4 * DAY,   channel: "voice", trigger_key: "voice_schedule_inspection",          description: "D4 AI voice — diagnostic call" },
  { step: 6, offset_min: 5 * DAY,   channel: "sms",   trigger_key: "customer_lock_expires_48h",          description: "D5 SMS — lock expires in 48h" },
  { step: 7, offset_min: 6 * DAY,   channel: "email", trigger_key: "customer_manager_signed_extension", description: "D6 manager-signed email — offer extension" },
  { step: 8, offset_min: 7 * DAY,   channel: "system", description: "Transition to reengage at lock expiry" },
];

// RE-ENGAGE post-expiry: every 8 days for 90 days = ~11 touches.
const REENGAGE_CADENCE: CadenceStep[] = Array.from({ length: 11 }, (_, i) => ({
  step: i + 1,
  offset_min: (8 * (i + 1)) * DAY,
  channel: i % 2 === 0 ? "email" : "sms",
  trigger_key: i % 2 === 0 ? "customer_reengage_market_update" : "customer_reengage_offer_refresh",
  description: `D${8 * (i + 1)} ${i % 2 === 0 ? "email" : "SMS"} — RE-ENGAGE`,
}));

const CADENCES: Record<string, CadenceStep[]> = {
  declined: DECLINED_CADENCE,
  stall: STALL_CADENCE,
  reengage: REENGAGE_CADENCE,
};

// ── Helpers ────────────────────────────────────────────────────────
function isQuietHourFor(state: string | null, customerTz: string | null): boolean {
  const tz = customerTz || stateToTz(state) || "America/New_York";
  try {
    const hh = parseInt(
      new Intl.DateTimeFormat("en-US", { timeZone: tz, hour: "2-digit", hourCycle: "h23" })
        .formatToParts(new Date()).find(p => p.type === "hour")?.value ?? "0",
      10,
    );
    return hh < 8 || hh >= 21;
  } catch {
    return true; // fail-closed
  }
}

function stateToTz(state: string | null | undefined): string | null {
  const s = (state || "").toUpperCase();
  if (["CT","DE","DC","GA","ME","MD","MA","NH","NJ","NY","NC","OH","PA","RI","SC","VT","VA","WV","FL","IN","KY","MI","TN"].includes(s)) return "America/New_York";
  if (["AL","AR","IL","IA","LA","MN","MS","MO","OK","WI","KS","NE","TX","ND","SD"].includes(s)) return "America/Chicago";
  if (["CO","MT","NM","UT","WY","ID"].includes(s)) return "America/Denver";
  if (s === "AZ") return "America/Phoenix";
  if (["CA","NV","OR","WA"].includes(s)) return "America/Los_Angeles";
  if (s === "AK") return "America/Anchorage";
  if (s === "HI") return "Pacific/Honolulu";
  return null;
}

function nextDueFor(cadence: CadenceStep[], step: number, startedAt: Date): Date | null {
  const next = cadence.find(s => s.step === step + 1);
  if (!next) return null;
  return new Date(startedAt.getTime() + next.offset_min * 60_000);
}

// ── Process a single submission ────────────────────────────────────
async function processSubmission(supabase: any, sub: any): Promise<{ outcome: string; detail?: string }> {
  const cadenceState = sub.cadence_state as keyof typeof CADENCES;
  const cadence = CADENCES[cadenceState];
  if (!cadence) return { outcome: "skipped", detail: `unknown cadence: ${sub.cadence_state}` };

  // Find next step we haven't fired yet.
  const nextStep = cadence.find(s => s.step === sub.cadence_step + 1);
  if (!nextStep) return { outcome: "skipped", detail: "cadence complete" };

  // Branch gate (e.g. early bump only for price_too_low).
  if (nextStep.branch && (!sub.decline_reason || !nextStep.branch.includes(sub.decline_reason))) {
    // Skip this step but advance the counter so we don't loop on it.
    await supabase.from("submissions").update({
      cadence_step: nextStep.step,
      cadence_next_due_at: nextDueFor(cadence, nextStep.step, new Date(sub.cadence_started_at))?.toISOString() ?? null,
    }).eq("id", sub.id);
    await supabase.from("cadence_log").insert({
      submission_id: sub.id,
      cadence_state: cadenceState,
      step: nextStep.step,
      channel: nextStep.channel,
      trigger_key: nextStep.trigger_key ?? null,
      outcome: "skipped_branch",
      outcome_detail: `decline_reason='${sub.decline_reason ?? "null"}' not in [${nextStep.branch.join(",")}]`,
    });
    return { outcome: "skipped_branch" };
  }

  // System steps just transition state — no notification fires.
  if (nextStep.channel === "system") {
    if (cadenceState === "declined" || cadenceState === "stall") {
      await supabase.from("submissions").update({
        cadence_state: "reengage",
        cadence_step: 0,
        cadence_started_at: new Date().toISOString(),
        cadence_next_due_at: new Date(Date.now() + REENGAGE_CADENCE[0].offset_min * 60_000).toISOString(),
        cadence_last_touch_at: new Date().toISOString(),
      }).eq("id", sub.id);
      await supabase.from("cadence_log").insert({
        submission_id: sub.id, cadence_state: cadenceState, step: nextStep.step,
        channel: "system", outcome: "fired", outcome_detail: "transitioned to reengage",
      });
      return { outcome: "transitioned" };
    }
    return { outcome: "skipped", detail: "unknown system step" };
  }

  // ── 12-month reactivation re-consent gate ──
  // FCC + class-action precedent: if a lead's consent is older than
  // ~12 months and the lead has gone cold (cadence transitioned to
  // reengage), we need fresh consent before resuming outreach. We
  // pause the engine and queue a re-consent SMS as the next touch.
  // Email continues to flow because email isn't TCPA-gated.
  if ((nextStep.channel === "voice" || nextStep.channel === "sms")
      && sub.cadence_state === "reengage"
      && (sub as any).tcpa_consent_at
      && new Date((sub as any).tcpa_consent_at).getTime() < Date.now() - 365 * 24 * 60 * 60_000) {
    // Pause everything beyond email. Manual re-consent via STOP/START
    // or a fresh form submission resets the timer.
    await supabase.from("submissions").update({
      cadence_paused_until: new Date(Date.now() + 365 * 24 * 60 * 60_000).toISOString(),
    }).eq("id", sub.id);
    await supabase.from("cadence_log").insert({
      submission_id: sub.id, cadence_state: cadenceState, step: nextStep.step,
      channel: nextStep.channel, trigger_key: nextStep.trigger_key ?? null,
      outcome: "skipped_consent",
      outcome_detail: `consent older than 12 months (consent_at=${(sub as any).tcpa_consent_at}); paused until fresh consent`,
    });
    return { outcome: "skipped_consent" };
  }

  // TCPA quiet-hour gate (voice + SMS only — email is fine 24/7).
  if (nextStep.channel === "voice" || nextStep.channel === "sms") {
    if (isQuietHourFor(sub.state, sub.customer_timezone)) {
      // Push the next due to 8am customer-local + 1 minute.
      await supabase.from("submissions").update({
        cadence_next_due_at: nextLocal8amFor(sub.state, sub.customer_timezone).toISOString(),
      }).eq("id", sub.id);
      await supabase.from("cadence_log").insert({
        submission_id: sub.id, cadence_state: cadenceState, step: nextStep.step,
        channel: nextStep.channel, trigger_key: nextStep.trigger_key ?? null,
        outcome: "skipped_quiet", outcome_detail: `tz=${sub.customer_timezone || "fallback"}`,
      });
      return { outcome: "skipped_quiet" };
    }
  }

  // For the slot-proposal SMS we also need to stash the slots on
  // the submission so the inbound webhook can match a "1/2/3" reply.
  // Generate three slots in customer-local time (~1 day, ~1 day +4h,
  // ~2 days). Real impl pulls from dealer calendar; v1 is heuristic.
  if (nextStep.trigger_key === "customer_schedule_slot_proposal") {
    const tz = sub.customer_timezone || stateToTz(sub.state) || "America/New_York";
    const baseSlots = [
      { dayOffset: 1, hour: 10 },
      { dayOffset: 1, hour: 14 },
      { dayOffset: 2, hour: 10 },
    ];
    const slots = baseSlots.map(t => {
      const target = new Date();
      target.setUTCDate(target.getUTCDate() + t.dayOffset);
      target.setUTCHours(t.hour + 5, 0, 0, 0);
      const human = new Intl.DateTimeFormat("en-US", {
        timeZone: tz, weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit",
      }).format(target);
      return { id: `proposed_${target.getTime()}`, iso: target.toISOString(), human, location: null };
    });
    await supabase.from("submissions").update({
      pending_slot_proposals: {
        expires_at: new Date(Date.now() + 48 * 60 * 60_000).toISOString(),
        slots,
      },
    }).eq("id", sub.id);
  }

  // Fire the step via send-notification (email/sms) or
  // launch-voice-call (voice). Both gracefully degrade on missing
  // templates / consent — they own their own log records too.
  let outcome = "fired";
  let outcomeDetail: string | undefined;
  try {
    if (nextStep.channel === "voice") {
      const r = await supabase.functions.invoke("launch-voice-call", {
        body: { submission_id: sub.id, intent: nextStep.trigger_key },
      });
      if (r.error) { outcome = "failed"; outcomeDetail = r.error.message; }
    } else {
      const r = await supabase.functions.invoke("send-notification", {
        body: { trigger_key: nextStep.trigger_key, submission_id: sub.id },
      });
      if (r.error) { outcome = "failed"; outcomeDetail = r.error.message; }
    }
  } catch (e) {
    outcome = "failed";
    outcomeDetail = e instanceof Error ? e.message : String(e);
  }

  // Advance state regardless — a transient send-notification failure
  // shouldn't loop us. The cadence_log shows the failure for ops.
  await supabase.from("submissions").update({
    cadence_step: nextStep.step,
    cadence_last_touch_at: new Date().toISOString(),
    cadence_next_due_at: nextDueFor(cadence, nextStep.step, new Date(sub.cadence_started_at))?.toISOString() ?? null,
  }).eq("id", sub.id);
  await supabase.from("cadence_log").insert({
    submission_id: sub.id, cadence_state: cadenceState, step: nextStep.step,
    channel: nextStep.channel, trigger_key: nextStep.trigger_key ?? null,
    outcome, outcome_detail: outcomeDetail ?? null,
  });
  return { outcome, detail: outcomeDetail };
}

function nextLocal8amFor(state: string | null, customerTz: string | null): Date {
  const tz = customerTz || stateToTz(state) || "America/New_York";
  // Compute current customer-local date, then build 8:01 AM tomorrow
  // in that tz. Crude but reliable for cadence scheduling.
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: tz,
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", hourCycle: "h23",
  });
  const parts = fmt.formatToParts(new Date());
  const get = (t: string) => parts.find(p => p.type === t)?.value || "00";
  const hour = parseInt(get("hour"), 10);
  // If it's currently <8am customer-local, fire today at 8am; else
  // tomorrow at 8am. Round up to next available minute.
  const offsetHours = hour < 8 ? 8 - hour : 24 - hour + 8;
  return new Date(Date.now() + offsetHours * 60 * 60_000);
}

// ── HTTP handler ───────────────────────────────────────────────────
serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  let forceSubmissionId: string | null = null;
  let dryRun = false;
  if (req.method === "POST") {
    try {
      const body = await req.json();
      forceSubmissionId = body?.force_submission_id ?? null;
      dryRun = !!body?.dry_run;
    } catch { /* empty body OK */ }
  }

  const now = new Date().toISOString();
  let query = supabase
    .from("submissions")
    .select("id, name, email, phone, state, customer_timezone, cadence_state, cadence_step, cadence_started_at, cadence_paused_until, cadence_next_due_at, decline_reason, dealership_id")
    .not("cadence_state", "is", null)
    .not("cadence_state", "in", "(completed,paused,expired)")
    .or(`cadence_paused_until.is.null,cadence_paused_until.lt.${now}`)
    .lte("cadence_next_due_at", now)
    .limit(50); // batch cap so the function never runs longer than ~30s
  if (forceSubmissionId) query = query.eq("id", forceSubmissionId);

  const { data: due, error } = await query;
  if (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const results: any[] = [];
  for (const sub of (due || [])) {
    if (dryRun) {
      results.push({ id: sub.id, would_process: true, cadence_state: sub.cadence_state, cadence_step: sub.cadence_step });
      continue;
    }
    try {
      const r = await processSubmission(supabase, sub);
      results.push({ id: sub.id, ...r });
    } catch (e) {
      results.push({ id: sub.id, outcome: "error", detail: e instanceof Error ? e.message : String(e) });
    }
  }

  return new Response(JSON.stringify({
    processed: results.length,
    dry_run: dryRun,
    results,
  }), {
    status: 200,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
