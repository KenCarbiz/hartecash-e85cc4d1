import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

/**
 * sms-webhook — public endpoint Twilio POSTs to when a customer
 * replies to one of our outbound texts. This closes the loop on
 * 2-way SMS (D3c) and gives us:
 *
 *   1. Every customer reply logged to conversation_events (visible
 *      in the unified thread alongside our outbound messages)
 *   2. TCPA-compliant STOP / UNSUBSCRIBE / CANCEL handling — we add
 *      the phone to sms_opt_outs immediately and auto-reply with the
 *      carrier-required confirmation
 *   3. HELP keyword handling with an auto-reply pointing at the
 *      dealership phone
 *   4. staff_customer_replied notification to the assigned rep so
 *      they know the customer is engaging
 *
 * AI date-parsing + auto-booking on scheduling replies ("2pm Friday
 * works") is a future layer — MVP here just routes the message and
 * pings the human. Adding the parser is now a matter of extending
 * this function, not building new infrastructure.
 *
 * Twilio webhook config:
 *   URL: https://<project>.supabase.co/functions/v1/sms-webhook
 *   HTTP: POST
 *   Auth: we validate the X-Twilio-Signature header against
 *         TWILIO_AUTH_TOKEN. Requests with a bad signature are
 *         rejected 401.
 */

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-twilio-signature",
};

const STOP_KEYWORDS = ["stop", "stopall", "unsubscribe", "cancel", "end", "quit"];
const HELP_KEYWORDS = ["help", "info"];
const START_KEYWORDS = ["start", "unstop", "yes"];

interface TwilioInbound {
  MessageSid: string;
  From: string;
  To: string;
  Body: string;
  NumMedia?: string;
}

