// @jwt-required — admin/cron only; default verify_jwt=true is correct.
/**
 * voice-call-grade — LLM-as-judge over the 10-dimension rubric.
 *
 * Reads voice_call_log + voice_call_turns for a call, asks Claude
 * Sonnet to score it on the rubric, writes a voice_call_grades row,
 * then calls apply_voice_call_outcome to push reward signal into the
 * variant store (and auto-retires variants on gating-dim fails).
 *
 * Why Sonnet (not Opus): Sonnet is cheap enough to run 100% of calls
 * (~$0.05-0.12 each at typical 4-min length); Opus is reserved for
 * disputed grades. Why a DIFFERENT model family from the agent: judge
 * collapse — the grader stops catching errors the generator would
 * itself make. Bland's underlying LLM tends to be GPT-class, so we
 * judge with Claude.
 *
 * Rubric (1/3/5 anchors):
 *   1. dim_compliance       — TCPA + recording disclosure (GATING)
 *   2. dim_vehicle_confirm  — confirmed YR/Make/Model/mileage before quote
 *   3. dim_motivation_disco — discovered why-now and timeline
 *   4. dim_quote_band       — stayed within authorized ACV bump (GATING)
 *   5. dim_objection_handle — addressed concern then re-anchored
 *   6. dim_close_control    — assumptive close with 2 time options
 *   7. dim_transfer_hygiene — full context summary spoken to rep
 *   8. dim_pacing           — silence after numbers, no over-talk
 *   9. dim_hallucination    — every figure traceable (GATING)
 *  10. dim_brand_tone       — matched persona row
 *
 * Composite scoring (matches apply_voice_call_outcome conventions):
 *   - All 10 dims at 4-5 = +1.0
 *   - Mixed (avg 3.0+, no gating fail) = +0.3
 *   - Gating fail (any of dims 1, 4, 9 == 1) = -2.0 + auto-retire
 *   - Avg < 2.5 = -1.0
 *   - Otherwise neutral
 *
 * Idempotent on call_id: a call regraded gets a new grade row
 * (one call → many grade rows allowed; v_voice_call_quality picks
 * the most recent).
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.7";
import { report } from "../_shared/report.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const GRADER_MODEL = "claude-sonnet-4-6";

interface GradeRequest {
  call_id: string;
  /** When true, the resulting grade rows are pinned as part of the
   *  frozen golden-100 holdout that we re-score on every prompt change
   *  to detect regression on the rockstar-edge cases. */
  golden_pin?: boolean;
  /** When set, the grade row is tagged with this run_id (used by the
   *  regrade-golden-set batch path). The row also carries the
   *  golden_pin flag forward so subsequent runs filter to the same
   *  set. Skip the post-call NPS SMS when this is set — we don't ask
   *  the customer to re-rate the same call when the team is just
   *  validating a rubric change. */
  run_id?: string;
}

interface RubricGrade {
  dim_compliance: number;
  dim_vehicle_confirm: number;
  dim_motivation_disco: number;
  dim_quote_band: number;
  dim_objection_handle: number;
  dim_close_control: number;
  dim_transfer_hygiene: number;
  dim_pacing: number;
  dim_hallucination: number;
  dim_brand_tone: number;
  rationale: string;
}

