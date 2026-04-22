import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

/**
 * ZIP-code prefix to IANA timezone mapping for calling-hours checks.
 */
const ZIP_TO_TIMEZONE: Record<string, string> = {
  "0": "America/New_York",
  "1": "America/New_York",
  "2": "America/New_York",
  "3": "America/New_York",
  "4": "America/Chicago",
  "5": "America/Chicago",
  "6": "America/Chicago",
  "7": "America/Chicago",
  "8": "America/Denver",
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
    return "12:00";
  }
}

function isWithinCallingHours(
  currentTime: string,
  start: string,
  end: string
): boolean {
  return currentTime >= start && currentTime < end;
}

interface CampaignResult {
  campaign_id: string;
  campaign_name: string;
  total_queued: number;
  skipped_opt_out: number;
  skipped_hours: number;
  skipped_already_called: number;
  skipped_no_phone: number;
  errors: number;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json().catch(() => ({}));
    const { campaign_id, dealership_id } = body;

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // ── Fetch active campaigns ──
    let campaignQuery = supabase
      .from("voice_campaigns")
      .select("*")
      .eq("status", "active");

    if (campaign_id) {
      campaignQuery = supabase
        .from("voice_campaigns")
        .select("*")
        .eq("id", campaign_id);
    } else if (dealership_id) {
      campaignQuery = campaignQuery.eq("dealership_id", dealership_id);
    }

    const { data: campaigns, error: campErr } = await campaignQuery;

