/**
 * process-stuck-voice-calls — cron-invoked retry handler for the
 * voice pipeline.
 *
 * Why this exists: voice-call-enrich + voice-call-grade are
 * fire-and-forget chains. If Whisper / Anthropic / Bland hiccups,
 * the call gets orphaned with no row in voice_call_grades, no NPS
 * SMS, no bandit reward. Reliability audit P0 #3.
 *
 * This function runs on a 5-minute cron schedule:
 *   1. Pull up to 20 voice_pipeline_jobs whose next_retry_at has
 *      passed AND status is non-terminal (pending/enriching/
 *      enriched/grading) AND attempt counters are below the cap.
 *      pickup_stuck_voice_pipeline_jobs RPC atomically marks them
 *      so concurrent runs don't double-pick (FOR UPDATE SKIP LOCKED).
 *   2. For each picked job, dispatch the appropriate next step:
 *        pending / enriching → invoke voice-call-enrich
 *        enriched / grading  → invoke voice-call-grade
 *   3. The downstream function calls mark_voice_pipeline_job with
 *      the new status. If it errors, the cron picks the row up
 *      again on the next pass with exponential backoff (handled by
 *      mark_voice_pipeline_job's next_retry_at calculation).
 *
 * Auth: cron-invoked. Service-role only. The cron schedule itself
 * is registered in 20260509020000_reliability_tier1.sql (... or
 * will be once we add it; this commit ships the function code,
 * the schedule add follows in a small companion migration).
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.7";
import { report } from "../_shared/report.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

interface Job {
  id: string;
  call_id: string;
  status: string;
  enrich_attempts: number;
  grade_attempts: number;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  let attempted = 0;
  let dispatched = 0;
  let abandoned = 0;
  let errors = 0;

  try {
    const { data: jobs, error: pickErr } = await supabase.rpc(
      "pickup_stuck_voice_pipeline_jobs",
      { _limit: 20 },
    );

    if (pickErr) {
      await report("process-stuck-voice-calls", pickErr, { stage: "pickup" });
      return new Response(
        JSON.stringify({ ok: false, reason: "pickup_failed" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const list = (jobs as Job[]) || [];
    attempted = list.length;

    for (const job of list) {
      try {
        // Abandon after 5 attempts at either stage.
        if (job.enrich_attempts >= 5 || job.grade_attempts >= 5) {
          await supabase.rpc("mark_voice_pipeline_job", {
            _call_id: job.call_id,
            _status: "failed",
            _bump: null,
            _error: "max_attempts_exceeded",
          });
          await report("process-stuck-voice-calls",
            "abandoning call after max retry attempts",
            { call_id: job.call_id,
              enrich_attempts: job.enrich_attempts,
              grade_attempts: job.grade_attempts },
            "warning");
          abandoned += 1;
          continue;
        }

        // Dispatch by current status.
        const target = (job.status === "pending" || job.status === "enriching")
          ? "voice-call-enrich"
          : "voice-call-grade";

        const { error: invokeErr } = await supabase.functions.invoke(target, {
          body: { call_id: job.call_id },
        });

        if (invokeErr) {
          await supabase.rpc("mark_voice_pipeline_job", {
            _call_id: job.call_id,
            _status: target === "voice-call-enrich" ? "enriching" : "grading",
            _bump:   target === "voice-call-enrich" ? "enrich"     : "grade",
            _error:  invokeErr.message?.slice(0, 1000) || "invoke_failed",
          });
          await report("process-stuck-voice-calls", invokeErr, {
            call_id: job.call_id,
            target,
          }, "warning");
          errors += 1;
        } else {
          // The downstream function flips the job to enriched/graded
          // itself via its mark_voice_pipeline_job call. We don't
          // need to record success here.
          dispatched += 1;
        }
      } catch (jobErr) {
        await report("process-stuck-voice-calls", jobErr, {
          call_id: job.call_id,
        }, "error");
        errors += 1;
      }
    }

    return new Response(
      JSON.stringify({ ok: true, attempted, dispatched, abandoned, errors }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    await report("process-stuck-voice-calls", e, { stage: "outer" }, "fatal");
    return new Response(
      JSON.stringify({ ok: false, reason: "fatal" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
