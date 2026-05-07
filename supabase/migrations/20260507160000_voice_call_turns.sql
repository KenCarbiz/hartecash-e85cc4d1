-- voice_call_turns — per-turn enrichment sibling table.
--
-- voice_call_log stores one row per call (header + transcript blob).
-- That's enough to bill and enough for a transcript view, but it's
-- not enough to TRAIN the voice AI. The signals that distinguish a
-- $300k/yr buying-desk rep from a $100k/yr one live BETWEEN turns:
--
--   - Did the AI shut up for 4+ seconds after stating a number,
--     or did it nervously fill the silence?
--   - When the customer interrupted, was the AI graceful about it?
--   - Was customer sentiment trending up or down across turns?
--   - Did ASR confidence collapse on a key turn (the customer was
--     mumbling and we quoted an ACV anyway)?
--   - What was the AI's first-token latency? >1.5s correlates with
--     hangups in our data.
--
-- This table is populated by the voice-call-enrich edge function
-- (post-call) which:
--   1. Pulls the recording from voice_call_log.recording_url.
--   2. Re-ASRs with Whisper-large-v3 for word-level confidence.
--   3. Diarizes with pyannote / AssemblyAI to fix Bland's mis-
--      attributed turns.
--   4. Runs sentiment per turn (AssemblyAI Universal-2 or Hume).
--   5. Extracts silences > 2s and barge-in events from the audio.
--   6. Inserts one row per turn here.
--
-- Idempotent. Safe to re-run.

CREATE TABLE IF NOT EXISTS public.voice_call_turns (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  call_id         uuid NOT NULL REFERENCES public.voice_call_log(id) ON DELETE CASCADE,
  turn_index      integer NOT NULL,                  -- 0-based, ordered chronologically
  speaker         text NOT NULL CHECK (speaker IN ('ai', 'customer', 'unknown')),

  -- Content
  text            text NOT NULL DEFAULT '',
  asr_confidence  numeric,                           -- 0-1; Whisper word-mean
  start_ms        integer,                           -- offset from call start
  end_ms          integer,

  -- Latency (only meaningful for ai turns)
  first_token_ms  integer,                           -- time to first audible token
  total_token_ms  integer,                           -- total turn length
  was_interrupted boolean NOT NULL DEFAULT false,    -- customer cut us off

  -- Silence event PRECEDING this turn (gap from previous turn end)
  silence_before_ms integer,

  -- Sentiment / emotion (per-turn)
  sentiment       text CHECK (sentiment IN ('positive','neutral','negative','mixed') OR sentiment IS NULL),
  sentiment_score numeric,                           -- -1 to 1
  emotion_top     text,                              -- "frustrated", "calm", "excited" — provider-specific label
  emotion_score   numeric,                           -- 0-1 confidence on emotion_top

  -- Did this turn match a known customer_signals row?
  matched_signal_key text,                           -- "too_low" | "ready_to_book" | etc.

  metadata        jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at      timestamptz NOT NULL DEFAULT now(),

  UNIQUE (call_id, turn_index)
);

CREATE INDEX IF NOT EXISTS voice_call_turns_call_idx
  ON public.voice_call_turns (call_id, turn_index);
CREATE INDEX IF NOT EXISTS voice_call_turns_signal_idx
  ON public.voice_call_turns (matched_signal_key)
  WHERE matched_signal_key IS NOT NULL;
CREATE INDEX IF NOT EXISTS voice_call_turns_negative_sentiment_idx
  ON public.voice_call_turns (call_id, turn_index)
  WHERE sentiment = 'negative';

ALTER TABLE public.voice_call_turns ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Service role full access voice_call_turns"
  ON public.voice_call_turns;
CREATE POLICY "Service role full access voice_call_turns"
  ON public.voice_call_turns FOR ALL TO service_role
  USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Staff read voice_call_turns"
  ON public.voice_call_turns;
CREATE POLICY "Staff read voice_call_turns"
  ON public.voice_call_turns FOR SELECT TO authenticated
  USING (public.is_staff(auth.uid()));

-- ── voice_call_grades — LLM-as-judge rubric scores ────────────────
--
-- One row per call per grader. The grading rubric is the product;
-- this is the schema that holds it. Two dimensions are GATING — any
-- 1-score on dim_compliance or dim_hallucination auto-retires the
-- variants used in that call (via apply_voice_call_outcome with
-- _retire_gating_failures = true).

