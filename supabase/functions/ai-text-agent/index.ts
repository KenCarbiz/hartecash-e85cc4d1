import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { resolveCaller, callerCanActOnTenant, forbidden } from "../_shared/auth.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

/**
 * AI Text Agent — template-constrained SMS follow-ups for failed voice calls.
 *
 * All facts (offer amount, vehicle info, dealer name) come from the database.
 * No freeform AI text generation — every message uses a pre-defined template.
 */

type Trigger =
  | "missed_call"
  | "voicemail_followup"
  | "gentle_nudge"
  | "value_add"
  | "urgency"
  | "schedule_reminder"
  | "no_show_rescue"
  | "competitor_match";

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { submission_id, trigger, custom_message } = await req.json();

    if (!submission_id) {
      return new Response(
        JSON.stringify({ error: "submission_id is required" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // ── Fetch submission (HARD FACTS from database) ──
    const { data: sub, error: subErr } = await supabase
      .from("submissions")
      .select("*")
      .eq("id", submission_id)
      .single();

    if (subErr || !sub) {
      return new Response(
        JSON.stringify({ error: "Submission not found" }),
        {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Staff-only — anonymous callers are rejected; staff must match tenant.
    const caller = await resolveCaller(
      req,
      supabaseUrl,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      supabaseKey,
    );
    if (!callerCanActOnTenant(caller, sub.dealership_id)) {
      return forbidden(corsHeaders);
    }

    if (!sub.phone) {
      return new Response(
        JSON.stringify({ error: "No phone number on submission" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // ── Check opt-out before sending anything ──
    const { data: optOuts } = await supabase
      .from("opt_outs")
      .select("id")
      .eq("phone", sub.phone)
      .in("channel", ["sms", "all"])
      .limit(1);

    if (optOuts && optOuts.length > 0) {
      return new Response(
        JSON.stringify({ status: "skipped", reason: "opted_out" }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // ── Build HARD-CODED facts (never AI-generated) ──
    const firstName = sub.name?.split(" ")[0] || "there";
    const vehicleStr = [sub.vehicle_year, sub.vehicle_make, sub.vehicle_model]
      .filter(Boolean)
      .join(" ");
    const offerAmount = sub.offered_price || sub.estimated_offer_high || 0;
    const formattedOffer = Number(offerAmount).toLocaleString("en-US", {
      maximumFractionDigits: 0,
    });

    // Build offer link from the submission token
    const offerLink = `${supabaseUrl.replace(".supabase.co", "")}/offer/${sub.token}`;

    // ── Fetch dealer info from site_config ──
    const dealershipId = sub.dealership_id;
    const { data: siteConfig } = await supabase
      .from("site_config")
      .select("dealership_name, phone")
      .eq("dealership_id", dealershipId)
      .maybeSingle();

    const dealerName = siteConfig?.dealership_name || "Our dealership";
    const dealerPhone = siteConfig?.phone || "";

    // ── TEMPLATE-CONSTRAINED messages (guardrailed — no freeform AI generation) ──
    const templates: Record<Trigger, string> = {
      // After missed voice call
      missed_call:
        `Hey ${firstName}, this is ${dealerName}. We just tried to give you a call about your ${vehicleStr}. We have a $${formattedOffer} cash offer ready for you!\n\nView your offer: ${offerLink}\n\nReply STOP to opt out.`,

      // After voicemail left
      voicemail_followup:
        `Hey ${firstName}, we just left you a voicemail about your ${vehicleStr}. Your $${formattedOffer} offer is waiting — tap here to view: ${offerLink}\n\nReply STOP to opt out.`,

      // Gentle nudge (day 2-3)
      gentle_nudge:
        `Hey ${firstName}, just checking in on your ${vehicleStr}. Your $${formattedOffer} cash offer is still available. Most customers get paid the same day they visit.\n\n${offerLink}\n\nReply STOP to opt out.`,

      // Value add (mention tire/brake value)
      value_add:
        `${firstName}, quick tip about your ${vehicleStr}: our online offers are conservative. If your tires and brakes are in good shape, the in-person number is usually $500-$1,000 higher. Only takes 15 mins.\n\nYour current offer: ${offerLink}\n\nReply STOP to opt out.`,

      // Urgency (offer expiring)
      urgency:
        `${firstName}, heads up — your $${formattedOffer} offer for your ${vehicleStr} expires soon. Cars lose value every day, so locking this in now is smart.\n\nAccept here: ${offerLink}\n\nReply STOP to opt out.`,

      // Schedule appointment (accepted but not booked)
      schedule_reminder:
        `${firstName}, great news — your $${formattedOffer} offer for your ${vehicleStr} is locked in! Let's get your inspection scheduled so you can get paid. Reply with a day that works or tap: ${offerLink}\n\nReply STOP to opt out.`,

      // No-show rescue
      no_show_rescue:
        `${firstName}, we missed you today! No worries — your $${formattedOffer} offer for your ${vehicleStr} is still valid. Want to reschedule? Reply with a day or call us: ${dealerPhone}\n\nReply STOP to opt out.`,

      // Competitor match
      competitor_match:
        `${firstName}, if you have a competing offer for your ${vehicleStr}, bring it in — we match or beat verified offers. Your current offer with us: $${formattedOffer}\n\n${offerLink}\n\nReply STOP to opt out.`,
    };

    const selectedTrigger: Trigger =
      trigger && trigger in templates ? trigger : "missed_call";
    const message = templates[selectedTrigger];

    // ── Send via existing notification system ──
    const { error: sendErr } = await supabase.functions.invoke(
      "send-notification",
      {
        body: {
          trigger_key: "ai_text_agent",
          submission_id: sub.id,
          override_sms_body: message,
          channels: ["sms"],
        },
      }
    );

    if (sendErr) {
      console.error("Failed to send SMS via send-notification:", sendErr);
    }

    // ── Log to voice_call_log for audit trail ──
    const now = new Date().toISOString();
    const { error: logErr } = await supabase.from("voice_call_log").insert({
      submission_id: sub.id,
      dealership_id: dealershipId,
      phone_number: sub.phone,
      customer_name: sub.name,
      vehicle_info: vehicleStr,
      status: "completed",
      outcome: `text_sent_${selectedTrigger}`,
      summary: `AI text agent: ${selectedTrigger} message sent`,
      transcript: message,
      started_at: now,
      ended_at: now,
      duration_seconds: 0,
      post_call_sms_sent: true,
    });

    if (logErr) {
      console.error("Failed to insert voice_call_log:", logErr);
    }

    console.log(
      `AI text agent: trigger=${selectedTrigger}, submission=${submission_id}, len=${message.length}`
    );

    return new Response(
      JSON.stringify({
        status: "sent",
        trigger: selectedTrigger,
        message_length: message.length,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (e) {
    console.error("ai-text-agent error:", e);
    return new Response(
      JSON.stringify({
        error: e instanceof Error ? e.message : "Unknown error",
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
