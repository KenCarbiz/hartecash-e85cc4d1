/**
 * voice-call-enrich — post-call enrichment pipeline.
 *
 * Triggered by voice-call-webhook after a Bland call_completed event
 * fires (fire-and-forget so the webhook stays fast). Reads the call
 * transcript + recording, produces:
 *
 *   1. voice_call_turns rows (one per turn) with per-turn sentiment,
 *      silence_before_ms, was_interrupted, asr_confidence.
 *   2. A single customer_memory item (the "rockstar" personal-detail
 *      hook the next call will reference within its first 20 seconds).
 *
 * Why this exists: voice_call_log alone cannot train the AI. Bland's
 * webhook gives us a flat transcript and a summary — the signals that
 * separate a top-rep call from a junior-rep call live BETWEEN the
 * turns (silences, barge-ins, sentiment shifts, latency). This function
 * pulls those out, keyed on the same call_id so a grader and a manager
 * can drill from a single timeline view.
 *
 * Tolerant by design:
 *   - Works with Bland's flat transcript when no recording URL.
 *   - Re-ASRs with OpenAI Whisper when OPENAI_API_KEY is set AND a
 *     recording_url is available — produces word-level timestamps
 *     that drive accurate silence_before_ms and turn boundaries.
 *   - Sentiment via Claude Haiku (cheap; ~$0.001/call).
 *   - Memory extraction is a SEPARATE Claude call so a sentiment
 *     failure doesn't block memory and vice-versa.
 *
 * Idempotent on call_id: every run wipes the prior voice_call_turns
 * rows for that call_id before inserting fresh ones, so re-running
 * after fixing a bug gives a clean state.
 *
 * Auth: invoked from voice-call-webhook with the service role JWT.
 * Not exposed to anon/authenticated.
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.7";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

interface EnrichRequest {
  call_id: string;
}

interface ParsedTurn {
  index: number;
  speaker: "ai" | "customer" | "unknown";
  text: string;
  start_ms?: number;
  end_ms?: number;
  asr_confidence?: number;
}

interface SentimentLabel {
  index: number;
  sentiment: "positive" | "neutral" | "negative" | "mixed";
  sentiment_score: number;       // -1 to 1
  emotion_top?: string;
  emotion_score?: number;
  matched_signal_key?: string;   // the customer_signals row this turn matched, if any
}

/**
 * Parse Bland's flat transcript into per-turn rows. Bland's format
 * varies — most often "Agent: ...\nUser: ..." or speaker-labeled JSON
 * lines. Handle both.
 */
function parseBlandTranscript(raw: string | null): ParsedTurn[] {
  if (!raw) return [];
  const text = raw.trim();
  if (!text) return [];

  // Try line-based "Speaker: text" first.
  const lines = text.split(/\r?\n/).filter((l) => l.trim());
  const out: ParsedTurn[] = [];
  let idx = 0;
  for (const line of lines) {
    const m = line.match(/^\s*(agent|assistant|ai|bot|user|customer|caller|human)\s*:\s*(.*)$/i);
    if (m) {
      const speakerRaw = m[1].toLowerCase();
      const speaker: ParsedTurn["speaker"] =
        speakerRaw.startsWith("user") || speakerRaw === "customer" || speakerRaw === "caller" || speakerRaw === "human"
          ? "customer"
          : "ai";
      out.push({ index: idx++, speaker, text: m[2].trim() });
    } else if (out.length > 0) {
      // Continuation of previous turn (multi-line content).
      out[out.length - 1].text += " " + line.trim();
    }
  }
  return out;
}

/**
 * Optional: re-ASR with OpenAI Whisper for word-level timestamps.
 * Runs only when OPENAI_API_KEY is set AND recording_url is reachable.
 * Returns null on any failure — caller falls back to flat-transcript turns.
 */
