// Click-to-dial bridge call via Twilio.
//
// Flow:
//   1. Staff clicks the dial button on a customer file.
//   2. This function looks up the rep's cell from user_roles.phone.
//   3. Twilio dials the rep's cell first. When the rep picks up,
//      the inline TwiML response tells Twilio to dial the customer
//      and bridge the two legs. Caller-ID = TWILIO_PHONE_NUMBER, so
//      the customer never sees the rep's personal number.
//
// V1 caveats:
//   - Recording is NOT enabled. Two-party-consent states (CA, FL,
//     IL, MA, MD, MT, NH, PA, WA + others) require explicit consent
//     before recording. Add a consent prompt + recording flag when
//     we wire that flow.
//   - No off-hours guard. Add a "do-not-disturb" toggle on user_roles
//     before this scales beyond pilot.
//
// Auth: verify_jwt = true. Caller must be platform_admin or
// tenant_staff for the submission's dealership.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { resolveCaller, callerCanActOnTenant } from "../_shared/auth.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

function normalizeE164(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const digits = String(raw).replace(/\D/g, "");
  if (!digits) return null;
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
  if (String(raw).trim().startsWith("+")) return `+${digits}`;
  return null;
}

function escapeXml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const caller = await resolveCaller(req, supabaseUrl, anonKey, serviceKey);
    if (caller.kind !== "platform_admin" && caller.kind !== "tenant_staff") {
      return new Response(
        JSON.stringify({ error: "unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const { submission_id } = await req.json().catch(() => ({}));
    if (!submission_id || typeof submission_id !== "string") {
      return new Response(
        JSON.stringify({ error: "submission_id required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const admin = createClient(supabaseUrl, serviceKey);

    const { data: sub, error: subErr } = await admin
      .from("submissions")
      .select("id, dealership_id, phone, name")
      .eq("id", submission_id)
      .maybeSingle();

    if (subErr || !sub) {
      return new Response(
        JSON.stringify({ error: "submission not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    if (!callerCanActOnTenant(caller, sub.dealership_id)) {
      return new Response(
        JSON.stringify({ error: "forbidden" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Honor the Channels admin toggle. Resolves: location override →
    // tenant default → true. Ask Postgres rather than re-implementing
    // the merge; keeps a single source of truth.
    const { data: enabledRow } = await admin.rpc("channel_enabled", {
      _dealership_id: sub.dealership_id || "default",
      _location_id: null,
      _channel: "click_to_dial",
    });
    const channelEnabled = enabledRow === null || enabledRow === undefined ? true : !!enabledRow;
    if (!channelEnabled) {
      return new Response(
        JSON.stringify({
          error: "channel_disabled",
          message: "Click-to-dial is turned off for this dealership. An admin can re-enable it in Setup → Channels.",
        }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const customerE164 = normalizeE164(sub.phone);
    if (!customerE164) {
      return new Response(
        JSON.stringify({ error: "no_customer_phone", message: "This customer has no phone number on file." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Look up the rep's cell phone + availability flags.
    const { data: roleRow } = await admin
      .from("user_roles")
      .select("phone, sms_notifications_opted_in, click_to_dial_dnd")
      .eq("user_id", caller.userId)
      .not("phone", "is", null)
      .limit(1)
      .maybeSingle();

    const repE164 = normalizeE164(roleRow?.phone);
    if (!repE164) {
      return new Response(
        JSON.stringify({
          error: "no_rep_phone",
          message: "Add your cell phone in Staff & Permissions before using click-to-dial.",
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Honor the rep's DND + quiet-hours window. The SQL helper
    // collapses both signals into a single boolean.
    const { data: repAvailable } = await admin.rpc("click_to_dial_rep_available", {
      _user_id: caller.userId,
    });
    if (repAvailable === false) {
      return new Response(
        JSON.stringify({
          error: "rep_unavailable",
          message: roleRow?.click_to_dial_dnd
            ? "You have do-not-disturb on for click-to-dial. Toggle it off in Staff & Permissions to dial."
            : "You're inside your quiet-hours window. Adjust the window in Staff & Permissions or wait until it ends.",
        }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Tenant-level recording opt-in. When on, we tell Twilio to record
    // the bridge AND prepend a consent disclosure so the customer is
    // notified before recording begins (two-party-consent compliant).
    const { data: tenantRow } = await admin
      .from("dealer_accounts")
      .select("click_to_dial_record_calls")
      .eq("dealership_id", sub.dealership_id || "default")
      .maybeSingle();
    const recordingEnabled = !!tenantRow?.click_to_dial_record_calls;

    const twilioSid = Deno.env.get("TWILIO_ACCOUNT_SID");
    const twilioToken = Deno.env.get("TWILIO_AUTH_TOKEN");
    const twilioPhone = Deno.env.get("TWILIO_PHONE_NUMBER");

    if (!twilioSid || !twilioToken || !twilioPhone) {
      return new Response(
        JSON.stringify({ error: "twilio_not_configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Inline TwiML: when the rep answers, Twilio dials the customer
    // and bridges. callerId on the <Dial> sets what the customer sees.
    //
    // When tenant recording is enabled:
    //   - The rep's leg starts with a brief "this call may be recorded"
    //     line (heard by both parties before bridge connects).
    //   - record="record-from-answer-dual" produces a stereo recording
    //     that starts when the customer picks up. answerOnBridge keeps
    //     the rep's leg unrecorded until the bridge completes.
    //
    // The disclosure plays on the rep's leg via <Say> before the
    // <Dial>; once the customer answers, <Dial answerOnBridge> drops
    // them into the bridged audio. Customer hears recording start as
    // soon as they pick up — within the meaning of "informed before"
    // for two-party-consent jurisdictions.
    const dialAttrs: string[] = [
      `callerId="${escapeXml(twilioPhone)}"`,
      `answerOnBridge="true"`,
      `timeout="25"`,
    ];
    if (recordingEnabled) {
      dialAttrs.push(`record="record-from-answer-dual"`);
    }

    const introLine = recordingEnabled
      ? `Connecting you to ${escapeXml(sub.name || "the customer")}. This call will be recorded for quality and training purposes.`
      : `Connecting you to ${escapeXml(sub.name || "the customer")}.`;

    const twiml =
      `<Response>` +
        `<Say voice="alice">${introLine}</Say>` +
        `<Dial ${dialAttrs.join(" ")}>` +
          `<Number>${escapeXml(customerE164)}</Number>` +
        `</Dial>` +
      `</Response>`;

    const twilioUrl = `https://api.twilio.com/2010-04-01/Accounts/${twilioSid}/Calls.json`;
    const twilioRes = await fetch(twilioUrl, {
      method: "POST",
      headers: {
        Authorization: "Basic " + btoa(`${twilioSid}:${twilioToken}`),
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        To: repE164,
        From: twilioPhone,
        Twiml: twiml,
        Timeout: "25",
      }),
    });
    const twilioData = await twilioRes.json().catch(() => ({}));

    if (!twilioRes.ok) {
      console.error("twilio-click-to-dial: Twilio error", twilioData);
      const message =
        (twilioData as { message?: string })?.message
          || "Twilio rejected the call. Check Twilio account status.";
      return new Response(
        JSON.stringify({ error: "twilio_error", message, detail: twilioData }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const callSid = (twilioData as { sid?: string })?.sid || null;

    // Audit-log the dial attempt to the conversation thread.
    await admin.from("conversation_events").insert({
      submission_id: sub.id,
      dealership_id: sub.dealership_id || "default",
      channel: "voice",
      direction: "outbound",
      actor_type: "staff",
      actor_id: caller.userId,
      actor_label: "Click-to-dial",
      body_text: recordingEnabled
        ? `Bridge call initiated (recorded) — dialing rep cell, then customer.`
        : `Bridge call initiated — dialing rep cell, then customer.`,
      metadata: {
        provider: "twilio",
        call_sid: callSid,
        recording_enabled: recordingEnabled,
        rep_phone_masked: repE164.replace(/(\+\d{1,2})\d+(\d{4})$/, "$1•••$2"),
        customer_phone_masked: customerE164.replace(/(\+\d{1,2})\d+(\d{4})$/, "$1•••$2"),
      },
    });

    return new Response(
      JSON.stringify({ success: true, call_sid: callSid }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    console.error("twilio-click-to-dial error:", e);
    return new Response(
      JSON.stringify({ error: "internal", message: String(e) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
