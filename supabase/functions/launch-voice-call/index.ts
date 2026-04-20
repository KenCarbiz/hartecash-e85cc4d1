import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

/**
 * ZIP-code prefix → IANA timezone mapping for TCPA calling-hours compliance.
 * This covers the major US timezone bands. For edge-case ZIPs the function
 * falls back to America/New_York.
 */
const ZIP_TO_TIMEZONE: Record<string, string> = {
  // Eastern
  "0": "America/New_York", "1": "America/New_York", "2": "America/New_York",
  "3": "America/New_York",
  // Central
  "4": "America/Chicago", "5": "America/Chicago", "6": "America/Chicago",
  "7": "America/Chicago",
  // Mountain
  "8": "America/Denver",
  // Pacific
  "9": "America/Los_Angeles",
};

function getTimezoneFromZip(zip: string | null): string {
  if (!zip || zip.length < 1) return "America/New_York";
  return ZIP_TO_TIMEZONE[zip[0]] || "America/New_York";
}

function getCurrentTimeInTz(tz: string): string {
  try {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone: tz,
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    }).formatToParts(new Date());
    const hh = parts.find((p) => p.type === "hour")?.value ?? "00";
    const mm = parts.find((p) => p.type === "minute")?.value ?? "00";
    return `${hh}:${mm}`;
  } catch {
    return "12:00"; // safe mid-day fallback
  }
}

function isWithinCallingHours(
  currentTime: string,
  start: string,
  end: string
): boolean {
  return currentTime >= start && currentTime < end;
}