async function validateTwilioSignature(
  url: string,
  params: Record<string, string>,
  signatureHeader: string,
  authToken: string,
): Promise<boolean> {
  // Twilio signature: HMAC-SHA1 of the URL + sorted params, base64.
  // https://www.twilio.com/docs/usage/security#validating-requests
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

function buildTwiML(replyText: string | null): string {
  // Respond with TwiML. Empty Response = don't auto-reply (we'll
  // handle notifications server-side). Otherwise wrap the auto-reply
  // in a <Message> tag.
  if (!replyText) return '<?xml version="1.0" encoding="UTF-8"?><Response></Response>';
  const escaped = replyText
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
  return `<?xml version="1.0" encoding="UTF-8"?><Response><Message>${escaped}</Message></Response>`;
}

function normalizePhone(raw: string): string {
  return raw.replace(/\D/g, "");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);
    const authToken = Deno.env.get("TWILIO_AUTH_TOKEN");

    // Twilio always sends form-urlencoded.
    const form = await req.formData();
    const params: Record<string, string> = {};
    for (const [k, v] of form.entries()) params[k] = String(v);
    const inbound = params as unknown as TwilioInbound;

    // ── Signature check ─────────────────────────────────────────
    // If the auth token is configured we validate; if it isn't we log
    // a warning and continue (dev environments).
    if (authToken) {
      const signature = req.headers.get("x-twilio-signature") || "";
      const publicUrl = req.url; // Twilio signs against the full request URL it POSTed
      const ok = await validateTwilioSignature(publicUrl, params, signature, authToken);
      if (!ok) {
        console.warn("sms-webhook: bad Twilio signature from", inbound.From);
        return new Response("unauthorized", { status: 401 });
      }
    } else {
      console.warn("sms-webhook: TWILIO_AUTH_TOKEN not set — skipping signature validation");
    }

    if (!inbound.MessageSid || !inbound.From) {
      return new Response(buildTwiML(null), {
        headers: { "Content-Type": "application/xml" },
      });
    }

    // Dedup — Twilio retries on timeout.
    const { data: existing } = await supabase
      .from("sms_inbound_log")
      .select("id")
      .eq("provider_message_id", inbound.MessageSid)
      .maybeSingle();
    if (existing) {
      return new Response(buildTwiML(null), {
        headers: { "Content-Type": "application/xml" },
      });
    }

    const fromDigits = normalizePhone(inbound.From);
    const bodyRaw = inbound.Body || "";
    const bodyLower = bodyRaw.trim().toLowerCase();

    // Match the inbound to the most recent open submission by phone.
    const { data: subs } = await supabase
      .from("submissions")
      .select("id, dealership_id, name, assigned_rep_email, progress_status")
      .ilike("phone", `%${fromDigits.slice(-10)}`)
      .order("created_at", { ascending: false })
      .limit(1);
    const sub = (subs && subs[0]) || null;

    // ── Log the inbound ────────────────────────────────────────
    await supabase.from("sms_inbound_log").insert({
      provider_message_id: inbound.MessageSid,
      from_phone: inbound.From,
      to_phone: inbound.To,
      body: bodyRaw,
      submission_id: sub?.id ?? null,
      dealership_id: sub?.dealership_id ?? null,
    } as any);

    // ── STOP / UNSUBSCRIBE ─────────────────────────────────────
    if (STOP_KEYWORDS.includes(bodyLower)) {
      await supabase.from("sms_opt_outs").upsert(
        {
          phone: inbound.From,
          dealership_id: sub?.dealership_id ?? null,
          reason: `replied "${bodyRaw.trim()}"`,
          opted_out_at: new Date().toISOString(),
        } as any,
        { onConflict: "phone" },
      );
      if (sub) {
        await supabase.from("conversation_events").insert({
          submission_id: sub.id,
          dealership_id: sub.dealership_id || "default",
          channel: "sms",
          direction: "inbound",
          actor_type: "customer",
          actor_label: sub.name || "Customer",
          body_text: bodyRaw + "  (auto-added to opt-out list)",
          occurred_at: new Date().toISOString(),
          source_table: "sms_inbound_log",
        } as any);
      }
      // Required auto-reply per carrier compliance.
      return new Response(
        buildTwiML("You've been unsubscribed and won't receive more texts. Reply START to rejoin."),
        { headers: { "Content-Type": "application/xml" } },
      );
    }

    // ── START / re-opt-in ──────────────────────────────────────
    if (START_KEYWORDS.includes(bodyLower)) {
      await supabase.from("sms_opt_outs").delete().eq("phone", inbound.From);
      if (sub) {
        await supabase.from("conversation_events").insert({
          submission_id: sub.id,
          dealership_id: sub.dealership_id || "default",
          channel: "sms",
          direction: "inbound",
          actor_type: "customer",
          actor_label: sub.name || "Customer",
          body_text: bodyRaw + "  (re-opted in)",
          occurred_at: new Date().toISOString(),
          source_table: "sms_inbound_log",
        } as any);
      }
      return new Response(
        buildTwiML("You're resubscribed. We'll text you again about your trade-in. Reply STOP any time to unsubscribe."),
        { headers: { "Content-Type": "application/xml" } },
      );
    }

    // ── HELP ───────────────────────────────────────────────────
    if (HELP_KEYWORDS.includes(bodyLower)) {
      return new Response(
        buildTwiML("This is Autocurb — your dealer's trade-in service. For help with your offer, reply with your question or call the dealership. Reply STOP to unsubscribe."),
        { headers: { "Content-Type": "application/xml" } },
      );
    }

    // ── Normal reply ───────────────────────────────────────────
    if (sub) {
      await supabase.from("conversation_events").insert({
        submission_id: sub.id,
        dealership_id: sub.dealership_id || "default",
        channel: "sms",
        direction: "inbound",
        actor_type: "customer",
        actor_label: sub.name || "Customer",
        body_text: bodyRaw,
        occurred_at: new Date().toISOString(),
        source_table: "sms_inbound_log",
      } as any);

      // Ping the assigned rep so they know the customer replied.
      if (sub.assigned_rep_email) {
        const { data: repRow } = await supabase
          .from("user_roles")
          .select("phone, email")
          .eq("email", sub.assigned_rep_email)
          .maybeSingle();
        await supabase.functions.invoke("send-notification", {
          body: {
            trigger_key: "staff_customer_replied",
            submission_id: sub.id,
            recipient_phone: (repRow as any)?.phone || undefined,
            recipient_email: sub.assigned_rep_email,
            custom_body: `${sub.name || "Customer"} replied: "${bodyRaw.slice(0, 140)}"`,
          },
        }).catch(() => {});
      } else {
        // No assigned rep — fall back to the admin-level list.
        await supabase.functions.invoke("send-notification", {
          body: {
            trigger_key: "staff_customer_replied",
            submission_id: sub.id,
            custom_body: `${sub.name || "Customer"} replied: "${bodyRaw.slice(0, 140)}"`,
          },
        }).catch(() => {});
      }
    } else {
      // No matching submission — still log so we don't silently drop.
      console.warn("sms-webhook: no submission match for", inbound.From);
    }

    // Don't auto-reply to normal messages — the rep will follow up.
    return new Response(buildTwiML(null), {
      headers: { "Content-Type": "application/xml" },
    });
  } catch (e) {
    console.error("sms-webhook error:", e);
    return new Response(buildTwiML(null), {
      status: 500,
      headers: { "Content-Type": "application/xml" },
    });
  }
});
