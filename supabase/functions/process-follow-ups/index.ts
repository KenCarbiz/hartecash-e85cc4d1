import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

/**
 * Cron-triggered function that checks for submissions needing automated follow-ups.
 * 
 * Schedule:
 * - Touch 1: Day 2 after submission (gentle nudge)
 * - Touch 2: Day 5 after submission (value add — upload photos)
 * - Touch 3: Day 7 after submission (last chance before expiration)
 * 
 * Only sends to submissions that:
 * - Have an offer (offered_price or estimated_offer_high)
 * - Are not in completed stages (price_agreed, purchase_complete)
 * - Haven't already received that touch
 * - Have not scheduled an appointment
 */

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const TOUCH_SCHEDULE: Record<number, number> = {
  1: 2,  // Day 2
  2: 5,  // Day 5
  3: 7,  // Day 7
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const now = new Date();
    const results: Array<{ submission_id: string; touch: number; result: string }> = [];

    // Process each touch level
    for (const [touchStr, daysAfter] of Object.entries(TOUCH_SCHEDULE)) {
      const touch = parseInt(touchStr);
      const cutoffDate = new Date(now.getTime() - daysAfter * 24 * 60 * 60 * 1000);
      const maxDate = new Date(now.getTime() - (daysAfter - 1) * 24 * 60 * 60 * 1000);

      // Find eligible submissions:
      // - Created before cutoff (at least N days ago)
      // - Created after maxDate (not too old — within 1 day window to avoid re-processing)
      // - Has an offer
      // - Not in completed status
      // - Not already sent this touch
      const { data: submissions, error: subErr } = await supabase
        .from("submissions")
        .select("id, progress_status, offered_price, estimated_offer_high, appointment_set")
        .lte("created_at", cutoffDate.toISOString())
        .gte("created_at", maxDate.toISOString())
        .not("progress_status", "in", '("price_agreed","purchase_complete","dead_lead")')
        .eq("appointment_set", false);

      if (subErr) {
        console.error(`Error fetching submissions for touch ${touch}:`, subErr);
        continue;
      }

      if (!submissions || submissions.length === 0) continue;

      // Filter to those with offers
      const withOffers = submissions.filter(
        (s) => s.offered_price || s.estimated_offer_high
      );

      for (const sub of withOffers) {
        // Check if already sent
        const { data: existing } = await supabase
          .from("follow_ups")
          .select("id")
          .eq("submission_id", sub.id)
          .eq("touch_number", touch)
          .eq("status", "sent");

        if (existing && existing.length > 0) continue;

        // Invoke the send-follow-up function
        try {
          const fnUrl = `${supabaseUrl}/functions/v1/send-follow-up`;
          const res = await fetch(fnUrl, {
            method: "POST",
            headers: {
              Authorization: `Bearer ${supabaseKey}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              submission_id: sub.id,
              touch_number: touch,
              triggered_by: "auto",
            }),
          });
          const data = await res.json();
          results.push({ submission_id: sub.id, touch, result: JSON.stringify(data) });
        } catch (e) {
          console.error(`Error sending follow-up for ${sub.id} touch ${touch}:`, e);
          results.push({ submission_id: sub.id, touch, result: `error: ${String(e)}` });
        }
      }
    }

    console.log(`Processed ${results.length} follow-ups`);

    return new Response(JSON.stringify({ success: true, processed: results.length, results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("process-follow-ups error:", e);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
