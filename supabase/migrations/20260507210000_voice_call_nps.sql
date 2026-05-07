-- Customer post-call NPS feedback — the ground-truth signal.
--
-- LLM-as-judge grading is fast, cheap, and consistent — but it's
-- still a model talking to a model. The customer is the only source
-- of ground truth that matters. A 1-tap "How was that call? 1-5"
-- SMS captures it. Realistic response rates are 8-12%; treated as a
-- noisy weighting on the LLM grade, not a replacement.
--
-- Schema additions on voice_call_log:
--   feedback_token       — opaque uuid in the SMS link; the customer
--                          page resolves call_id from this so we
--                          never expose internal IDs in URLs.
--   feedback_score       — 1-5
--   feedback_comment     — optional one-liner the customer typed
--   feedback_captured_at — when the response landed
--
-- submit_call_feedback RPC: public-callable via anon (the link is
-- the auth). It validates the token, stamps the score/comment, and
-- pushes a delta into the variant store via apply_voice_call_outcome:
--   score >=4   →  +0.5  (signal: customer happy with the call)
--   score 3     →   0    (neutral; do nothing)
--   score <=2   →  -1.0  (penalty into every variant used)
-- We DON'T retire on a single low score — one grumpy customer
-- shouldn't take down a variant; the bandit's Beta posterior will
-- adjust naturally as more data lands.
--
-- Idempotent. Safe to re-run. Submit RPC is also idempotent: a
-- second submission on the same token is rejected silently so a
-- customer who taps the link twice doesn't double-penalize.

ALTER TABLE public.voice_call_log
  ADD COLUMN IF NOT EXISTS feedback_token uuid DEFAULT gen_random_uuid(),
  ADD COLUMN IF NOT EXISTS feedback_score smallint CHECK (feedback_score IS NULL OR feedback_score BETWEEN 1 AND 5),
  ADD COLUMN IF NOT EXISTS feedback_comment text,
  ADD COLUMN IF NOT EXISTS feedback_captured_at timestamptz,
  ADD COLUMN IF NOT EXISTS feedback_sent_at timestamptz;

-- Back-fill tokens on existing rows so old calls that get a
-- feedback request still have a stable URL.
UPDATE public.voice_call_log
SET feedback_token = gen_random_uuid()
WHERE feedback_token IS NULL;

CREATE INDEX IF NOT EXISTS voice_call_log_feedback_token_idx
  ON public.voice_call_log (feedback_token)
  WHERE feedback_token IS NOT NULL;

-- ── submit_call_feedback RPC ───────────────────────────────────────
-- Public-callable. Anonymous customers hit this from the SMS link.
-- The token IS the auth — anyone with the URL can submit, but the
-- token is gen_random_uuid() and lives only in an SMS to the
-- customer's phone, so spraying is impractical.
--
-- Returns a small JSON envelope so the client can render success/
-- error without coupling to PostgREST error shape.

CREATE OR REPLACE FUNCTION public.submit_call_feedback(
  _token   uuid,
  _score   smallint,
  _comment text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _call_id uuid;
  _existing_score smallint;
  _delta numeric;
BEGIN
  IF _score IS NULL OR _score < 1 OR _score > 5 THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'invalid_score');
  END IF;

  SELECT id, feedback_score INTO _call_id, _existing_score
  FROM voice_call_log
  WHERE feedback_token = _token;

  IF _call_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'token_not_found');
  END IF;

  IF _existing_score IS NOT NULL THEN
    -- Already submitted; do not double-count into the variant store.
    -- Return ok=true so a customer hitting the link twice doesn't see
    -- an error — they completed the action.
    RETURN jsonb_build_object('ok', true, 'reason', 'already_submitted');
  END IF;

  UPDATE voice_call_log
  SET feedback_score        = _score,
      feedback_comment      = NULLIF(trim(COALESCE(_comment, '')), ''),
      feedback_captured_at  = now()
  WHERE id = _call_id;

  -- Map score → delta. We deliberately don't auto-retire on score=1;
  -- a single grumpy customer shouldn't take down a variant. The Beta
  -- posterior absorbs the negative signal across many calls.
  IF    _score >= 4 THEN _delta :=  0.5;
  ELSIF _score = 3 THEN  _delta :=  0.0;
  ELSE                    _delta := -1.0;
  END IF;

  IF _delta != 0 THEN
    PERFORM apply_voice_call_outcome(_call_id, _delta, false);
  END IF;

  RETURN jsonb_build_object('ok', true, 'score', _score, 'delta', _delta);
END;
$$;

GRANT EXECUTE ON FUNCTION public.submit_call_feedback(uuid, smallint, text)
  TO anon, authenticated, service_role;

-- ── get_call_feedback_context RPC ──────────────────────────────────
-- Public-callable. The customer page calls this to render context
-- ("How was your call about your 2019 Toyota Camry?") without us
-- exposing the entire voice_call_log row to anon. Returns only the
-- minimum the UI needs.

CREATE OR REPLACE FUNCTION public.get_call_feedback_context(
  _token uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _row record;
  _dealer record;
BEGIN
  SELECT
    vcl.id, vcl.dealership_id, vcl.customer_name, vcl.vehicle_info,
    vcl.started_at, vcl.feedback_score
  INTO _row
  FROM voice_call_log vcl
  WHERE vcl.feedback_token = _token
  LIMIT 1;

  IF _row.id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_found');
  END IF;

  -- Dealership display name; defaults to 'our team' if no row.
  SELECT display_name, phone INTO _dealer
  FROM site_config
  WHERE dealership_id::text = _row.dealership_id::text
  LIMIT 1;

  RETURN jsonb_build_object(
    'ok', true,
    'customer_name',   _row.customer_name,
    'vehicle_info',    _row.vehicle_info,
    'started_at',      _row.started_at,
    'already_submitted', _row.feedback_score IS NOT NULL,
    'dealer_display_name', COALESCE(_dealer.display_name, 'our team'),
    'dealer_phone',    _dealer.phone
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_call_feedback_context(uuid)
  TO anon, authenticated, service_role;

-- ── v_voice_call_quality_with_nps ──────────────────────────────────
-- Joins the LLM-judge grade view with the post-call NPS columns so
-- the admin Voice Quality panel can render "AI judged 4.2 but
-- customer rated 2/5 — listen to this one" in a single row.
-- Separate view (not added to the base) so callers that only need
-- LLM grades don't pay for the join.
CREATE OR REPLACE VIEW public.v_voice_call_quality_with_nps AS
SELECT
  q.*,
  vcl.feedback_score,
  vcl.feedback_comment,
  vcl.feedback_captured_at
FROM public.v_voice_call_quality q
JOIN public.voice_call_log vcl ON vcl.id = q.call_id;

GRANT SELECT ON public.v_voice_call_quality_with_nps TO authenticated;

NOTIFY pgrst, 'reload schema';