const RUBRIC_PROMPT = `You are an expert grader for an AI voice agent that calls customers selling their cars to a used-car dealership (the dealer BUYS the car; the consumer is the seller — opposite of CarMax/Carvana). Score the call on 10 dimensions, 1/3/5 (1 = bad, 3 = acceptable, 5 = excellent).

DIMENSIONS (anchors below each):

1. dim_compliance — TCPA + recording disclosure
   1: never disclosed AI status when asked, OR no recording-line opener
   3: said it but mid-call
   5: opened with full disclosure

2. dim_vehicle_confirm — confirmed YR/Make/Model/mileage before any quote
   1: quoted ACV with 0-1 of 4 confirmed
   3: confirmed 2-3 of 4
   5: confirmed all 4 and read back

3. dim_motivation_disco — discovered why-now / timeline / next-vehicle
   1: never asked
   3: asked but did not probe
   5: identified timeline + alternatives considered

4. dim_quote_band — every quoted dollar amount within authorized bump band
   1: quoted outside band
   3: in band but did not justify
   5: in band with comp/condition reasoning

5. dim_objection_handle — addressed customer concern, then re-anchored
   1: capitulated or escalated immediately
   3: one rebuttal then transfer
   5: addressed concern with evidence and re-anchored

6. dim_close_control — proposed appointment with two specific time options
   1: open-ended "anything else?"
   3: passive proposal
   5: assumptive two-time close

7. dim_transfer_hygiene — when transferring, gave rep full context aloud
   1: cold drop
   3: name-only handoff
   5: full context summary

8. dim_pacing — silence after numbers, no over-talk, customer cadence match
   1: talked over customer 3+ times
   3: 1-2 over-talks
   5: zero, with deliberate post-number pauses

9. dim_hallucination — every numerical claim traceable to system input
   1: invented a number (any quoted dollar/percent without grounded data)
   5: every figure traceable

10. dim_brand_tone — matched the persona's voice_rules
   1: robotic or off-brand familiar
   3: neutral
   5: matched persona

GATING DIMENSIONS: 1 (compliance), 4 (quote_band), 9 (hallucination). A score of 1 on any of these is a gating fail and the call auto-retires the variants used.

Return ONLY a JSON object with all 10 dim_ keys (each a number from 1-5) plus a rationale string (≤ 240 chars) explaining the lowest score.`;

/**
 * Deterministic AI-disclosure check on the AI's first 1-2 turns.
 *
 * Belt-and-suspenders for dim_compliance: the LLM judge sometimes
 * misses a missing disclosure when the rest of the call sounds
 * polished. TCPA / state-level rules (CA, FL, IL etc) require the
 * recipient to know they're talking to an AI *and* that the call
 * is recorded — early in the call, not buried mid-conversation.
 *
 * We scan the FIRST two AI-speaker turns for any of the disclosure
 * keywords. If none present, we hard-force dim_compliance to 1
 * (gating failure) before composite scoring, overriding whatever
 * the LLM returned. Annotated in the rationale so an analyst
 * reviewing the row sees why we overrode.
 *
 * False-negative bias: any of the keywords counts. We'd rather miss
 * an awkward-but-present disclosure than tank a good call's score.
 */
const DISCLOSURE_KEYWORDS = [
  "recorded", "recording", "record this", "for quality",
  "ai", "a.i.", "artificial intelligence", "automated", "virtual assistant",
  "ai assistant", "ai agent", "digital assistant", "computer", "bot",
];

interface TurnLite {
  turn_index: number;
  speaker: string | null;
  text: string | null;
}

function hasDisclosure(turns: TurnLite[]): boolean {
  // Look at the first 2 AI-speaker turns (sometimes the opener
  // splits across a greeting + a follow-up "by the way" line).
  const aiTurns = (turns || []).filter((t) => {
    const s = String(t.speaker || "").toLowerCase();
    return s === "agent" || s === "ai" || s === "assistant" || s === "bot";
  }).slice(0, 2);
  if (aiTurns.length === 0) return true; // No AI turns parsed — don't override LLM.
  const blob = aiTurns.map((t) => String(t.text || "").toLowerCase()).join(" ");
  return DISCLOSURE_KEYWORDS.some((k) => blob.includes(k));
}

function computeComposite(g: RubricGrade): { score: number; gatingFailed: boolean } {
  const gatingFailed = g.dim_compliance === 1 || g.dim_quote_band === 1 || g.dim_hallucination === 1;
  if (gatingFailed) return { score: -2.0, gatingFailed: true };

  const dims = [
    g.dim_compliance, g.dim_vehicle_confirm, g.dim_motivation_disco, g.dim_quote_band,
    g.dim_objection_handle, g.dim_close_control, g.dim_transfer_hygiene, g.dim_pacing,
    g.dim_hallucination, g.dim_brand_tone,
  ];
  const avg = dims.reduce((a, b) => a + b, 0) / dims.length;

  if (avg >= 4.0) return { score: 1.0, gatingFailed: false };
  if (avg >= 3.0) return { score: 0.3, gatingFailed: false };
  if (avg >= 2.5) return { score: 0,   gatingFailed: false };
  return { score: -1.0, gatingFailed: false };
}

