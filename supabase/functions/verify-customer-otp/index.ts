// Verifies the 6-digit code the customer typed against the SHA-256
// hash stored by send-customer-otp. On success returns the verified
// phone (E.164) so the front-end can write it onto the submission.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { checkRateLimit, sha256Hex } from "../_shared/rateLimit.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const MAX_ATTEMPTS = 5;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { challenge_id, code } = await req.json().catch(() => ({}));
    const cleanCode = typeof code === "string" ? code.replace(/\D/g, "") : "";
    if (!challenge_id || cleanCode.length !== 6) {
      return new Response(
        JSON.stringify({ error: "invalid_input" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
    const ipHash = await sha256Hex(ip);
    const okIp = await checkRateLimit(supabase, {
      key: `otp_verify_ip:${ipHash}`,
      windowSeconds: 60 * 60,
      maxHits: 60,
    });
    if (!okIp) {
      return new Response(
        JSON.stringify({ error: "rate_limited" }),
        { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const { data: row, error: selErr } = await supabase
      .from("customer_otp_codes")
      .select("id, phone_e164, code_hash, attempts, verified_at, expires_at")
      .eq("challenge_id", challenge_id)
      .maybeSingle();

    if (selErr) {
      console.error("verify-customer-otp select failed:", selErr);
      return new Response(
        JSON.stringify({ error: "lookup_failed" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }
    if (!row) {
      return new Response(
        JSON.stringify({ error: "not_found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }
    if (row.verified_at) {
      return new Response(
        JSON.stringify({ ok: true, phone: row.phone_e164 }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }
    if (new Date(row.expires_at).getTime() < Date.now()) {
      return new Response(
        JSON.stringify({ error: "expired" }),
        { status: 410, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }
    if (row.attempts >= MAX_ATTEMPTS) {
      return new Response(
        JSON.stringify({ error: "too_many_attempts" }),
        { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const candidate = await sha256Hex(cleanCode);
    const matches = candidate === row.code_hash;

    if (!matches) {
      await supabase
        .from("customer_otp_codes")
        .update({ attempts: row.attempts + 1 })
        .eq("id", row.id);
      return new Response(
        JSON.stringify({ error: "wrong_code", attempts_remaining: Math.max(0, MAX_ATTEMPTS - (row.attempts + 1)) }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    await supabase
      .from("customer_otp_codes")
      .update({ verified_at: new Date().toISOString() })
      .eq("id", row.id);

    return new Response(
      JSON.stringify({ ok: true, phone: row.phone_e164 }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    console.error("verify-customer-otp threw:", err);
    return new Response(
      JSON.stringify({ error: "internal" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
