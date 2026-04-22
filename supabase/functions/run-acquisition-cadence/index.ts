import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// The autonomous cadence schedule
const CADENCE_STEPS = [
  { day: 0, action: "email_sms", trigger: "customer_offer_ready", description: "Instant offer notification" },
  { day: 1, action: "text", trigger: "gentle_nudge", description: "Gentle SMS nudge" },
  { day: 2, action: "voice", trigger: "follow_up", description: "AI voice call #1" },
  { day: 3, action: "text", trigger: "value_add", description: "Tire/brake value-add text" },
  { day: 5, action: "voice", trigger: "follow_up", description: "AI voice call #2 (if #1 was voicemail/no answer)" },
  { day: 6, action: "text", trigger: "urgency", description: "Urgency text — offer expiring" },
  { day: 8, action: "voice", trigger: "price_bump", description: "AI voice call #3 with price bump (if configured)" },
  { day: 14, action: "text", trigger: "gentle_nudge", description: "Final check-in text" },
];

// Cadence for accepted-but-not-booked
const APPOINTMENT_CADENCE = [
  { day: 0, action: "text", trigger: "schedule_reminder", description: "Schedule your inspection text" },
  { day: 1, action: "voice", trigger: "appointment", description: "AI call to schedule inspection" },
  { day: 2, action: "text", trigger: "schedule_reminder", description: "Second schedule reminder" },
  { day: 4, action: "voice", trigger: "appointment", description: "Second AI call to schedule" },
  { day: 7, action: "text", trigger: "urgency", description: "Urgency — offer expiring, schedule now" },
];

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { dealership_id } = await req.json().catch(() => ({}));

    const results = { offer_cadence: { processed: 0, actions: 0, skipped: 0 }, appointment_cadence: { processed: 0, actions: 0, skipped: 0 } };

    // ── CADENCE 1: Offer not accepted ──
    // Find leads with offers that haven't been accepted (2-30 days old)
    let query = supabase
      .from("submissions")
      .select("id, name, phone, email, created_at, progress_status, offered_price, estimated_offer_high, appointment_set, dealership_id, token")
      .in("progress_status", ["new", "contacted", "not_contacted", "offer_made"])
      .not("estimated_offer_high", "is", null)
      .gte("created_at", new Date(Date.now() - 30 * 86400000).toISOString())
      .lte("created_at", new Date(Date.now() - 1 * 86400000).toISOString())
      .order("created_at", { ascending: true })
      .limit(100);

    if (dealership_id) query = query.eq("dealership_id", dealership_id);

    const { data: offerLeads } = await query;

    for (const lead of (offerLeads || [])) {
      results.offer_cadence.processed++;

      const daysSinceCreated = Math.floor((Date.now() - new Date(lead.created_at).getTime()) / 86400000);

      // Find the right cadence step for today
      const step = CADENCE_STEPS.find(s => s.day === daysSinceCreated);
      if (!step) { results.offer_cadence.skipped++; continue; }

      // Check if this action was already taken today
      const { data: existingToday } = await supabase
        .from("voice_call_log")
        .select("id")
        .eq("submission_id", lead.id)
        .gte("created_at", new Date(new Date().setHours(0,0,0,0)).toISOString())
        .limit(1);

      if (existingToday && existingToday.length > 0) { results.offer_cadence.skipped++; continue; }

      // Check opt-out
      if (lead.phone) {
        const { data: optOut } = await supabase
          .from("opt_outs")
          .select("id")
          .eq("phone", lead.phone)
          .in("channel", ["sms", "phone", "all"])
          .maybeSingle();
        if (optOut) { results.offer_cadence.skipped++; continue; }
      }

      // Execute the step
      if (step.action === "voice" && lead.phone) {
        // Check if dealer has voice AI enabled
        const { data: dealer } = await supabase
          .from("dealer_accounts")
          .select("voice_ai_enabled, voice_ai_api_key")
          .eq("dealership_id", lead.dealership_id)
          .maybeSingle();

        if (dealer?.voice_ai_enabled && dealer?.voice_ai_api_key) {
          await supabase.functions.invoke("launch-voice-call", {
            body: { submission_id: lead.id, script_category: step.trigger === "price_bump" ? "price_bump" : "follow_up" }
          }).catch(console.error);
          results.offer_cadence.actions++;
        } else {
          // Fallback to text if voice not enabled
          await supabase.functions.invoke("ai-text-agent", {
            body: { submission_id: lead.id, trigger: step.trigger }
          }).catch(console.error);
          results.offer_cadence.actions++;
        }
      } else if (step.action === "text" && lead.phone) {
        await supabase.functions.invoke("ai-text-agent", {
          body: { submission_id: lead.id, trigger: step.trigger }
        }).catch(console.error);
        results.offer_cadence.actions++;
      } else if (step.action === "email_sms") {
        await supabase.functions.invoke("send-notification", {
          body: { trigger_key: step.trigger, submission_id: lead.id }
        }).catch(console.error);
        results.offer_cadence.actions++;
      } else {
        results.offer_cadence.skipped++;
      }
    }

    // ── CADENCE 2: Accepted but no appointment ──
    let apptQuery = supabase
      .from("submissions")
      .select("id, name, phone, email, created_at, progress_status, offered_price, estimated_offer_high, appointment_set, dealership_id, token, status_updated_at")
      .in("progress_status", ["offer_accepted", "price_agreed"])
      .eq("appointment_set", false)
      .order("status_updated_at", { ascending: true })
      .limit(50);

    if (dealership_id) apptQuery = apptQuery.eq("dealership_id", dealership_id);

    const { data: apptLeads } = await apptQuery;

    for (const lead of (apptLeads || [])) {
      results.appointment_cadence.processed++;

      const refDate = lead.status_updated_at || lead.created_at;
      const daysSince = Math.floor((Date.now() - new Date(refDate).getTime()) / 86400000);

      const step = APPOINTMENT_CADENCE.find(s => s.day === daysSince);
      if (!step) { results.appointment_cadence.skipped++; continue; }

      // Same dedup + opt-out checks as above
      const { data: existingToday } = await supabase
        .from("voice_call_log")
        .select("id")
        .eq("submission_id", lead.id)
        .gte("created_at", new Date(new Date().setHours(0,0,0,0)).toISOString())
        .limit(1);
      if (existingToday && existingToday.length > 0) { results.appointment_cadence.skipped++; continue; }

      if (lead.phone) {
        const { data: optOut } = await supabase
          .from("opt_outs").select("id")
          .eq("phone", lead.phone).in("channel", ["sms", "phone", "all"]).maybeSingle();
        if (optOut) { results.appointment_cadence.skipped++; continue; }
      }

      if (step.action === "voice" && lead.phone) {
        const { data: dealer } = await supabase
          .from("dealer_accounts")
          .select("voice_ai_enabled, voice_ai_api_key")
          .eq("dealership_id", lead.dealership_id)
          .maybeSingle();

        if (dealer?.voice_ai_enabled && dealer?.voice_ai_api_key) {
          await supabase.functions.invoke("launch-voice-call", {
            body: { submission_id: lead.id, script_category: "appointment" }
          }).catch(console.error);
          results.appointment_cadence.actions++;
        } else {
          await supabase.functions.invoke("ai-text-agent", {
            body: { submission_id: lead.id, trigger: "schedule_reminder" }
          }).catch(console.error);
          results.appointment_cadence.actions++;
        }
      } else if (step.action === "text" && lead.phone) {
        await supabase.functions.invoke("ai-text-agent", {
          body: { submission_id: lead.id, trigger: step.trigger }
        }).catch(console.error);
        results.appointment_cadence.actions++;
      } else {
        results.appointment_cadence.skipped++;
      }
    }

    return new Response(JSON.stringify({ status: "completed", ...results }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } });

  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
