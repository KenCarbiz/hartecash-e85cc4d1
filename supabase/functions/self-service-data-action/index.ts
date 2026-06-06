// self-service-data-action — lets a customer exercise their right to
// ACCESS (export) or DELETE their own data instantly from the website,
// gated by an SMS one-time code so only the person who controls the phone
// number on file can do it.
//
// Why an edge function (not a direct RPC call from the browser):
// request_customer_data_action() returns a fulfillment token, and
// export_customer_data()/purge_customer_data() are anon-callable with only
// that token. If the browser could mint and read the token, anyone who knew
// a phone/email could export or delete someone else's data. This function
// keeps the token entirely server-side and only ever runs after the caller
// has proven control of the phone via the existing OTP challenge. The token
// never leaves the server.
//
// Flow:
//   1. Browser calls send-customer-otp { phone } → gets challenge_id + SMS.
//   2. Customer enters the code; browser calls this fn { challenge_id, code,
//      kind }.
//   3. We verify the code against customer_otp_codes (same hash check as
//      verify-customer-otp), then mint a token and run the export/purge with
//      the service role.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { checkRateLimit, sha256Hex } from "../_shared/rateLimit.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const MAX_ATTEMPTS = 5;

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { challenge_id, code, kind, dealership_id } = await req.json().catch(() => ({}));
    const cleanCode = typeof code === "string" ? code.replace(/\D/g, "") : "";
    const action = kind === "delete" ? "delete" : kind === "export" ? "export" : null;
    const tenantId = typeof dealership_id === "string" && dealership_id.trim() ? dealership_id.trim() : null;

    if (!challenge_id || cleanCode.length !== 6 || !action) {
      return json({ error: "invalid_input" }, 400);
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Per-IP rate limit — defence against code-guessing / abuse.
    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
    const ipHash = await sha256Hex(ip);
    const okIp = await checkRateLimit(supabase, {
      key: `selfservice_ip:${ipHash}`,
      windowSeconds: 60 * 60,
      maxHits: 30,
    });
    if (!okIp) return json({ error: "rate_limited" }, 429);

    // ── Verify the OTP (mirrors verify-customer-otp) ────────────────
    const { data: row, error: selErr } = await supabase
      .from("customer_otp_codes")
      // select("*") so purpose/consumed_at are read when present without
      // breaking if the migration hasn't been applied yet.
      .select("*")
      .eq("challenge_id", challenge_id)
      .maybeSingle();

    if (selErr) {
      console.error("self-service-data-action select failed:", selErr);
      return json({ error: "lookup_failed" }, 500);
    }
    if (!row) return json({ error: "not_found" }, 404);
    if (new Date(row.expires_at).getTime() < Date.now()) {
      return json({ error: "expired" }, 410);
    }

    // Purpose-binding: when the column exists, a code issued for the sell flow
    // (or anything other than data_rights) must NOT authorize export/delete.
    if (row.purpose !== undefined && row.purpose !== "data_rights") {
      return json({ error: "wrong_purpose" }, 403);
    }
    // Single-use: a data_rights code can't be replayed once consumed.
    if (row.consumed_at) {
      return json({ error: "already_used" }, 409);
    }
    // ALWAYS verify the submitted code — never trust a pre-verified challenge
    // (that was the cross-flow replay hole). attempts cap + hash compare.
    if (row.attempts >= MAX_ATTEMPTS) return json({ error: "too_many_attempts" }, 429);
    const candidate = await sha256Hex(cleanCode);
    if (candidate !== row.code_hash) {
      await supabase
        .from("customer_otp_codes")
        .update({ attempts: row.attempts + 1 })
        .eq("id", row.id);
      return json(
        { error: "wrong_code", attempts_remaining: Math.max(0, MAX_ATTEMPTS - (row.attempts + 1)) },
        401,
      );
    }
    // Mark verified + consumed (single-use). Tolerate consumed_at not existing
    // yet by retrying with just verified_at.
    {
      const nowIso = new Date().toISOString();
      const { error: upErr } = await supabase
        .from("customer_otp_codes")
        .update({ verified_at: nowIso, consumed_at: nowIso })
        .eq("id", row.id);
      if (upErr && /consumed_at/i.test(upErr.message || "")) {
        await supabase
          .from("customer_otp_codes")
          .update({ verified_at: nowIso })
          .eq("id", row.id);
      }
    }

    const phone = row.phone_e164 as string;

    // ── Mint a server-side fulfillment token, then run the action ───
    // Scope to the tenant the customer is on so the action only ever touches
    // that dealership's rows. Tolerate the pre-migration 3-arg signature.
    let reqRes: unknown = null;
    let reqErr: { message?: string } | null = null;
    ({ data: reqRes, error: reqErr } = await supabase.rpc(
      "request_customer_data_action",
      { _phone: phone, _email: null, _kind: action, _dealership_id: tenantId },
    ));
    if (reqErr && /_dealership_id|function|argument|schema cache/i.test(reqErr.message || "")) {
      ({ data: reqRes, error: reqErr } = await supabase.rpc(
        "request_customer_data_action",
        { _phone: phone, _email: null, _kind: action },
      ));
    }
    if (reqErr) {
      console.error("request_customer_data_action failed:", reqErr);
      return json({ error: "request_failed" }, 500);
    }

    // No data on file → return a consistent "done" envelope without
    // confirming or denying (the RPC withholds the token in that case).
    const token = (reqRes as { request_token?: string } | null)?.request_token;
    if (!token) {
      return json({ ok: true, kind: action, result: action === "export" ? { submissions: [] } : { submissions_purged: 0 } });
    }

    if (action === "export") {
      const { data: exp, error: expErr } = await supabase.rpc("export_customer_data", { _token: token });
      if (expErr) {
        console.error("export_customer_data failed:", expErr);
        return json({ error: "export_failed" }, 500);
      }
      return json({ ok: true, kind: "export", result: exp });
    }

    // delete — purge_customer_data anonymizes the DB rows (name/phone/email/
    // vin, transcripts, recordings, memory). Stored files (photos/docs) are
    // swept by the retention/purge-queue worker on its schedule.
    const { data: purge, error: purgeErr } = await supabase.rpc("purge_customer_data", { _token: token });
    if (purgeErr) {
      console.error("purge_customer_data failed:", purgeErr);
      return json({ error: "delete_failed" }, 500);
    }

    return json({ ok: true, kind: "delete", result: purge });
  } catch (err) {
    console.error("self-service-data-action threw:", err);
    return json({ error: "internal" }, 500);
  }
});
