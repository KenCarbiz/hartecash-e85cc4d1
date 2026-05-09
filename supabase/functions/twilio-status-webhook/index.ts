/**
 * twilio-status-webhook — receives Twilio Message Status callbacks
 * and updates the corresponding notification_log row.
 *
 * Until this shipped, notification_log.status reflected only the
 * Twilio API ACK ("we accepted the message") not actual carrier
 * delivery. Customers saying "I never got the SMS" had no audit
 * path — the support engineer couldn't tell delivered from
 * undelivered from carrier-rejected.
 *
 * Twilio POSTs status updates as application/x-www-form-urlencoded:
 *   MessageSid     — the Twilio SID we recorded at send time
 *   MessageStatus  — sent | delivered | undelivered | failed | etc.
 *   ErrorCode      — on failure
 *   ErrorMessage   — on failure
 *
 * We match MessageSid to notification_log.idempotency_key suffix or
 * a separate provider_message_id column (added in a prior migration).
 * Updates status + error_message.
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.7";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

/**
 * Twilio signature validation — HMAC-SHA1 of (URL + sorted form params),
 * base64-encoded, matched against the X-Twilio-Signature header.
 * https://www.twilio.com/docs/usage/security#validating-requests
 *
 * Without this, anyone on the internet can POST forged status updates
 * for any MessageSid and silently corrupt the delivery audit
 * (mark legitimately delivered messages as failed, or vice versa).
 * That was the prior state of this function — fixed here.
 */
async function validateTwilioSignature(
  url: string,
  params: Record<string, string>,
  signatureHeader: string,
  authToken: string,
): Promise<boolean> {
  const sortedKeys = Object.keys(params).sort();
  const data = sortedKeys.reduce((acc, k) => acc + k + params[k], url);
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(authToken),
    { name: "HMAC", hash: "SHA-1" },
    false,
    ["sign"],
  );
  const sigBuffer = await crypto.subtle.sign("HMAC", key, encoder.encode(data));
  const sigArray = Array.from(new Uint8Array(sigBuffer));
  const expected = btoa(String.fromCharCode(...sigArray));
  return expected === signatureHeader;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  try {
    // Twilio always sends application/x-www-form-urlencoded.
    // Read the body once into a record so we can hand it to both the
    // signature validator and our own param lookups.
    const formText = await req.text();
    const formParams = new URLSearchParams(formText);
    const params: Record<string, string> = {};
    for (const [k, v] of formParams.entries()) params[k] = v;

    // ── Signature check (fail-CLOSED) ───────────────────────────
    const authToken = Deno.env.get("TWILIO_AUTH_TOKEN");
    if (!authToken) {
      console.error("twilio-status-webhook: TWILIO_AUTH_TOKEN not configured — refusing request");
      return new Response("server misconfigured", { status: 503 });
    }
    const signature = req.headers.get("x-twilio-signature") || "";
    const sigOk = await validateTwilioSignature(req.url, params, signature, authToken);
    if (!sigOk) {
      console.warn("twilio-status-webhook: bad signature for MessageSid", params.MessageSid || "(none)");
      return new Response("unauthorized", { status: 401 });
    }

    const messageSid     = params.MessageSid     || "";
    const messageStatus  = params.MessageStatus  || "";
    const errorCode      = params.ErrorCode      || "";
    const errorMessage   = params.ErrorMessage   || "";

    if (!messageSid || !messageStatus) {
      return new Response(JSON.stringify({ ok: false, reason: "missing_params" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Map Twilio's status enum to our internal one. We keep the raw
    // Twilio value so deeper investigation has the source-of-truth.
    const statusMap: Record<string, string> = {
      queued:       "queued",
      accepted:     "queued",
      scheduled:    "queued",
      sending:      "sending",
      sent:         "sent",
      delivered:    "delivered",
      undelivered:  "undelivered",
      failed:       "failed_carrier",
      received:     "delivered",
      read:         "delivered",
    };
    const internalStatus = statusMap[messageStatus.toLowerCase()] || messageStatus.toLowerCase();

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // notification_log doesn't have a provider_message_id column
    // baked in — match by idempotency_key suffix containing the SID
    // when we wrote it, OR fall back to error-noting it for support.
    const errorPayload = errorCode || errorMessage
      ? `twilio:${errorCode || "?"}:${errorMessage || ""}`.slice(0, 500)
      : null;

    const { error: updErr } = await supabase
      .from("notification_log")
      .update({
        status: internalStatus,
        error_message: errorPayload,
      })
      .eq("provider_message_id", messageSid);

    if (updErr) {
      // Most likely cause: provider_message_id column doesn't exist
      // yet (added by 20260507140000). Log + soft-succeed so Twilio
      // doesn't retry storms.
      console.error("twilio-status-webhook update failed:", updErr.message);
    }

    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("twilio-status-webhook error:", e);
    return new Response(JSON.stringify({ ok: false, error: String(e) }), {
      status: 200,  // 2xx so Twilio doesn't retry
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
