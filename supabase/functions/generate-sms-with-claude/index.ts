/**
 * generate-sms-with-claude
 *
 * Two modes:
 *   1. mode: "template"  → generate a fresh SMS from a template_key + tone +
 *      submission context. Claude composes the message using the customer's
 *      name, vehicle, offer, and any prior conversation as facts.
 *   2. mode: "refine"    → take a draft the salesperson already typed and
 *      polish it for the chosen tone. Keeps the salesperson's intent;
 *      improves clarity / friendliness / etc.
 *
 * Body shape:
 *   {
 *     mode: "template" | "refine",
 *     submission_id: string,
 *     tone?: "friendly" | "professional" | "urgent" | "brief",
 *     template_key?: "follow_up" | "confirm_appointment" | "nudge" |
 *                    "they_arrived" | "ask_loan_payoff",
 *     draft?: string,            // required when mode === "refine"
 *     channel?: "sms" | "email"  // affects length cap; default "sms"
 *   }
 *
 * Returns: { text: string }
 *
 * Requires the ANTHROPIC_API_KEY secret to be set in the project's Functions
 * environment.
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

type Tone = "friendly" | "professional" | "urgent" | "brief";

const TONE_GUIDANCE: Record<Tone, string> = {
  friendly: "Warm and conversational, like texting a neighbor. Light, no pressure.",
  professional: "Polished, courteous, business-appropriate. No slang or emoji.",
  urgent: "Direct. Conveys time-sensitivity without sounding pushy.",
  brief: "As short as possible. One or two short sentences max.",
};

const TEMPLATE_INTENT: Record<string, string> = {
  follow_up: "Follow up on the offer that was sent. Ask if they have questions or want to talk it through.",
  confirm_appointment: "Confirm the upcoming appointment. Restate when, briefly.",
  nudge: "Gentle nudge after no response. Don't sound annoyed; offer to help.",
  they_arrived: "Customer just arrived at the dealership. Tell them you're walking out to meet them.",
  ask_loan_payoff: "Ask the customer for the current loan payoff amount so the deal can be finalized.",
};

const CHANNEL_CAP: Record<string, number> = {
  sms: 320,    // 2 SMS segments tops
  email: 1200,
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const apiKey = Deno.env.get("ANTHROPIC_API_KEY");
    if (!apiKey) {
      return json({ error: "ANTHROPIC_API_KEY not configured" }, 500);
    }

    const body = await req.json();
    const mode: "template" | "refine" = body.mode;
    const submissionId: string | undefined = body.submission_id;
    const tone: Tone = body.tone || "friendly";
    const templateKey: string | undefined = body.template_key;
    const draft: string = body.draft || "";
    const channel: "sms" | "email" = body.channel || "sms";

    if (mode !== "template" && mode !== "refine") {
      return json({ error: "mode must be 'template' or 'refine'" }, 400);
    }
    if (mode === "refine" && !draft.trim()) {
      return json({ error: "draft is required for refine mode" }, 400);
    }
    if (mode === "template" && !templateKey) {
      return json({ error: "template_key is required for template mode" }, 400);
    }

    // ── Pull customer + vehicle + recent comms context for the prompt ──
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    let context = "";
    if (submissionId) {
      const { data: sub } = await supabase
        .from("submissions")
        .select("name, phone, email, vehicle_year, vehicle_make, vehicle_model, vehicle_trim, mileage, offered_price, estimated_offer_high, acv_value, progress_status, appointment_date")
        .eq("id", submissionId)
        .maybeSingle();
      const { data: convo } = await supabase
        .from("conversation_events")
        .select("channel, direction, body_text, occurred_at")
        .eq("submission_id", submissionId)
        .order("occurred_at", { ascending: false })
        .limit(8);

      if (sub) {
        const firstName = (sub.name || "Customer").split(/\s+/)[0];
        const vehicle = [sub.vehicle_year, sub.vehicle_make, sub.vehicle_model, sub.vehicle_trim].filter(Boolean).join(" ");
        const offer = sub.offered_price ?? sub.estimated_offer_high;
        context += `Customer first name: ${firstName}\n`;
        if (vehicle) context += `Vehicle: ${vehicle}\n`;
        if (sub.mileage) context += `Mileage: ${sub.mileage}\n`;
        if (offer != null) context += `Offer: $${offer.toLocaleString()}\n`;
        if (sub.acv_value != null) context += `ACV: $${sub.acv_value.toLocaleString()}\n`;
        if (sub.appointment_date) context += `Appointment date: ${sub.appointment_date}\n`;
        if (sub.progress_status) context += `Current step: ${sub.progress_status}\n`;
      }

      if (convo && convo.length > 0) {
        context += "\nRecent conversation (most recent first):\n";
        for (const c of convo.slice(0, 5)) {
          const who = c.direction === "in" ? "Customer" : "You";
          context += `- [${c.channel}] ${who}: ${(c.body_text || "").slice(0, 200)}\n`;
        }
      }
    }

    const cap = CHANNEL_CAP[channel] || 320;
    const toneNote = TONE_GUIDANCE[tone] || TONE_GUIDANCE.friendly;

    let userPrompt: string;
    if (mode === "template") {
      const intent = TEMPLATE_INTENT[templateKey!] || templateKey!;
      userPrompt =
        `You are a salesperson at a car dealership writing an outreach ${channel} to a customer.\n\n` +
        `Tone: ${tone.toUpperCase()} — ${toneNote}\n` +
        `Goal: ${intent}\n\n` +
        `Customer / deal facts (use only what's relevant):\n${context || "(no extra context)"}\n\n` +
        `Write the ${channel} message now. Plain text, no quotes, no preamble. ` +
        `Keep it under ${cap} characters. ` +
        (channel === "sms" ? "No greeting line — just one or two short sentences." : "");
    } else {
      userPrompt =
        `Polish this ${channel} draft for tone "${tone}" — ${toneNote}\n\n` +
        `Customer / deal facts:\n${context || "(no extra context)"}\n\n` +
        `Original draft:\n"""${draft}"""\n\n` +
        `Return only the refined message text. Plain text, no quotes, no commentary. ` +
        `Keep it under ${cap} characters. Preserve the salesperson's intent.`;
    }

    // ── Call Anthropic Messages API ──
    const aiRes = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-5-20250929",
        max_tokens: 400,
        system: "You write short, natural-sounding outreach messages for car-dealership salespeople. " +
                "Never invent facts not provided in the context. " +
                "Never use markdown, emoji, or '—' em-dashes. " +
                "Output is plain text only and will be sent verbatim to a customer.",
        messages: [
          { role: "user", content: userPrompt },
        ],
      }),
    });

    if (!aiRes.ok) {
      const errText = await aiRes.text();
      return json({ error: `Anthropic API ${aiRes.status}`, detail: errText }, 502);
    }

    const aiData = await aiRes.json();
    const text: string = (aiData.content?.[0]?.text || "").trim();

    return json({ text });
  } catch (err) {
    return json({ error: (err as Error).message || "unknown error" }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "content-type": "application/json" },
  });
}
