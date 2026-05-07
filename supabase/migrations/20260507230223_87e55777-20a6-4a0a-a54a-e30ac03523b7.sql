-- 20260507210000_voice_call_nps.sql
-- Adds customer NPS feedback to voice_call_log + RPCs + admin view.
-- Idempotent.

-- 1. Columns on voice_call_log -------------------------------------------
ALTER TABLE public.voice_call_log
  ADD COLUMN IF NOT EXISTS feedback_token        text UNIQUE,
  ADD COLUMN IF NOT EXISTS feedback_score        smallint
    CHECK (feedback_score IS NULL OR feedback_score BETWEEN 1 AND 5),
  ADD COLUMN IF NOT EXISTS feedback_comment      text,
  ADD COLUMN IF NOT EXISTS feedback_captured_at  timestamptz,
  ADD COLUMN IF NOT EXISTS feedback_request_sent_at timestamptz,
  ADD COLUMN IF NOT EXISTS feedback_request_channel text;

CREATE INDEX IF NOT EXISTS idx_voice_call_log_feedback_token
  ON public.voice_call_log (feedback_token)
  WHERE feedback_token IS NOT NULL;

-- 2. submit_call_feedback (public) --------------------------------------
CREATE OR REPLACE FUNCTION public.submit_call_feedback(
  _token   text,
  _score   smallint,
  _comment text DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _call record;
BEGIN
  IF _score IS NULL OR _score < 1 OR _score > 5 THEN
    RAISE EXCEPTION 'invalid_score';
  END IF;

  SELECT id, feedback_captured_at INTO _call
  FROM voice_call_log
  WHERE feedback_token = _token;

  IF _call.id IS NULL THEN
    RAISE EXCEPTION 'invalid_token';
  END IF;

  IF _call.feedback_captured_at IS NOT NULL THEN
    RETURN jsonb_build_object('ok', true, 'already_submitted', true);
  END IF;

  UPDATE voice_call_log
  SET feedback_score = _score,
      feedback_comment = NULLIF(trim(COALESCE(_comment, '')), ''),
      feedback_captured_at = now()
  WHERE id = _call.id;

  RETURN jsonb_build_object('ok', true, 'already_submitted', false);
END;
$$;

REVOKE ALL ON FUNCTION public.submit_call_feedback(text, smallint, text) FROM public;
GRANT EXECUTE ON FUNCTION public.submit_call_feedback(text, smallint, text) TO anon, authenticated;

-- 3. get_call_feedback_context (public) ---------------------------------
CREATE OR REPLACE FUNCTION public.get_call_feedback_context(_token text)
RETURNS TABLE(
  call_id uuid,
  customer_name text,
  vehicle_info text,
  started_at timestamptz,
  already_submitted boolean,
  existing_score smallint
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    v.id,
    s.name,
    COALESCE(s.vehicle_year, '') || ' ' || COALESCE(s.vehicle_make, '') || ' ' || COALESCE(s.vehicle_model, ''),
    v.started_at,
    v.feedback_captured_at IS NOT NULL,
    v.feedback_score
  FROM voice_call_log v
  LEFT JOIN submissions s ON s.id = v.submission_id
  WHERE v.feedback_token = _token;
$$;

REVOKE ALL ON FUNCTION public.get_call_feedback_context(text) FROM public;
GRANT EXECUTE ON FUNCTION public.get_call_feedback_context(text) TO anon, authenticated;

-- 4. v_voice_call_quality_with_nps --------------------------------------
DROP VIEW IF EXISTS public.v_voice_call_quality_with_nps;
CREATE VIEW public.v_voice_call_quality_with_nps AS
SELECT
  q.*,
  v.feedback_score,
  v.feedback_comment,
  v.feedback_captured_at
FROM public.v_voice_call_quality q
LEFT JOIN public.voice_call_log v ON v.id = q.call_id;

NOTIFY pgrst, 'reload schema';