function renderTemplate(
  template: string,
  vars: Record<string, string>
): string {
  let result = template;
  for (const [key, val] of Object.entries(vars)) {
    result = result.replaceAll(`{{${key}}}`, val);
  }
  return result;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const {
      submission_id,
      campaign_id,
      script_template_id,
      bump_amount,
      // ── Customer-initiated AI appraiser Q&A ──
      // When the customer hits "Talk to our appraiser now" on the offer page,
      // the front end calls us with campaign_type: "appraiser_qa" and a
      // context blob containing the vehicle summary and current offer. We
      // synthesize a script template inline so the dealer doesn't need to
      // pre-author one in voice_script_templates.
      campaign_type,
      context,
      submission_token,
      phone: requestedPhone,
    } = await req.json();

    if (!submission_id) {
      return new Response(
        JSON.stringify({ error: "submission_id is required" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // ── Fetch submission ──
    const { data: submission, error: subErr } = await supabase
      .from("submissions")
      .select("*")
      .eq("id", submission_id)
      .single();

    if (subErr || !submission) {
      return new Response(
        JSON.stringify({ error: "Submission not found" }),
        {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    if (!submission.phone) {
      return new Response(
        JSON.stringify({ error: "Submission has no phone number" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const dealershipId = submission.dealership_id;
    if (!dealershipId) {
      return new Response(
        JSON.stringify({ error: "Submission has no dealership_id" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // ── Fetch dealer voice AI config ──
    const { data: dealer, error: dealerErr } = await supabase
      .from("dealer_accounts")
      .select(
        "id, dealership_name, voice_ai_enabled, voice_ai_provider, voice_ai_api_key, voice_ai_from_number, voice_ai_transfer_number, voice_ai_max_bump_amount, voice_ai_competitor_response_mode, voice_ai_beat_competitor_amount"
      )
      .eq("id", dealershipId)
      .single();

    if (dealerErr || !dealer) {
      return new Response(
        JSON.stringify({ error: "Dealer account not found" }),
        {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    if (!dealer.voice_ai_enabled) {
      return new Response(
        JSON.stringify({ error: "Voice AI is not enabled for this dealership" }),
        {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    if (!dealer.voice_ai_api_key) {
      return new Response(
        JSON.stringify({ error: "Voice AI API key not configured" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // ── Check opt-out status ──
    const customerPhone = submission.phone;
    const customerEmail = submission.email;

    const optOutQuery = supabase
      .from("opt_outs")
      .select("id")
      .in("channel", ["phone", "voice", "all"]);

    if (customerPhone) {
      optOutQuery.eq("phone", customerPhone);
    } else if (customerEmail) {
      optOutQuery.eq("email", customerEmail);
    }

    const { data: optOuts } = await optOutQuery.limit(1);

    if (optOuts && optOuts.length > 0) {
      return new Response(
        JSON.stringify({ error: "Customer has opted out of calls" }),
        {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // ── TCPA express consent check ──
    // Federal TCPA requires prior express written consent before placing
    // autodialed/prerecorded calls to a cell phone for marketing purposes.
    // Block the call unless we can find a matching consent_log entry that
    // covers calls for this customer.
    const consentQuery = supabase
      .from("consent_log")
      .select("id, consent_type, consent_text, created_at")
      .in("consent_type", ["sms_calls_email", "calls", "voice", "tcpa"]);

    if (customerPhone) {
      consentQuery.eq("customer_phone", customerPhone);
    } else if (customerEmail) {
      consentQuery.eq("customer_email", customerEmail);
    }

    const { data: consentRows } = await consentQuery
      .order("created_at", { ascending: false })
      .limit(1);

    const consentRecord = consentRows && consentRows.length > 0 ? consentRows[0] : null;
    if (!consentRecord) {
      // Log the blocked attempt so compliance has an audit trail of
      // non-consented call attempts.
      await supabase.from("voice_call_log").insert({
        submission_id,
        dealership_id: dealershipId,
        phone_number: customerPhone,
        customer_name: submission.name,
        status: "blocked_no_consent",
        consent_verified: false,
        tcpa_disclosure_given: false,
        scheduled_at: new Date().toISOString(),
        metadata: { blocked_reason: "no_tcpa_consent_on_file" },
      }).catch((e: unknown) => console.warn("failed to log blocked attempt", e));

      return new Response(
        JSON.stringify({
          error: "No TCPA consent on file for this customer. Call blocked.",
          code: "tcpa_consent_missing",
        }),
        {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // ── TCPA calling hours check ──
    const customerTz = getTimezoneFromZip(submission.zip);
    const currentLocalTime = getCurrentTimeInTz(customerTz);

    // Fetch calling hours from campaign or use defaults
    let callingStart = "09:00";
    let callingEnd = "18:00";
    let campaignData: any = null;

    if (campaign_id) {
      const { data: campaign } = await supabase
        .from("voice_campaigns")
        .select("*")
        .eq("id", campaign_id)
        .single();

      if (campaign) {
        campaignData = campaign;
        callingStart = campaign.calling_hours_start || "09:00";
        callingEnd = campaign.calling_hours_end || "18:00";
      }
    }

    if (!isWithinCallingHours(currentLocalTime, callingStart, callingEnd)) {
      return new Response(
        JSON.stringify({
          error: "Outside calling hours",
          customer_timezone: customerTz,
          current_local_time: currentLocalTime,
          calling_window: `${callingStart} - ${callingEnd}`,
        }),
        {
          status: 422,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // ── Build script from template ──
    let scriptTemplate = "";

    if (campaign_type === "appraiser_qa") {
      // Inline template — no DB row needed. The Bland agent acts as a friendly
      // appraiser who already knows the customer's vehicle and offer. They
      // answer questions about the offer, the inspection process, pickup
      // logistics, and condition deductions. No selling, no pressure.
      const vehicleSummary = context?.vehicle_summary || "your vehicle";
      const offerDollars = context?.cash_offer ? `$${Math.round(context.cash_offer).toLocaleString()}` : "your offer";
      scriptTemplate = `You are a friendly appraiser calling back a customer who just received a cash offer of ${offerDollars} for their ${vehicleSummary}. They asked us to call so you could answer any questions about the offer, the in-person inspection, the pickup process, or how the condition deductions worked. You are NOT trying to sell them or push them to accept. You are explaining and answering. If they want to accept the offer, walk them through scheduling pickup. If they're hesitant, ask what specifically is on their mind. If they ask something you don't know, say "I'll have the team follow up by text within an hour." Keep responses under 30 seconds each. Be warm, knowledgeable, and concise.`;
    } else if (script_template_id) {
      const { data: tmpl } = await supabase
        .from("voice_script_templates")
        .select("script_template")
        .eq("id", script_template_id)
        .single();
      if (tmpl) scriptTemplate = tmpl.script_template;
    } else if (campaignData?.script_template) {
      scriptTemplate = campaignData.script_template;
    } else {
      // Default to the "Offer Follow-Up" template
      const { data: defaultTmpl } = await supabase
        .from("voice_script_templates")
        .select("script_template")
        .eq("is_default", true)
        .eq("category", bump_amount ? "price_bump" : "follow_up")
        .limit(1)
        .single();
      if (defaultTmpl) scriptTemplate = defaultTmpl.script_template;
    }

    if (!scriptTemplate) {
      return new Response(
        JSON.stringify({ error: "No script template found" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Fetch dealer site config for additional data
    const { data: siteConfig } = await supabase
      .from("site_config")
      .select("dealership_name, phone, price_guarantee_days")
      .eq("dealership_id", dealershipId)
      .maybeSingle();

    const dealerName =
      siteConfig?.dealership_name ||
      dealer.dealership_name ||
      "Our Dealership";
    const dealerPhone = siteConfig?.phone || dealer.voice_ai_from_number || "";
    const guaranteeDays = siteConfig?.price_guarantee_days || 8;

    const customerFirstName =
      submission.name?.split(" ")[0] || "there";
    const offerAmount = submission.offered_price
      ? Number(submission.offered_price).toLocaleString("en-US", {
          maximumFractionDigits: 0,
        })
      : "0";

    // Calculate days remaining on offer
    const createdAt = new Date(submission.created_at);
    const expiresAt = new Date(
      createdAt.getTime() + guaranteeDays * 24 * 60 * 60 * 1000
    );
    const daysRemaining = Math.max(
      0,
      Math.ceil(
        (expiresAt.getTime() - Date.now()) / (24 * 60 * 60 * 1000)
      )
    );

    // Calculate bump amounts
    const maxBump = Math.min(
      bump_amount || dealer.voice_ai_max_bump_amount || 500,
      dealer.voice_ai_max_bump_amount || 500
    );
    const bumpedAmount = submission.offered_price
      ? Number(submission.offered_price) + maxBump
      : 0;

    const competitorMode = dealer.voice_ai_competitor_response_mode || 'none';
    const beatAmount = dealer.voice_ai_beat_competitor_amount || 0;

    const templateVars: Record<string, string> = {
      agent_name: "Sarah",
      dealer_name: dealerName,
      dealer_phone: dealerPhone,
      customer_first_name: customerFirstName,
      vehicle_year: submission.vehicle_year || "",
      vehicle_make: submission.vehicle_make || "",
      vehicle_model: submission.vehicle_model || "",
      offer_amount: offerAmount,
      days_remaining: String(daysRemaining),
      available_days: "this week",
      max_bump: maxBump.toLocaleString("en-US"),
      bumped_amount: bumpedAmount.toLocaleString("en-US", {
        maximumFractionDigits: 0,
      }),
      competitor_mode: competitorMode,
      competitor_beat_amount: beatAmount.toString(),
      competitor_response: competitorMode === 'match'
        ? "We will match any verified competitor offer."
        : competitorMode === 'beat'
        ? `We will beat any verified competitor offer by $${beatAmount}.`
        : "Let me connect you with our manager to discuss competing offers.",
    };

    const renderedScript = renderTemplate(scriptTemplate, templateVars);
    const vehicleInfo = [
      submission.vehicle_year,
      submission.vehicle_make,
      submission.vehicle_model,
    ]
      .filter(Boolean)
      .join(" ");
    const firstSentence = `Hi, is this ${customerFirstName}?`;

    // ── Insert call log record (queued) ──
    const { data: callLog, error: insertErr } = await supabase
      .from("voice_call_log")
      .insert({
        campaign_id: campaign_id || null,
        submission_id,
        dealership_id: dealershipId,
        phone_number: customerPhone,
        customer_name: submission.name,
        vehicle_info: vehicleInfo,
        scheduled_at: new Date().toISOString(),
        status: "queued",
        original_offer: submission.offered_price
          ? Number(submission.offered_price)
          : null,
        bump_offered: bump_amount ? maxBump : null,
        consent_verified: true,
        tcpa_disclosure_given: true,
        metadata: {
          customer_timezone: customerTz,
          template_vars: templateVars,
          consent_log_id: consentRecord.id,
          consent_type: consentRecord.consent_type,
          consent_captured_at: consentRecord.created_at,
        },
      })
      .select()
      .single();

    if (insertErr || !callLog) {
      console.error("Failed to insert call log:", insertErr);
      return new Response(
        JSON.stringify({ error: "Failed to create call log record" }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // ── Make the Bland.ai API call ──
    const maxDuration =
      campaignData?.max_call_duration || 5;
    const transferPhone =
      dealer.voice_ai_transfer_number ||
      campaignData?.transfer_phone ||
      null;
    const voiceId = campaignData?.voice_id || "nat";

    // Append the webhook shared secret so voice-call-webhook can verify
    // the caller. The secret is a Supabase function secret and should
    // match on both sides. Falls back to an unauthenticated URL only if
    // the secret is missing (webhook will then reject the callback).
    const webhookSecret = Deno.env.get("BLAND_WEBHOOK_SECRET") || "";
    const webhookUrl = webhookSecret
      ? `${supabaseUrl}/functions/v1/voice-call-webhook?secret=${encodeURIComponent(webhookSecret)}`
      : `${supabaseUrl}/functions/v1/voice-call-webhook`;

    const blandPayload: Record<string, unknown> = {
      phone_number: customerPhone,
      task: renderedScript,
      voice: voiceId,
      first_sentence: firstSentence,
      wait_for_greeting: true,
      model: "enhanced",
      temperature: 0.5,
      max_duration: maxDuration,
      record: true,
      webhook: webhookUrl,
      request_data: {
        customer_name: submission.name,
        customer_phone: customerPhone,
        vehicle_info: vehicleInfo,
        offer_amount: offerAmount,
        submission_id,
        submission_token: submission.token,
        dealership_id: dealershipId,
        // Exposed in request_data (in addition to metadata) so that
        // in-call tools like `book_appointment` can pass it back to
        // link the resulting appointment to this exact call recording.
        call_log_id: callLog.id,
      },
      metadata: {
        submission_id,
        campaign_id: campaign_id || null,
        call_log_id: callLog.id,
        dealership_id: dealershipId,
      },
    };

    if (transferPhone) {
      blandPayload.transfer_phone_number = transferPhone;
    }

    if (dealer.voice_ai_from_number) {
      blandPayload.from = dealer.voice_ai_from_number;
    }

    console.log(
      `Launching voice call for submission ${submission_id}, call_log ${callLog.id}`
    );

    const blandResponse = await fetch("https://api.bland.ai/v1/calls", {
      method: "POST",
      headers: {
        Authorization: dealer.voice_ai_api_key,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(blandPayload),
    });

    const blandData = await blandResponse.json();

    if (!blandResponse.ok) {
      console.error("Bland.ai API error:", blandResponse.status, blandData);

      // Update call log as failed
      await supabase
        .from("voice_call_log")
        .update({
          status: "failed",
          provider_response: blandData,
        })
        .eq("id", callLog.id);

      return new Response(
        JSON.stringify({
          error: "Bland.ai API error",
          details: blandData,
          call_log_id: callLog.id,
        }),
        {
          status: 502,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // ── Update call log with provider call ID ──
    const providerCallId = blandData.call_id || blandData.id;

    const { data: updatedLog } = await supabase
      .from("voice_call_log")
      .update({
        provider_call_id: providerCallId,
        status: "in_progress",
        started_at: new Date().toISOString(),
        provider_response: blandData,
      })
      .eq("id", callLog.id)
      .select()
      .single();

    console.log(
      `Voice call initiated: call_log=${callLog.id}, provider_call_id=${providerCallId}`
    );

    return new Response(
      JSON.stringify({
        success: true,
        call_log: updatedLog || callLog,
        provider_call_id: providerCallId,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (e) {
    console.error("launch-voice-call error:", e);
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