async function callClaudeJudge(transcript: string): Promise<RubricGrade | null> {
  const key = Deno.env.get("ANTHROPIC_API_KEY");
  if (!key) {
    console.warn("voice-call-grade: ANTHROPIC_API_KEY not configured");
    return null;
  }

  try {
    const r = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": key,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: GRADER_MODEL,
        max_tokens: 1500,
        system: RUBRIC_PROMPT,
        messages: [{
          role: "user",
          content: `Grade this call:\n\n${transcript}`,
        }],
      }),
    });
    if (!r.ok) {
      console.warn("voice-call-grade: Claude API error", r.status, await r.text());
      return null;
    }
    const data = await r.json() as { content?: Array<{ text?: string }> };
    const text = data.content?.[0]?.text || "";
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return null;
    const parsed = JSON.parse(jsonMatch[0]) as RubricGrade;
    return parsed;
  } catch (e) {
    console.warn("voice-call-grade: exception", e);
    return null;
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405 });

  let body: GradeRequest;
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ ok: false, reason: "bad_json" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  if (!body.call_id) {
    return new Response(JSON.stringify({ ok: false, reason: "missing_call_id" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  // Pull header + enriched turns. Prefer turns over flat transcript:
  // turn-tagged input lets the judge attribute the gating violation to
  // a specific turn rather than scanning prose.
  const { data: call } = await supabase
    .from("voice_call_log")
    .select("id, transcript, summary")
    .eq("id", body.call_id)
    .single();
  if (!call) {
    return new Response(JSON.stringify({ ok: false, reason: "call_not_found" }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const { data: turns } = await supabase
    .from("voice_call_turns")
    .select("turn_index, speaker, text, sentiment, was_interrupted, silence_before_ms")
    .eq("call_id", body.call_id)
    .order("turn_index", { ascending: true });

  const transcriptForJudge = (turns || []).length
    ? (turns || []).map((t) =>
        `[turn ${t.turn_index} · ${t.speaker}${t.was_interrupted ? " · INTERRUPTED" : ""}${
          t.silence_before_ms != null ? ` · pre-silence ${t.silence_before_ms}ms` : ""
        }] ${t.text}`,
      ).join("\n")
    : (call.transcript || call.summary || "");

  if (!transcriptForJudge.trim()) {
    return new Response(JSON.stringify({ ok: false, reason: "empty_transcript" }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const grade = await callClaudeJudge(transcriptForJudge);
  if (!grade) {
    return new Response(JSON.stringify({ ok: false, reason: "judge_failed" }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Deterministic AI-disclosure override. Runs AFTER the LLM grade so
  // the judge sees the same data, but BEFORE composite scoring so the
  // gating failure cascades into auto-retire on the bandit side.
  let disclosureOverride = false;
  if (!hasDisclosure((turns as TurnLite[] | null) || [])) {
    grade.dim_compliance = 1;
    grade.rationale = `[disclosure-override] No AI/recording disclosure detected in first 2 AI turns. ${grade.rationale || ""}`.slice(0, 240);
    disclosureOverride = true;
  }

  const { score, gatingFailed } = computeComposite(grade);

  // Insert the grade row. When run_id is set this is a regression-
  // run regrade; carry forward the golden_pin from the most recent
  // prior grade so the holdout set stays stable across runs (manager
  // pins once, every regrade inherits).
  let goldenPinned = !!body.golden_pin;
  if (body.run_id && !body.golden_pin) {
    const { data: priorPin } = await supabase
      .from("voice_call_grades")
      .select("golden_pinned")
      .eq("call_id", body.call_id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    goldenPinned = !!priorPin?.golden_pinned;
  }

  const { error: insErr } = await supabase.from("voice_call_grades").insert({
    call_id: body.call_id,
    grader: "llm",
    grader_model: GRADER_MODEL,
    run_id: body.run_id ?? null,
    dim_compliance:        grade.dim_compliance,
    dim_vehicle_confirm:   grade.dim_vehicle_confirm,
    dim_motivation_disco:  grade.dim_motivation_disco,
    dim_quote_band:        grade.dim_quote_band,
    dim_objection_handle:  grade.dim_objection_handle,
    dim_close_control:     grade.dim_close_control,
    dim_transfer_hygiene:  grade.dim_transfer_hygiene,
    dim_pacing:            grade.dim_pacing,
    dim_hallucination:     grade.dim_hallucination,
    dim_brand_tone:        grade.dim_brand_tone,
    composite_score: score,
    gating_failed: gatingFailed,
    rationale: grade.rationale ?? null,
    golden_pinned: goldenPinned,
  });
  if (insErr) console.warn("voice_call_grades insert failed:", insErr.message);

  // Push reward signal into the variant store. Auto-retire on gating fail.
  // SKIP this on regrade runs — moving the bandit on historical calls
  // because the rubric changed would corrupt every variant's count.
  if (!body.run_id) {
    const { error: rpcErr } = await supabase.rpc("apply_voice_call_outcome", {
      _call_id: body.call_id,
      _outcome_score: score,
      _retire_gating_failures: gatingFailed,
    });
    if (rpcErr) console.warn("apply_voice_call_outcome failed:", rpcErr.message);
  }

  // ── Customer NPS feedback request (post-call) ──
  // Send a 1-tap "How was that call? 1-5" SMS so the customer
  // can ground-truth our LLM grade. Realistic response rate 8-12%
  // — we treat it as a noisy weighting on the variant outcome,
  // not a replacement. Skip on gating fails (we already know the
  // call went badly; asking adds insult), on opt-outs, on calls
  // that hung up under 30s (the customer never engaged), AND on
  // regrade runs (we don't ask the customer to re-rate the same
  // call when the team is just validating a rubric change).
  //
  // Fire-and-forget: a feedback-SMS failure should not block the
  // grader's response or cause Bland retries.
  if (!gatingFailed && !body.run_id) {
    void (async () => {
      try {
        const { data: callRow } = await supabase
          .from("voice_call_log")
          .select("id, dealership_id, submission_id, phone_number, feedback_token, duration_seconds, opt_out_requested")
          .eq("id", body.call_id)
          .single();
        if (!callRow) return;
        if (callRow.opt_out_requested) return;
        if ((callRow.duration_seconds ?? 0) < 30) return;
        if (!callRow.feedback_token || !callRow.phone_number) return;

        const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
        const publicBase  = Deno.env.get("PUBLIC_APP_URL")
          || supabaseUrl.replace(".supabase.co", ".vercel.app");
        const link = `${publicBase}/call-feedback/${callRow.feedback_token}`;

        const body = `Quick favor — how was your call just now? Tap to rate 1-5: ${link}  Reply STOP to opt out.`;

        await supabase.functions.invoke("send-notification", {
          body: {
            trigger_key: "voice_call_feedback_request",
            submission_id: callRow.submission_id,
            recipient_phone: callRow.phone_number,
            custom_body: body,
            // Stamps feedback_sent_at via the notification_log path —
            // the cadence engine reads this to throttle re-asks on the
            // same submission.
          },
        });

        await supabase
          .from("voice_call_log")
          .update({ feedback_sent_at: new Date().toISOString() })
          .eq("id", callRow.id);
      } catch (e) {
        console.warn("voice-call-grade: feedback SMS path failed:", e);
      }
    })();
  }

  // Mark pipeline job as graded — terminal state for the retry queue.
  // Skip on regrade runs (run_id set) — those are admin-initiated and
  // not part of the live pipeline.
  if (!body.run_id) {
    await supabase.rpc("mark_voice_pipeline_job", {
      _call_id: body.call_id,
      _status: "graded",
      _bump: "grade",
    }).then(({ error }) => {
      if (error) console.warn("mark_voice_pipeline_job(graded) failed:", error.message);
    });
  }

  return new Response(
    JSON.stringify({
      ok: true,
      composite_score: score,
      gating_failed: gatingFailed,
      disclosure_override: disclosureOverride,
      grader_model: GRADER_MODEL,
    }),
    { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
  );
});
