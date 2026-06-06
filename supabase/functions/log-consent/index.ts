// log-consent — server-side consent recorder. The browser can't see its
// own public IP, so consent logging is routed through this function, which
// reads the client IP from x-forwarded-for and writes the consent_log row
// (with ip_address + user_agent) using the service role.
//
// TCPA / state privacy proof is strongest when it captures WHO consented,
// to WHAT text/version, WHEN, and from WHERE (IP + user agent). The client
// builds the versioned text; this function stamps the network identifiers.
//
// Anon-callable (verify_jwt=false): customers have no auth session. The
// consent_log INSERT policy already allows anonymous inserts; using the
// service role here only lets us also record the IP the caller can't supply.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const body = await req.json().catch(() => ({}));
    if (!body?.consent_text || !body?.form_source) {
      return json({ error: "invalid_input" }, 400);
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // First hop in x-forwarded-for is the real client; fall back to other
    // common proxy headers. The browser calls this directly, so the
    // user-agent header is the customer's actual UA.
    const ip =
      req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      req.headers.get("cf-connecting-ip") ||
      req.headers.get("x-real-ip") ||
      null;
    const ua = req.headers.get("user-agent") || body.user_agent || null;

    const { error } = await supabase.from("consent_log").insert({
      customer_name: body.customer_name ?? null,
      customer_phone: body.customer_phone ?? null,
      customer_email: body.customer_email ?? null,
      consent_type: body.consent_type ?? "sms_calls_email",
      consent_text: body.consent_text,
      consent_version: body.consent_version ?? null,
      form_source: body.form_source,
      submission_token: body.submission_token ?? null,
      user_agent: ua,
      ip_address: ip,
    });

    if (error) {
      console.error("log-consent insert failed:", error);
      return json({ error: "insert_failed" }, 500);
    }
    return json({ ok: true });
  } catch (err) {
    console.error("log-consent threw:", err);
    return json({ error: "internal" }, 500);
  }
});