CREATE TABLE IF NOT EXISTS public.voice_call_grades (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  call_id         uuid NOT NULL REFERENCES public.voice_call_log(id) ON DELETE CASCADE,
  grader          text NOT NULL DEFAULT 'llm',       -- 'llm' | 'human' | 'nps'
  grader_model    text,                              -- 'claude-sonnet-4-6', 'gpt-5', 'human:user_id'

  -- 10-dimension rubric, 1/3/5 scoring (gating dims marked)
  dim_compliance        smallint CHECK (dim_compliance BETWEEN 1 AND 5),       -- GATING (TCPA/recording disclosure)
  dim_vehicle_confirm   smallint CHECK (dim_vehicle_confirm BETWEEN 1 AND 5),
  dim_motivation_disco  smallint CHECK (dim_motivation_disco BETWEEN 1 AND 5),
  dim_quote_band        smallint CHECK (dim_quote_band BETWEEN 1 AND 5),       -- GATING (ACV out-of-band)
  dim_objection_handle  smallint CHECK (dim_objection_handle BETWEEN 1 AND 5),
  dim_close_control     smallint CHECK (dim_close_control BETWEEN 1 AND 5),
  dim_transfer_hygiene  smallint CHECK (dim_transfer_hygiene BETWEEN 1 AND 5),
  dim_pacing            smallint CHECK (dim_pacing BETWEEN 1 AND 5),
  dim_hallucination     smallint CHECK (dim_hallucination BETWEEN 1 AND 5),    -- GATING (invented numbers)
  dim_brand_tone        smallint CHECK (dim_brand_tone BETWEEN 1 AND 5),

  -- Composite outcome score (the number passed to apply_voice_call_outcome)
  composite_score numeric NOT NULL,
  gating_failed   boolean NOT NULL DEFAULT false,

  rationale       text,                              -- why this grade
  golden_pinned   boolean NOT NULL DEFAULT false,    -- part of the frozen golden-100 holdout?

  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS voice_call_grades_call_idx
  ON public.voice_call_grades (call_id);
CREATE INDEX IF NOT EXISTS voice_call_grades_gating_idx
  ON public.voice_call_grades (gating_failed, created_at DESC)
  WHERE gating_failed = true;
CREATE INDEX IF NOT EXISTS voice_call_grades_golden_idx
  ON public.voice_call_grades (golden_pinned)
  WHERE golden_pinned = true;

ALTER TABLE public.voice_call_grades ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Service role full access voice_call_grades"
  ON public.voice_call_grades;
CREATE POLICY "Service role full access voice_call_grades"
  ON public.voice_call_grades FOR ALL TO service_role
  USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Staff read voice_call_grades"
  ON public.voice_call_grades;
CREATE POLICY "Staff read voice_call_grades"
  ON public.voice_call_grades FOR SELECT TO authenticated
  USING (public.is_staff(auth.uid()));

-- ── v_voice_call_quality view ──────────────────────────────────────
--
-- Convenience view powering the admin "10 lowest / 10 highest" Monday
-- ritual page. Joins call header + composite grade + quick conversion
-- outcome flag so a manager can scan a week of calls without touching
-- four tables.

CREATE OR REPLACE VIEW public.v_voice_call_quality AS
SELECT
  vcl.id                AS call_id,
  vcl.submission_id,
  vcl.dealership_id,
  vcl.customer_name,
  vcl.vehicle_info,
  vcl.started_at,
  vcl.duration_seconds,
  vcl.outcome           AS call_outcome,
  vcg.composite_score,
  vcg.gating_failed,
  vcg.dim_compliance,
  vcg.dim_quote_band,
  vcg.dim_hallucination,
  vcg.rationale         AS grader_rationale,
  vcg.grader_model
FROM public.voice_call_log vcl
LEFT JOIN LATERAL (
  SELECT *
  FROM public.voice_call_grades g
  WHERE g.call_id = vcl.id
  ORDER BY g.created_at DESC
  LIMIT 1
) vcg ON true
WHERE vcl.status = 'completed';

GRANT SELECT ON public.v_voice_call_quality TO authenticated;

NOTIFY pgrst, 'reload schema';
