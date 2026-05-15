// Sends a 6-digit SMS verification code to the customer's phone for
// the /sell flow. Stores a SHA-256 hash of the code (never the code
// itself) and returns a short-lived challenge_id the front-end uses
// to verify. Rate-limited per phone number and per client IP so we
// don't let anyone burn Twilio credit.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { checkRateLimit, sha256Hex } from "../_shared/rateLimit.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const OTP_TTL_SECONDS = 10 * 60;

function normalizeE164(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const digits = String(raw).replace(/\D/g, "");
  if (!digits) return null;
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
  if (String(raw).trim().startsWith("+") && digits.length >= 10) return `+${digits}`;
  return null;
}

function randomCode(): string {
  const arr = new Uint32Array(1);
  crypto.getRandomValues(arr);
  return String(arr[0] % 1_000_000).padStart(6, "0");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { phone, dealership_name } = await req.json().catch(() => ({}));
    const e164 = normalizeE164(phone);
    if (!e164) {
      return new Response(
        JSON.stringify({ error: "invalid_phone" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Rate limits — defence in depth. Per phone: 5/hour. Per IP: 20/hour.
    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
    const ipHash = await sha256Hex(ip);
    const okPhone = await checkRateLimit(supabase, {
      key: `otp_send_phone:${e164}`,
      windowSeconds: 60 * 60,
      maxHits: 5,
    });
    const okIp = await checkRateLimit(supabase, {
      key: `otp_send_ip:${ipHash}`,
      windowSeconds: 60 * 60,
      maxHits: 20,
    });
    if (!okPhone || !okIp) {
      return new Response(
        JSON.stringify({ error: "rate_limited" }),
        { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const code = randomCode();
    const codeHash = await sha256Hex(code);
    const expiresAt = new Date(Date.now() + OTP_TTL_SECONDS * 1000).toISOString();

    const { data: row, error: insErr } = await supabase
      .from("customer_otp_codes")
      .insert({
        phone_e164: e164,
        code_hash: codeHash,
        expires_at: expiresAt,
      })
      .select("challenge_id")
      .single();

    if (insErr || !row) {
      console.error("send-customer-otp insert failed:", insErr);
      return new Response(
        JSON.stringify({ error: "store_failed" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const accountSid = Deno.env.get("TWILIO_ACCOUNT_SID");
    const authToken = Deno.env.get("TWILIO_AUTH_TOKEN");
    const fromNumber = Deno.env.get("TWILIO_PHONE_NUMBER");

    const brand = (dealership_name || "your dealer").toString().slice(0, 40);
    const body = `${brand}: your verification code is ${code}. Expires in 10 minutes.`;

    if (accountSid && authToken && fromNumber) {
      const twilioRes = await fetch(
        `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`,
        {
          method: "POST",
          headers: {
            Authorization: "Basic " + btoa(`${accountSid}:${authToken}`),
            "Content-Type": "application/x-www-form-urlencoded",
          },
          body: new URLSearchParams({ To: e164, From: fromNumber, Body: body }).toString(),
        },
      );
      if (!twilioRes.ok) {
        const txt = await twilioRes.text().catch(() => "");
        console.error("Twilio send failed:", twilioRes.status, txt);
        return new Response(
          JSON.stringify({ error: "send_failed" }),
          { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
    } else {
      // Demo / preview mode — log the code instead of failing the flow so
      // we can dev-test without Twilio creds. Never returned to the client.
      console.warn(`[send-customer-otp] Twilio not configured — code for ${e164}: ${code}`);
    }

    return new Response(
      JSON.stringify({ challenge_id: row.challenge_id, ttl_seconds: OTP_TTL_SECONDS }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    console.error("send-customer-otp threw:", err);
    return new Response(
      JSON.stringify({ error: "internal" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