async function whisperReASR(recordingUrl: string): Promise<ParsedTurn[] | null> {
  const key = Deno.env.get("OPENAI_API_KEY");
  if (!key) return null;

  try {
    // Pull the audio.
    const audioResp = await fetch(recordingUrl);
    if (!audioResp.ok) {
      console.warn("whisper: recording fetch failed", audioResp.status);
      return null;
    }
    const audioBlob = await audioResp.blob();

    const form = new FormData();
    form.append("file", audioBlob, "call.mp3");
    form.append("model", "whisper-1");
    form.append("response_format", "verbose_json");
    form.append("timestamp_granularities[]", "segment");

    const r = await fetch("https://api.openai.com/v1/audio/transcriptions", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}` },
      body: form,
    });
    if (!r.ok) {
      console.warn("whisper: API error", r.status, await r.text());
      return null;
    }
    const data = await r.json() as {
      segments?: Array<{ id: number; start: number; end: number; text: string; avg_logprob?: number; no_speech_prob?: number }>;
    };
    if (!data.segments || !data.segments.length) return null;

    // Whisper-1 doesn't diarize. We mark every segment "unknown" and
    // let the flat-transcript pass set speakers. The benefit here is
    // accurate timestamps + per-segment confidence (avg_logprob → 0-1).
    return data.segments.map((s, i) => ({
      index: i,
      speaker: "unknown" as const,
      text: s.text.trim(),
      start_ms: Math.round(s.start * 1000),
      end_ms: Math.round(s.end * 1000),
      asr_confidence: typeof s.avg_logprob === "number"
        // logprob to confidence: clamp & shift. -0 = perfect; -1 = ~37%
        ? Math.max(0, Math.min(1, Math.exp(s.avg_logprob)))
        : undefined,
    }));
  } catch (e) {
    console.warn("whisper: exception", e);
    return null;
  }
}

/**
 * Merge Whisper segments (timing + confidence, no diarization) with
 * Bland's flat transcript (diarization, no timing) when both are
 * available. The merge is by greedy order — segment N's speaker is
 * inferred from line N of the flat transcript.
 *
 * If lengths differ wildly (>30%) we return Whisper-only with
 * speaker='unknown' rather than misattribute.
 */
function mergeTurns(whisper: ParsedTurn[] | null, flat: ParsedTurn[]): ParsedTurn[] {
  if (!whisper) return flat;
  if (!flat.length) return whisper;
  const ratio = whisper.length / flat.length;
  if (ratio < 0.7 || ratio > 1.4) return whisper;
  return whisper.map((w, i) => ({
    ...w,
    speaker: flat[i]?.speaker || w.speaker,
  }));
}

/**
 * Compute silence_before_ms (gap from prior turn end) and was_interrupted
 * (this turn's start < prior turn's end → overlap → barge-in).
 */
function annotateTiming(turns: ParsedTurn[]): Array<ParsedTurn & {
  silence_before_ms?: number;
  was_interrupted?: boolean;
  total_token_ms?: number;
}> {
  return turns.map((t, i) => {
    if (i === 0) return { ...t, silence_before_ms: 0, was_interrupted: false };
    const prev = turns[i - 1];
    if (t.start_ms == null || prev.end_ms == null) {
      return { ...t, silence_before_ms: undefined, was_interrupted: undefined };
    }
    const gap = t.start_ms - prev.end_ms;
    return {
      ...t,
      silence_before_ms: Math.max(0, gap),
      was_interrupted: gap < -200, // 200ms tolerance for ASR jitter
      total_token_ms: t.end_ms != null ? t.end_ms - t.start_ms : undefined,
    };
  });
}

/**
 * Sentiment + emotion + signal-match per turn, in a single Claude call.
 * Cheap: Haiku at ~$1/M input. Returns one label per turn or [] on failure.
 */
async function gradeSentiment(
  turns: ParsedTurn[],
  signalKeys: string[],
): Promise<SentimentLabel[]> {
  const key = Deno.env.get("ANTHROPIC_API_KEY");
  if (!key || !turns.length) return [];

  const transcript = turns
    .map((t) => `[${t.index}] ${t.speaker}: ${t.text}`)
    .join("\n");

  const prompt = `You are grading turns of a recorded phone call between an AI car-buying-desk agent and a customer selling their car.

For each turn, return:
  - sentiment: positive | neutral | negative | mixed
  - sentiment_score: -1 (very negative) to 1 (very positive)
  - emotion_top: one short label like "frustrated", "excited", "calm", "skeptical", "engaged", "rushed" (or "" if not clear)
  - emotion_score: 0 to 1, your confidence in emotion_top
  - matched_signal_key: ONE of [${signalKeys.join(", ")}] if the customer turn obviously matches that signal, else ""

Customer turns can match a signal_key. AI turns never match (return "").

Transcript:
${transcript}

Return ONLY a JSON array of objects with keys: index, sentiment, sentiment_score, emotion_top, emotion_score, matched_signal_key. No prose.`;

  try {
    const r = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": key,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 4000,
        messages: [{ role: "user", content: prompt }],
      }),
    });
    if (!r.ok) {
      console.warn("sentiment: API error", r.status, await r.text());
      return [];
    }
    const data = await r.json() as { content?: Array<{ text?: string }> };
    const text = data.content?.[0]?.text || "";
    const jsonMatch = text.match(/\[[\s\S]*\]/);
    if (!jsonMatch) return [];
    const parsed = JSON.parse(jsonMatch[0]) as SentimentLabel[];
    return parsed.filter((p) => typeof p.index === "number");
  } catch (e) {
    console.warn("sentiment: exception", e);
    return [];
  }
}

/**
 * Memory extraction — the rockstar mechanic. Pull ONE personal life
 * detail (NOT vehicle/money/payoff) the customer dropped on this call.
 * Empty string if nothing personal was shared (which is fine — many
 * calls don't surface a memory, and we'd rather have none than a
 * fabricated one that erodes trust).
 */
async function extractMemoryItem(
  turns: ParsedTurn[],
): Promise<{ fact: string; kind: string } | null> {
  const key = Deno.env.get("ANTHROPIC_API_KEY");
  if (!key || !turns.length) return null;

  const customerLines = turns
    .filter((t) => t.speaker === "customer")
    .map((t) => t.text)
    .join("\n");
  if (!customerLines.trim()) return null;

  const prompt = `From the customer's lines below, extract ONE personal-life detail the next call should reference (a specific life event, family, work, location, hobby, or upcoming change).

Strict rules:
- Must be specific and verifiable on the next call ("daughter heading to college in August" — NOT "stressed").
- Must NOT be about: the vehicle, the offer, money, payoff, lien, mileage, or anything they could change their mind on.
- If nothing personal was shared, return empty.

Return ONLY JSON: {"fact": "<= 90 chars or empty string", "kind": "family|work|location|life_event|hobby|other"}.

Customer lines:
${customerLines}`;

  try {
    const r = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": key,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 200,
        messages: [{ role: "user", content: prompt }],
      }),
    });
    if (!r.ok) return null;
    const data = await r.json() as { content?: Array<{ text?: string }> };
    const text = data.content?.[0]?.text || "";
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return null;
    const parsed = JSON.parse(jsonMatch[0]) as { fact?: string; kind?: string };
    const fact = (parsed.fact || "").trim();
    if (!fact || fact.length < 6) return null;
    return { fact: fact.slice(0, 240), kind: parsed.kind || "other" };
  } catch {
    return null;
  }
}

/**
 * After enrichment we know whether the AI's first turn(s) actually
 * referenced the memory_hook_offered fact. This back-fills that on
 * voice_call_log so the grader's bandit reward signal can penalize
 * variants that skip the hook even when one was offered.
 */
function checkMemoryHookUsage(
  turns: ParsedTurn[],
  memoryHookOffered: string | null,
): { used: boolean; usedWithin20s: boolean } {
  if (!memoryHookOffered) return { used: false, usedWithin20s: false };
  const lower = memoryHookOffered.toLowerCase();
  const tokens = lower.split(/\s+/).filter((t) => t.length >= 4);
  if (tokens.length < 2) return { used: false, usedWithin20s: false };

  // Need at least 2 of the >=4-char content words to count as a hit.
  const hitTurn = turns.findIndex(
    (t) =>
      t.speaker === "ai" &&
      tokens.filter((tok) => t.text.toLowerCase().includes(tok)).length >= 2,
  );
  if (hitTurn === -1) return { used: false, usedWithin20s: false };
  const usedWithin20s = (turns[hitTurn].start_ms ?? 0) <= 20000 || hitTurn <= 2;
  return { used: true, usedWithin20s };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  let body: EnrichRequest;
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

  // Pull the call header + memory context.
  const { data: call, error: callErr } = await supabase
    .from("voice_call_log")
    .select("id, submission_id, dealership_id, transcript, recording_url, memory_hook_offered")
    .eq("id", body.call_id)
    .single();
  if (callErr || !call) {
    return new Response(JSON.stringify({ ok: false, reason: "call_not_found" }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Pull active customer_signals keys (for matched_signal_key labeling).
  const dealershipId = call.dealership_id || "default";
  const { data: signals } = await supabase
    .from("customer_signals")
    .select("signal_key")
    .or(`dealership_id.eq.${dealershipId},dealership_id.eq.default`)
    .is("retired_at", null)
    .eq("is_active", true)
    .limit(50);
  const signalKeys = (signals || []).map((s) => s.signal_key as string);

  // Parse + (optionally) re-ASR + merge.
  const flatTurns = parseBlandTranscript(call.transcript);
  const whisperTurns = call.recording_url ? await whisperReASR(call.recording_url) : null;
  const mergedTurns = mergeTurns(whisperTurns, flatTurns);
  const turnsTimed = annotateTiming(mergedTurns);

  if (!turnsTimed.length) {
    return new Response(JSON.stringify({ ok: true, turns: 0, reason: "no_transcript" }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Sentiment + memory in parallel.
  const [labels, memory] = await Promise.all([
    gradeSentiment(turnsTimed, signalKeys),
    extractMemoryItem(turnsTimed),
  ]);
  const labelByIdx = new Map(labels.map((l) => [l.index, l]));

  // Wipe-and-replace turns for idempotence.
  await supabase.from("voice_call_turns").delete().eq("call_id", body.call_id);

  const turnRows = turnsTimed.map((t) => {
    const lbl = labelByIdx.get(t.index);
    return {
      call_id: body.call_id,
      turn_index: t.index,
      speaker: t.speaker,
      text: t.text,
      asr_confidence: t.asr_confidence ?? null,
      start_ms: t.start_ms ?? null,
      end_ms: t.end_ms ?? null,
      total_token_ms: t.total_token_ms ?? null,
      was_interrupted: t.was_interrupted ?? false,
      silence_before_ms: t.silence_before_ms ?? null,
      sentiment: lbl?.sentiment ?? null,
      sentiment_score: lbl?.sentiment_score ?? null,
      emotion_top: lbl?.emotion_top || null,
      emotion_score: lbl?.emotion_score ?? null,
      matched_signal_key: lbl?.matched_signal_key || null,
    };
  });

  if (turnRows.length) {
    const { error: insErr } = await supabase.from("voice_call_turns").insert(turnRows);
    if (insErr) console.warn("voice_call_turns insert failed:", insErr.message);
  }

  // Memory hook usage check + back-fill on voice_call_log.
  const hookUsage = checkMemoryHookUsage(turnsTimed, call.memory_hook_offered ?? null);
  await supabase
    .from("voice_call_log")
    .update({
      memory_hook_used: call.memory_hook_offered ? hookUsage.used : null,
      memory_hook_used_within_20s: call.memory_hook_offered ? hookUsage.usedWithin20s : null,
    })
    .eq("id", body.call_id);

  // Memory item — only stored if extractor produced something concrete.
  if (memory && call.submission_id) {
    await supabase
      .rpc("add_customer_memory_item", {
        _submission_id: call.submission_id,
        _fact: memory.fact,
        _kind: memory.kind,
        _source_call_id: body.call_id,
      })
      .then(({ error }) => {
        if (error) console.warn("add_customer_memory_item failed:", error.message);
      });
  }

  // Chain to the grader. Fire-and-forget — enrichment's response is
  // independent of grading success, and grading reads its own data
  // (the turns we just wrote) so a slow Claude judge does not block
  // the enrich response. The grader writes voice_call_grades and
  // applies the variant-store reward via apply_voice_call_outcome.
  supabase.functions.invoke("voice-call-grade", {
    body: { call_id: body.call_id },
  }).catch((e: unknown) => console.warn("voice-call-grade invoke failed:", e));

  return new Response(
    JSON.stringify({
      ok: true,
      turns: turnRows.length,
      sentiment_labeled: labels.length,
      memory_captured: !!memory,
      memory_hook_used: hookUsage.used,
      whisper_used: !!whisperTurns,
    }),
    { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
  );
});
