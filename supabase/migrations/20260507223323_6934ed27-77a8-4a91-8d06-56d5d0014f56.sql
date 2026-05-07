CREATE TABLE IF NOT EXISTS public.voice_call_turns (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  call_id         uuid NOT NULL REFERENCES public.voice_call_log(id) ON DELETE CASCADE,
  turn_index      integer NOT NULL,
  speaker         text NOT NULL CHECK (speaker IN ('ai', 'customer', 'unknown')),
  text            text NOT NULL DEFAULT '',
  asr_confidence  numeric,
  start_ms        integer,
  end_ms          integer,
  first_token_ms  integer,
  total_token_ms  integer,
  was_interrupted boolean NOT NULL DEFAULT false,
  silence_before_ms integer,
  sentiment       text CHECK (sentiment IN ('positive','neutral','negative','mixed') OR sentiment IS NULL),
  sentiment_score numeric,
  emotion_top     text,
  emotion_score   numeric,
  matched_signal_key text,
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
DROP POLICY IF EXISTS "Service role full access voice_call_turns" ON public.voice_call_turns;
CREATE POLICY "Service role full access voice_call_turns"
  ON public.voice_call_turns FOR ALL TO service_role USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "Staff read voice_call_turns" ON public.voice_call_turns;
CREATE POLICY "Staff read voice_call_turns"
  ON public.voice_call_turns FOR SELECT TO authenticated
  USING (public.is_staff(auth.uid()));

CREATE TABLE IF NOT EXISTS public.voice_call_grades (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  call_id         uuid NOT NULL REFERENCES public.voice_call_log(id) ON DELETE CASCADE,
  grader          text NOT NULL DEFAULT 'llm',
  grader_model    text,
  dim_compliance        smallint CHECK (dim_compliance BETWEEN 1 AND 5),
  dim_vehicle_confirm   smallint CHECK (dim_vehicle_confirm BETWEEN 1 AND 5),
  dim_motivation_disco  smallint CHECK (dim_motivation_disco BETWEEN 1 AND 5),
  dim_quote_band        smallint CHECK (dim_quote_band BETWEEN 1 AND 5),
  dim_objection_handle  smallint CHECK (dim_objection_handle BETWEEN 1 AND 5),
  dim_close_control     smallint CHECK (dim_close_control BETWEEN 1 AND 5),
  dim_transfer_hygiene  smallint CHECK (dim_transfer_hygiene BETWEEN 1 AND 5),
  dim_pacing            smallint CHECK (dim_pacing BETWEEN 1 AND 5),
  dim_hallucination     smallint CHECK (dim_hallucination BETWEEN 1 AND 5),
  dim_brand_tone        smallint CHECK (dim_brand_tone BETWEEN 1 AND 5),
  composite_score numeric NOT NULL,
  gating_failed   boolean NOT NULL DEFAULT false,
  rationale       text,
  golden_pinned   boolean NOT NULL DEFAULT false,
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
DROP POLICY IF EXISTS "Service role full access voice_call_grades" ON public.voice_call_grades;
CREATE POLICY "Service role full access voice_call_grades"
  ON public.voice_call_grades FOR ALL TO service_role USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "Staff read voice_call_grades" ON public.voice_call_grades;
CREATE POLICY "Staff read voice_call_grades"
  ON public.voice_call_grades FOR SELECT TO authenticated
  USING (public.is_staff(auth.uid()));

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