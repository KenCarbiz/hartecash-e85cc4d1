/**
 * regrade-golden-set — Golden-100 regression run.
 *
 * Manager taps "Run regression" in the admin Voice Quality panel.
 * This function:
 *
 *   1. Inserts a new voice_grade_runs row (status: started)
 *   2. Selects every voice_call_log id where the most-recent grade
 *      has golden_pinned = true (the golden holdout)
 *   3. For each, invokes voice-call-grade with { call_id, run_id }
 *      so the grader writes a fresh row tagged with the run
 *   4. Calls finalize_voice_grade_run RPC to aggregate avg dim
 *      scores + gating count + composite onto the run row
 *
 * Important: voice-call-grade SKIPS apply_voice_call_outcome when
 * a run_id is set (regrades must not move the bandit) and SKIPS
 * the post-call NPS SMS (we don't ask the customer to re-rate).
 *
 * Auth: requires staff JWT. The admin UI passes the user's bearer
 * token through; this function validates via supabase.auth.getUser.
 *
 * Returns the run summary so the UI can render the result inline.
 *
 * Concurrency: a single run grades each call sequentially with
 * await — at ~3-5 seconds per Claude Sonnet judge call, 100 calls
 * is ~5-10 minutes. We don't parallelize because Anthropic's rate
 * limits punish bursts and the result is needed once, not fast.
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.7";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

interface RegradeRequest {
  run_label?: string;
  rubric_version?: string;
  notes?: string;
  /** When set, only regrade calls that are in this list. Used by
   *  the admin UI's "Re-grade these 5" subset action; null/empty =
   *  the full golden set. */
  call_ids?: string[];
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST")    return new Response("Method not allowed", { status: 405 });

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey  = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  // Validate the caller's JWT — only authenticated staff can fire this.
  const authHeader = req.headers.get("Authorization") || "";
  const userClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: userData } = await userClient.auth.getUser();
  if (!userData?.user) {
    return new Response(JSON.stringify({ ok: false, reason: "unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  let body: RegradeRequest = {};
  try {
    body = await req.json() as RegradeRequest;
  } catch {
    body = {};
  }

  const supabase = createClient(supabaseUrl, serviceKey);

  // 1. Resolve the call set.
  let callIds: string[];
  if (body.call_ids && body.call_ids.length) {
    callIds = body.call_ids.slice(0, 200); // hard cap at 200 to avoid runaway
  } else {
    // Pull every call where the MOST-RECENT (non-run-tagged) grade is
    // golden_pinned. Filtering on run_id IS NULL keeps us looking at
    // the production grade, not a prior regrade.
    const { data: pinned, error: pinErr } = await supabase
      .from("voice_call_grades")
      .select("call_id, created_at")
      .eq("golden_pinned", true)
      .is("run_id", null)
      .order("created_at", { ascending: false });
    if (pinErr) {
      return new Response(JSON.stringify({ ok: false, reason: pinErr.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    // Dedupe by call_id (most-recent grade wins).
    const seen = new Set<string>();
    callIds = [];
    for (const r of pinned || []) {
      if (!seen.has(r.call_id as string)) {
        seen.add(r.call_id as string);
        callIds.push(r.call_id as string);
      }
    }
  }

  if (!callIds.length) {
    return new Response(JSON.stringify({ ok: false, reason: "empty_golden_set" }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // 2. Resolve the most-recent prior run as baseline (if any).
  const { data: priorRun } = await supabase
    .from("voice_grade_runs")
    .select("id")
    .not("finished_at", "is", null)
    .order("started_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  // 3. Create the run row.
  const runLabel = body.run_label?.trim() || `regression ${new Date().toISOString().slice(0, 16)}`;
  const { data: runRow, error: runErr } = await supabase
    .from("voice_grade_runs")
    .insert({
      run_label: runLabel,
      rubric_version: body.rubric_version ?? null,
      notes: body.notes ?? null,
      baseline_run_id: priorRun?.id ?? null,
    })
    .select()
    .single();
  if (runErr || !runRow) {
    return new Response(JSON.stringify({ ok: false, reason: runErr?.message || "run_insert_failed" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  const runId = runRow.id as string;

  // 4. Iterate. Sequential: rate-limit-friendly + the result is needed
  //    once (not latency-critical).
  let succeeded = 0;
  let failed = 0;
  for (const callId of callIds) {
    try {
      const { error: invErr } = await supabase.functions.invoke("voice-call-grade", {
        body: { call_id: callId, run_id: runId },
      });
      if (invErr) {
        failed += 1;
        console.warn("regrade: voice-call-grade failed for", callId, invErr.message);
      } else {
        succeeded += 1;
      }
    } catch (e) {
      failed += 1;
      console.warn("regrade: exception for", callId, e);
    }
  }

  // 5. Aggregate the run's stats.
  await supabase.rpc("finalize_voice_grade_run", { _run_id: runId });

  // 6. Pull the finalized row + baseline row for diff display.
  const { data: finalRun } = await supabase
    .from("voice_grade_runs")
    .select("*")
    .eq("id", runId)
    .single();
  const { data: baseline } = priorRun?.id
    ? await supabase.from("voice_grade_runs").select("*").eq("id", priorRun.id).single()
    : { data: null };

  return new Response(
    JSON.stringify({
      ok: true,
      run: finalRun,
      baseline,
      succeeded,
      failed,
      total: callIds.length,
    }),
    { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
  );
});
