// Customer-facing: 1-click decline-reason capture from the day-1
// follow-up email. Customers who don't accept the offer get an email
// with 4 buttons; each button is a GET link to this function with
// ?token=<submission_token>&reason=<canonical_value>. We persist to
// submissions.decline_reason and redirect to a thank-you page so the
// customer never sees a raw JSON response.
//
// Authenticated by submission_token (the same opaque token used by
// every other public flow — magic-link offer page, photo upload, opt-out).
// No JWT required; the token IS the auth.

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

const VALID_REASONS = new Set([
  "price_too_low",
  "shopping_around",
  "not_ready",
  "sold_elsewhere",
  "other",
]);

const REASON_LABEL: Record<string, string> = {
  price_too_low: "the price was too low",
  shopping_around: "you're still shopping around",
  not_ready: "you're not ready to sell yet",
  sold_elsewhere: "you sold the car elsewhere",
  other: "other reasons",
};

// Resolve the caller-supplied redirect and return it only if the host is on
// the explicit allowlist. Anything off-list, or a non-http(s) scheme
// (javascript:/data:), is dropped so this endpoint can't be turned into a
// phishing redirector via crafted email links.
//
// PUBLIC_SITE_URL is the canonical customer-facing site (e.g.
// https://hartecash.com); ALLOWED_REDIRECT_HOSTS optionally extends it with
// a comma-separated list of additional hosts (e.g. preview deploys).
function sanitizeRedirect(input: string | null, requestUrl: string): string | null {
  if (!input) return null;
  const allowed = new Set<string>();
  const siteUrl = Deno.env.get("PUBLIC_SITE_URL");
  if (siteUrl) {
    try { allowed.add(new URL(siteUrl).host); } catch { /* ignore */ }
  }
  for (const h of (Deno.env.get("ALLOWED_REDIRECT_HOSTS") ?? "").split(",")) {
    const trimmed = h.trim();
    if (trimmed) allowed.add(trimmed);
  }
  // Function host stays allowed as a safe fallback for inline flows.
  try { allowed.add(new URL(requestUrl).host); } catch { /* ignore */ }

  try {
    const target = new URL(input, requestUrl);
    if (target.protocol !== "http:" && target.protocol !== "https:") return null;
    if (!allowed.has(target.host)) return null;
    return target.toString();
  } catch {
    return null;
  }
}

function htmlResponse(title: string, body: string, status = 200): Response {
  const html = `<!doctype html>
<html><head><meta charset="utf-8"/><title>${title}</title>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<style>
  body { font-family: -apple-system, system-ui, sans-serif; max-width: 540px; margin: 80px auto; padding: 24px; color: #1a1a2e; }
  .card { background: #fff; border: 1px solid #e5e7eb; border-radius: 16px; padding: 32px; box-shadow: 0 4px 12px rgba(0,0,0,0.04); }
  h1 { font-size: 20px; margin: 0 0 12px; color: #0a2647; }
  p { margin: 8px 0; line-height: 1.55; color: #4b5563; }
  .check { color: #10b981; font-size: 28px; }
</style></head>
<body><div class="card">${body}</div></body></html>`;
  return new Response(html, {
    status,
    headers: { ...corsHeaders, "Content-Type": "text/html; charset=utf-8" },
  });
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const url = new URL(req.url);
    const token = url.searchParams.get("token");
    const reason = (url.searchParams.get("reason") || "").toLowerCase();
    const redirect = url.searchParams.get("redirect");

    if (!token) {
      return htmlResponse("Invalid link", `<h1>Link is missing required info</h1><p>This link is malformed. Please use the buttons in the email exactly as sent.</p>`, 400);
    }
    if (!VALID_REASONS.has(reason)) {
      return htmlResponse("Invalid reason", `<h1>Unknown reason</h1><p>That reason isn't recognized. Please use one of the buttons in the email.</p>`, 400);
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: sub, error: subErr } = await supabase
      .from("submissions")
      .select("id, name, decline_reason")
      .eq("token", token)
      .maybeSingle();
    if (subErr || !sub) {
      return htmlResponse("Not found", `<h1>We couldn't find your offer</h1><p>This link may have expired. If you'd like to talk to us, just reply to the offer email.</p>`, 404);
    }

    // Idempotent — if they click twice we just keep the FIRST reason
    // (most reliable signal, avoids reason-thrash from a/b testing).
    if (!sub.decline_reason) {
      const { error: updateErr } = await supabase
        .from("submissions")
        .update({
          decline_reason: reason,
          decline_reason_at: new Date().toISOString(),
          decline_reason_source: "email_button",
        } as any)
        .eq("id", sub.id);
      if (updateErr) {
        console.error("track-decline-reason update failed:", updateErr);
        return htmlResponse("Try again", `<h1>Something went wrong</h1><p>We couldn't save your response. Please try clicking again, or reply to the email.</p>`, 500);
      }

      // Audit trail so the customer file timeline shows the click.
      await supabase.from("activity_log").insert({
        submission_id: sub.id,
        action: "Decline Reason Captured",
        new_value: reason,
        performed_by: "Customer (email click)",
      } as any);
    }

    // Only honor redirect if it resolves to a same-origin path. Anything
    // off-site (or a javascript:/data: URI) becomes a phishing primitive
    // since this endpoint is reachable from email clicks.
    const safeRedirect = sanitizeRedirect(redirect, req.url);
    if (safeRedirect) {
      return new Response(null, {
        status: 302,
        headers: { ...corsHeaders, Location: safeRedirect },
      });
    }

    const esc = (s: unknown) => String(s ?? "")
      .replace(/&/g, "&amp;").replace(/</g, "&lt;")
      .replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
    const customerName = esc(sub.name ? sub.name.split(" ")[0] : "there");
    const reasonLabel = esc(REASON_LABEL[reason]);
    return htmlResponse(
      "Thanks for letting us know",
      `<div class="check">✓</div>
       <h1>Thanks, ${customerName}.</h1>
       <p>You let us know that ${reasonLabel}. We'll tailor our follow-up so we're not pestering you about something that doesn't fit.</p>
       <p>If your situation changes, just reply to any email — we're here.</p>`,
    );
  } catch (e) {
    console.error("track-decline-reason error:", e);
    return htmlResponse("Server error", `<h1>Something went wrong</h1><p>Please try the link again in a moment.</p>`, 500);
  }
});
