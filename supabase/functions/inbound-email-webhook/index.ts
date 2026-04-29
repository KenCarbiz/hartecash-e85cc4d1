/**
 * inbound-email-webhook — receives customer email replies and threads
 * them into the customer file.
 *
 * Closes the email loop alongside sms-webhook. When a customer replies
 * to a transactional email (offer-ready, appointment-confirmation,
 * etc.) the reply lands here and gets logged to conversation_events
 * so the rep sees it in the timeline. The assigned rep is also pinged
 * via send-notification.
 *
 * Provider-agnostic — supports Postmark Inbound Parse and Mailgun
 * Routes today. SendGrid Inbound Parse follows the same shape and can
 * be added without schema changes.
 *
 * Routing:
 *   The dealer's outbound emails set Reply-To to
 *     replies+<submission_token>@inbound.autocurb.com
 *   so the recipient (`To` on inbound) tells us which submission the
 *   reply belongs to. We parse the +tag, look up the submission, and
 *   insert a conversation_events row.
 *
 * Auth:
 *   verify_jwt = false (registered in supabase/config.toml). We check
 *   a shared secret in either the X-Webhook-Secret header or a
 *   ?secret= query param against EMAIL_INBOUND_WEBHOOK_SECRET. Set
 *   the same secret on the provider's webhook config.
 *
 * URL:
 *   POST /functions/v1/inbound-email-webhook?provider=postmark
 *   POST /functions/v1/inbound-email-webhook?provider=mailgun
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-webhook-secret",
};

interface NormalizedEmail {
  from: string;
  fromName: string | null;
  to: string;
  subject: string;
  text: string;
  html: string | null;
  messageId: string | null;
  inReplyTo: string | null;
}

/** Parse a "Display Name <addr@domain>" or "addr@domain" into parts. */
function parseAddress(raw: string | undefined | null): { name: string | null; addr: string } {
  if (!raw) return { name: null, addr: "" };
  const m = raw.match(/^\s*"?([^"<]*?)"?\s*<([^>]+)>\s*$/);
  if (m) return { name: m[1].trim() || null, addr: m[2].trim().toLowerCase() };
  return { name: null, addr: raw.trim().toLowerCase() };
}

/** Extract the +tag from `local+tag@domain` recipient address. */
function extractPlusTag(addr: string): string | null {
  const at = addr.indexOf("@");
  if (at < 0) return null;
  const local = addr.slice(0, at);
  const plus = local.indexOf("+");
  if (plus < 0) return null;
  const tag = local.slice(plus + 1);
  return tag || null;
}

// ── Postmark adapter ─────────────────────────────────────────────
// Postmark Inbound posts JSON. Docs:
// https://postmarkapp.com/developer/webhooks/inbound-webhook
async function fromPostmark(req: Request): Promise<NormalizedEmail> {
  const body = await req.json();
  const fromParsed = parseAddress(body.From);
  const toAddr = (body.OriginalRecipient || body.To || "").toString();
  const toParsed = parseAddress(toAddr);
  const headers: { Name: string; Value: string }[] = body.Headers || [];
  const inReplyTo = headers.find((h) => h.Name?.toLowerCase() === "in-reply-to")?.Value || null;
  return {
    from: fromParsed.addr,
    fromName: fromParsed.name || body.FromName || null,
    to: toParsed.addr,
    subject: (body.Subject || "").toString(),
    text: (body.TextBody || body.StrippedTextReply || "").toString(),
    html: body.HtmlBody ? String(body.HtmlBody) : null,
    messageId: body.MessageID ? String(body.MessageID) : null,
    inReplyTo,
  };
}