    if (campErr) {
      console.error("Failed to fetch campaigns:", campErr);
      return new Response(
        JSON.stringify({ error: "Failed to fetch campaigns" }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    if (!campaigns || campaigns.length === 0) {
      return new Response(
        JSON.stringify({
          success: true,
          message: "No active campaigns found",
          results: [],
        }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const allResults: CampaignResult[] = [];

    for (const campaign of campaigns) {
      const result: CampaignResult = {
        campaign_id: campaign.id,
        campaign_name: campaign.name,
        total_queued: 0,
        skipped_opt_out: 0,
        skipped_hours: 0,
        skipped_already_called: 0,
        skipped_no_phone: 0,
        errors: 0,
      };

      console.log(`Processing campaign: ${campaign.name} (${campaign.id})`);

      // ── Check how many calls already made today for this campaign ──
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);

      const { count: todayCallCount } = await supabase
        .from("voice_call_log")
        .select("id", { count: "exact", head: true })
        .eq("campaign_id", campaign.id)
        .gte("created_at", todayStart.toISOString());

      const maxCallsPerDay = campaign.max_calls_per_day || 50;
      const remainingCalls = maxCallsPerDay - (todayCallCount || 0);

      if (remainingCalls <= 0) {
        console.log(
          `Campaign ${campaign.name}: daily limit reached (${maxCallsPerDay})`
        );
        allResults.push(result);
        continue;
      }

      // ── Build target criteria query ──
      const criteria = campaign.target_criteria || {};
      const targetStatus: string[] = criteria.status || [
        "new",
        "offer_made",
      ];
      const minDaysOld: number = criteria.min_days_old ?? 2;
      const maxDaysOld: number = criteria.max_days_old ?? 30;
      const noCallWithinDays: number = criteria.no_call_within_days ?? 7;

      const now = new Date();
      const minDate = new Date(
        now.getTime() - maxDaysOld * 24 * 60 * 60 * 1000
      );
      const maxDate = new Date(
        now.getTime() - minDaysOld * 24 * 60 * 60 * 1000
      );

      // Fetch eligible submissions
      let submissionQuery = supabase
        .from("submissions")
        .select(
          "id, name, phone, email, zip, vehicle_year, vehicle_make, vehicle_model, offered_price, progress_status, dealership_id, created_at"
        )
        .eq("dealership_id", campaign.dealership_id)
        .in("progress_status", targetStatus)
        .gte("created_at", minDate.toISOString())
        .lte("created_at", maxDate.toISOString())
        .limit(remainingCalls * 3); // fetch more than needed to account for skips

      const { data: submissions, error: subErr } = await submissionQuery;

      if (subErr) {
        console.error(
          `Error fetching submissions for campaign ${campaign.id}:`,
          subErr
        );
        result.errors++;
        allResults.push(result);
        continue;
      }

      if (!submissions || submissions.length === 0) {
        console.log(`Campaign ${campaign.name}: no eligible submissions found`);
        allResults.push(result);
        continue;
      }

      // ── Fetch opt-outs for batch checking ──
      const phones = submissions
        .map((s) => s.phone)
        .filter(Boolean) as string[];

      const { data: optOuts } = await supabase
        .from("opt_outs")
        .select("phone, email")
        .in("channel", ["phone", "voice", "all"])
        .in("phone", phones.length > 0 ? phones : ["__none__"]);

      const optOutPhones = new Set(
        (optOuts || []).map((o) => o.phone).filter(Boolean)
      );

      // ── Fetch recent calls to avoid re-calling ──
      const noCallSince = new Date(
        now.getTime() - noCallWithinDays * 24 * 60 * 60 * 1000
      );

      const submissionIds = submissions.map((s) => s.id);

      const { data: recentCalls } = await supabase
        .from("voice_call_log")
        .select("submission_id")
        .in("submission_id", submissionIds)
        .gte("created_at", noCallSince.toISOString());

      const recentlyCalledIds = new Set(
        (recentCalls || []).map((c) => c.submission_id)
      );

      // ── Process each submission ──
      let queued = 0;
      const callingStart = campaign.calling_hours_start || "09:00";
      const callingEnd = campaign.calling_hours_end || "18:00";

      for (const sub of submissions) {
        if (queued >= remainingCalls) break;

        // Skip: no phone
        if (!sub.phone) {
          result.skipped_no_phone++;
          continue;
        }

        // Skip: opted out
        if (optOutPhones.has(sub.phone)) {
          result.skipped_opt_out++;
          continue;
        }

        // Skip: already called recently
        if (recentlyCalledIds.has(sub.id)) {
          result.skipped_already_called++;
          continue;
        }

        // Skip: outside calling hours for customer's timezone
        const customerTz = getTimezoneFromZip(sub.zip);
        const currentLocalTime = getCurrentTimeInTz(customerTz);
        if (
          !isWithinCallingHours(currentLocalTime, callingStart, callingEnd)
        ) {
          result.skipped_hours++;
          continue;
        }

        // ── Send warm-up SMS ──
        if (sub.phone) {
          await supabase.functions.invoke("send-notification", {
            body: {
              trigger_key: "voice_warmup_sms",
              submission_id: sub.id,
            }
          }).catch(() => {});

          // Brief delay to let SMS arrive before call
          await new Promise(r => setTimeout(r, 3000));
        }

        // ── Launch the call ──
        try {
          const fnUrl = `${supabaseUrl}/functions/v1/launch-voice-call`;
          const callRes = await fetch(fnUrl, {
            method: "POST",
            headers: {
              Authorization: `Bearer ${supabaseKey}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              submission_id: sub.id,
              campaign_id: campaign.id,
            }),
          });

          const callData = await callRes.json();

          if (callRes.ok && callData.success) {
            queued++;
            result.total_queued++;
            console.log(
              `Queued call for submission ${sub.id}: ${callData.provider_call_id}`
            );
          } else {
            // Check if it was a legitimate skip (opt-out, hours, etc.)
            const errMsg = callData.error || "";
            if (errMsg.includes("opted out")) {
              result.skipped_opt_out++;
            } else if (errMsg.includes("calling hours")) {
              result.skipped_hours++;
            } else {
              result.errors++;
              console.error(
                `Failed to launch call for ${sub.id}:`,
                callData.error
              );
            }
          }
        } catch (e) {
          result.errors++;
          console.error(`Error launching call for ${sub.id}:`, e);
        }
      }

      console.log(
        `Campaign ${campaign.name} results: queued=${result.total_queued}, skipped_opt_out=${result.skipped_opt_out}, skipped_hours=${result.skipped_hours}, skipped_already_called=${result.skipped_already_called}`
      );

      allResults.push(result);
    }

    // ── Aggregate totals ──
    const summary = {
      campaigns_processed: allResults.length,
      total_queued: allResults.reduce((s, r) => s + r.total_queued, 0),
      total_skipped_opt_out: allResults.reduce(
        (s, r) => s + r.skipped_opt_out,
        0
      ),
      total_skipped_hours: allResults.reduce(
        (s, r) => s + r.skipped_hours,
        0
      ),
      total_skipped_already_called: allResults.reduce(
        (s, r) => s + r.skipped_already_called,
        0
      ),
      total_errors: allResults.reduce((s, r) => s + r.errors, 0),
    };

    console.log("Campaign run summary:", JSON.stringify(summary));

    return new Response(
      JSON.stringify({
        success: true,
        summary,
        results: allResults,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (e) {
    console.error("run-voice-campaign error:", e);
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
