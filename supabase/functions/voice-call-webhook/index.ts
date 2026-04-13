import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

/**
 * Analyze transcript/summary text to determine call outcome.
 */
function determineOutcome(
  transcript: string | null,
  summary: string | null,
  answeredBy: string | null
): string {
  if (answeredBy === "voicemail") return "voicemail_left";

  const text = `${transcript || ""} ${summary || ""}`.toLowerCase();

  // Check for opt-out first (highest priority)
  if (
    text.includes("stop calling") ||
    text.includes("remove me") ||
    text.includes("do not call") ||
    text.includes("take me off") ||
    text.includes("opt out") ||
    text.includes("stop contacting")
  ) {
    return "opted_out";
  }

  // Check for acceptance
  if (
    (text.includes("accept") || text.includes("i'll take it") || text.includes("deal")) &&
    (text.includes("yes") ||
      text.includes("sounds good") ||
      text.includes("let's do it") ||
      text.includes("agreed"))
  ) {
    return "accepted";
  }

  // Check for appointment scheduling
  if (
    text.includes("schedule") ||
    text.includes("appointment") ||
    text.includes("come in") ||
    text.includes("visit") ||
    text.includes("book")
  ) {
    // Confirm it was agreed upon, not just mentioned
    if (
      text.includes("morning") ||
      text.includes("afternoon") ||
      text.includes("tomorrow") ||
      text.includes("monday") ||
      text.includes("tuesday") ||
      text.includes("wednesday") ||
      text.includes("thursday") ||
      text.includes("friday") ||
      text.includes("saturday") ||
      text.includes("this week") ||
      text.includes("next week") ||
      text.includes("sounds good") ||
      text.includes("works for me") ||
      text.includes("sure") ||
      text.includes("yes")
    ) {
      return "appointment_scheduled";
    }
  }

  // Check for callback request
  if (
    text.includes("think about it") ||
    text.includes("call me back") ||
    text.includes("call back") ||
    text.includes("let me think") ||
    text.includes("need to talk to") ||
    text.includes("get back to you")
  ) {
    return "callback_requested";
  }

  // Check for not interested
  if (
    text.includes("not interested") ||
    text.includes("no thanks") ||
    text.includes("no thank you") ||
    text.includes("already sold") ||
    text.includes("not selling") ||
    text.includes("changed my mind")
  ) {
    return "not_interested";
  }

  return "completed";
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const payload = await req.json();

    console.log(
      "Voice call webhook received:",
      JSON.stringify({
        call_id: payload.call_id,
        status: payload.status,
        call_length: payload.call_length,
        answered_by: payload.answered_by,
      })
    );

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Extract data from Bland.ai webhook payload
    const callId = payload.call_id;
    const transcript = payload.concatenated_transcript || payload.transcript || null;
    const summary = payload.summary || null;
    const recordingUrl = payload.recording_url || null;
    const callLength = payload.call_length || null; // in seconds or minutes depending on Bland version
    const answeredBy = payload.answered_by || null; // "human" or "voicemail"
    const variables = payload.variables || {};
    const metadata = payload.metadata || {};

    const submissionId = metadata.submission_id;
    const campaignId = metadata.campaign_id;
    const callLogId = metadata.call_log_id;
    const dealershipId = metadata.dealership_id;

    if (!callId && !callLogId) {
      console.error("Webhook missing call_id and call_log_id");
      return new Response(
        JSON.stringify({ error: "Missing call_id and call_log_id" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // ── Find the call log record ──
    let callLogQuery = supabase.from("voice_call_log").select("*");

    if (callLogId) {
      callLogQuery = callLogQuery.eq("id", callLogId);
    } else {
      callLogQuery = callLogQuery.eq("provider_call_id", callId);
    }

    const { data: callLog, error: logErr } = await callLogQuery.single();

    if (logErr || !callLog) {
      console.error("Call log not found:", logErr);
      // Still return 200 so Bland doesn't retry
      return new Response(
        JSON.stringify({ warning: "Call log record not found", call_id: callId }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // ── Determine outcome ──
    const outcome = determineOutcome(transcript, summary, answeredBy);

    // Determine call status
    let callStatus = "completed";
    if (answeredBy === "voicemail") {
      callStatus = "voicemail";
    } else if (
      payload.status === "no-answer" ||
      payload.queue_status === "no-answer"
    ) {
      callStatus = "no_answer";
    } else if (payload.status === "failed" || payload.error) {
      callStatus = "failed";
    }

    // Convert call_length to seconds (Bland sends minutes as a float)
    let durationSeconds: number | null = null;
    if (callLength !== null && callLength !== undefined) {
      // Bland.ai sends call_length in minutes as a decimal
      durationSeconds =
        typeof callLength === "number"
          ? Math.round(callLength * 60)
          : parseFloat(callLength) * 60 || null;
    }

    // ── Update the call log record ──
    const { error: updateErr } = await supabase
      .from("voice_call_log")
      .update({
        transcript,
        summary,
        recording_url: recordingUrl,
        duration_seconds: durationSeconds,
        ended_at: new Date().toISOString(),
        answered_by: answeredBy,
        status: callStatus,
        outcome,
        opt_out_requested: outcome === "opted_out",
        provider_response: payload,
      })
      .eq("id", callLog.id);

    if (updateErr) {
      console.error("Failed to update call log:", updateErr);
    }

    // ── Handle outcome-specific actions ──

    // Opt-out: insert into opt_outs table
    if (outcome === "opted_out") {
      console.log(
        `Customer opted out during voice call. Submission: ${callLog.submission_id}`
      );

      // Fetch submission for phone/email
      if (callLog.submission_id) {
        const { data: sub } = await supabase
          .from("submissions")
          .select("phone, email, token")
          .eq("id", callLog.submission_id)
          .single();

        if (sub) {
          // Insert opt-out for phone calls
          if (sub.phone) {
            const { error: optErr } = await supabase
              .from("opt_outs")
              .upsert(
                {
                  phone: sub.phone,
                  email: sub.email || null,
                  channel: "phone",
                  token: sub.token || crypto.randomUUID(),
                  submission_id: callLog.submission_id,
                },
                { onConflict: "phone,channel" }
              );
            if (optErr) {
              console.error("Failed to insert opt-out:", optErr);
            }
          }
        }
      }
    }

    // Appointment scheduled: fire notification
    if (outcome === "appointment_scheduled") {
      console.log(
        `Appointment scheduled via voice call. Submission: ${callLog.submission_id}`
      );

      try {
        const fnUrl = `${supabaseUrl}/functions/v1/send-notification`;
        await fetch(fnUrl, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${supabaseKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            trigger_key: "customer_appointment_booked",
            submission_id: callLog.submission_id,
          }),
        });
      } catch (e) {
        console.error("Failed to send appointment notification:", e);
      }
    }

    // Accepted: update submission progress_status
    if (outcome === "accepted" && callLog.submission_id) {
      console.log(
        `Offer accepted via voice call. Submission: ${callLog.submission_id}`
      );

      const { error: subUpdateErr } = await supabase
        .from("submissions")
        .update({ progress_status: "price_agreed" })
        .eq("id", callLog.submission_id);

      if (subUpdateErr) {
        console.error("Failed to update submission status:", subUpdateErr);
      }

      // Also fire the accepted notification
      try {
        const fnUrl = `${supabaseUrl}/functions/v1/send-notification`;
        await fetch(fnUrl, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${supabaseKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            trigger_key: "customer_offer_accepted",
            submission_id: callLog.submission_id,
          }),
        });
      } catch (e) {
        console.error("Failed to send accepted notification:", e);
      }
    }

    // ── Update campaign totals ──
    const effectiveCampaignId = campaignId || callLog.campaign_id;
    if (effectiveCampaignId) {
      try {
        // Increment total_calls_made
        const updates: Record<string, unknown> = {
          total_calls_made: undefined, // will use RPC or manual increment
        };

        // Fetch current campaign totals
        const { data: campaign } = await supabase
          .from("voice_campaigns")
          .select("total_calls_made, total_connected, total_converted")
          .eq("id", effectiveCampaignId)
          .single();

        if (campaign) {
          const newTotals: Record<string, number> = {
            total_calls_made: (campaign.total_calls_made || 0) + 1,
            total_connected: campaign.total_connected || 0,
            total_converted: campaign.total_converted || 0,
          };

          // Connected = human answered
          if (answeredBy === "human" || callStatus === "completed") {
            newTotals.total_connected += 1;
          }

          // Converted = accepted or appointment_scheduled
          if (
            outcome === "accepted" ||
            outcome === "appointment_scheduled"
          ) {
            newTotals.total_converted += 1;
          }

          await supabase
            .from("voice_campaigns")
            .update({
              total_calls_made: newTotals.total_calls_made,
              total_connected: newTotals.total_connected,
              total_converted: newTotals.total_converted,
              updated_at: new Date().toISOString(),
            })
            .eq("id", effectiveCampaignId);
        }
      } catch (e) {
        console.error("Failed to update campaign totals:", e);
      }
    }

    console.log(
      `Voice call webhook processed: call_log=${callLog.id}, status=${callStatus}, outcome=${outcome}`
    );

    return new Response(
      JSON.stringify({
        success: true,
        call_log_id: callLog.id,
        status: callStatus,
        outcome,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (e) {
    console.error("voice-call-webhook error:", e);
    // Return 200 even on error so Bland.ai doesn't keep retrying
    return new Response(
      JSON.stringify({
        error: e instanceof Error ? e.message : "Unknown error",
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