// ── Mailgun adapter ──────────────────────────────────────────────
// Mailgun Routes posts multipart/form-data. Docs:
// https://documentation.mailgun.com/en/latest/user_manual.html#receiving-messages
async function fromMailgun(req: Request): Promise<NormalizedEmail> {
  const form = await req.formData();
  const fromRaw = (form.get("from") || form.get("From") || "").toString();
  const toRaw = (form.get("recipient") || form.get("To") || "").toString();
  const fromParsed = parseAddress(fromRaw);
  const toParsed = parseAddress(toRaw);
  const text =
    (form.get("stripped-text") as string | null) ||
    (form.get("body-plain") as string | null) ||
    "";
  const html =
    (form.get("stripped-html") as string | null) ||
    (form.get("body-html") as string | null) ||
    null;
  return {
    from: fromParsed.addr,
    fromName: fromParsed.name,
    to: toParsed.addr,
    subject: (form.get("subject") || form.get("Subject") || "").toString(),
    text: String(text),
    html: html ? String(html) : null,
    messageId: (form.get("Message-Id") as string | null) || null,
    inReplyTo: (form.get("In-Reply-To") as string | null) || null,
  };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return json({ error: "method not allowed" }, 405);
  }

  try {
    // ── Auth: shared secret ─────────────────────────────────────
    const secret = Deno.env.get("EMAIL_INBOUND_WEBHOOK_SECRET");
    if (!secret) {
      console.error("inbound-email-webhook: EMAIL_INBOUND_WEBHOOK_SECRET not configured");
      return json({ error: "server not configured" }, 503);
    }
    const url = new URL(req.url);
    const presented =
      req.headers.get("x-webhook-secret") ||
      url.searchParams.get("secret") ||
      "";
    if (!timingSafeEqual(presented, secret)) {
      return json({ error: "unauthorized" }, 401);
    }

    // ── Parse via provider adapter ──────────────────────────────
    const provider = (url.searchParams.get("provider") || "").toLowerCase();
    let email: NormalizedEmail;
    if (provider === "postmark") {
      email = await fromPostmark(req);
    } else if (provider === "mailgun") {
      email = await fromMailgun(req);
    } else {
      return json({ error: "missing or unsupported ?provider= (postmark|mailgun)" }, 400);
    }

    if (!email.from || !email.to) {
      return json({ error: "missing from/to" }, 400);
    }

    // ── Route to a submission ───────────────────────────────────
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    // Routing: try +tag first (replies+<token>@inbound.autocurb.com),
    // fall back to matching In-Reply-To against email_send_log so the
    // function still works when outbound can't set Reply-To.
    let sub: { id: string; dealership_id: string | null; name: string | null; email: string | null } | null = null;
    let routedBy: "plus_tag" | "in_reply_to" | null = null;

    const tag = extractPlusTag(email.to);
    if (tag) {
      const { data, error: subErr } = await supabase
        .from("submissions")
        .select("id, dealership_id, name, email")
        .eq("token", tag)
        .maybeSingle();
      if (subErr) {
        console.error("inbound-email-webhook: submission lookup by token failed", subErr);
        return json({ error: "submission_lookup_failed" }, 500);
      }
      if (data) {
        sub = data;
        routedBy = "plus_tag";
      }
    }

    if (!sub && email.inReplyTo) {
      const cleaned = email.inReplyTo.replace(/[<>]/g, "").trim();
      const { data: log } = await supabase
        .from("email_send_log")
        .select("submission_id")
        .eq("message_id", cleaned)
        .not("submission_id", "is", null)
        .limit(1)
        .maybeSingle();
      if (log?.submission_id) {
        const { data: subByLog } = await supabase
          .from("submissions")
          .select("id, dealership_id, name, email")
          .eq("id", log.submission_id)
          .maybeSingle();
        if (subByLog) {
          sub = subByLog;
          routedBy = "in_reply_to";
        }
      }
    }

    if (!sub) {
      console.warn("inbound-email-webhook: could not route email", {
        to: email.to,
        in_reply_to: email.inReplyTo,
      });
      // Still 200 so the provider doesn't retry — orphan reply.
      return json({ ok: true, skipped: "no_route" });
    }

    // ── Insert conversation_events ──────────────────────────────
    const bodyText = (email.text || "").trim() || "(empty body)";
    const insertRow = {
      submission_id: sub.id,
      dealership_id: sub.dealership_id || "default",
      channel: "email",
      direction: "inbound",
      actor_type: "customer",
      actor_label: email.fromName || sub.name || email.from,
      body_text: bodyText.slice(0, 50_000), // safety cap
      body_html: email.html ? email.html.slice(0, 200_000) : null,
      occurred_at: new Date().toISOString(),
      metadata: {
        provider,
        routed_by: routedBy,
        from: email.from,
        from_name: email.fromName,
        subject: email.subject,
        message_id: email.messageId,
        in_reply_to: email.inReplyTo,
      },
      source_table: "inbound_email",
      source_id: email.messageId,
    };

    const { error: insertErr } = await supabase
      .from("conversation_events")
      .insert(insertRow);
    if (insertErr) {
      console.error("inbound-email-webhook: insert failed", insertErr);
      return json({ error: insertErr.message }, 500);
    }

    // ── Ping the assigned rep (best-effort, never fails the hook) ─
    try {
      await supabase.functions.invoke("send-notification", {
        body: {
          trigger_key: "staff_customer_replied",
          submission_id: sub.id,
          custom_body: `${sub.name || "Customer"} replied by email: "${bodyText.slice(0, 200)}${bodyText.length > 200 ? "…" : ""}"`,
        },
      });
    } catch (e) {
      console.warn("inbound-email-webhook: rep ping failed (non-fatal)", e);
    }

    return json({ ok: true, submission_id: sub.id });
  } catch (e) {
    const err = e as Error;
    console.error("inbound-email-webhook error:", err);
    return json({ error: err.message || "unknown error" }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

// Constant-time string comparison so a slow attacker can't side-channel
// the secret one byte at a time.
function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let mismatch = 0;
  for (let i = 0; i < a.length; i++) {
    mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return mismatch === 0;
}
