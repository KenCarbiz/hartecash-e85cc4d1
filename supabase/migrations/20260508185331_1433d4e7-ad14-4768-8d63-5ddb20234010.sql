DROP POLICY IF EXISTS "Staff read voice_call_turns" ON public.voice_call_turns;
CREATE POLICY "Staff read voice_call_turns"
  ON public.voice_call_turns FOR SELECT TO authenticated
  USING (
    public.is_staff(auth.uid())
    AND EXISTS (
      SELECT 1 FROM public.voice_call_log vcl
      WHERE vcl.id = voice_call_turns.call_id
        AND vcl.dealership_id::text IN (
          SELECT dealership_id FROM public.user_roles WHERE user_id = auth.uid()
        )
    )
  );

DROP POLICY IF EXISTS "Staff read voice_call_grades" ON public.voice_call_grades;
CREATE POLICY "Staff read voice_call_grades"
  ON public.voice_call_grades FOR SELECT TO authenticated
  USING (
    public.is_staff(auth.uid())
    AND EXISTS (
      SELECT 1 FROM public.voice_call_log vcl
      WHERE vcl.id = voice_call_grades.call_id
        AND vcl.dealership_id::text IN (
          SELECT dealership_id FROM public.user_roles WHERE user_id = auth.uid()
        )
    )
  );

DROP POLICY IF EXISTS "Staff read voice_call_variants_used" ON public.voice_call_variants_used;
CREATE POLICY "Staff read voice_call_variants_used"
  ON public.voice_call_variants_used FOR SELECT TO authenticated
  USING (
    public.is_staff(auth.uid())
    AND EXISTS (
      SELECT 1 FROM public.voice_call_log vcl
      WHERE vcl.id = voice_call_variants_used.call_id
        AND vcl.dealership_id::text IN (
          SELECT dealership_id FROM public.user_roles WHERE user_id = auth.uid()
        )
    )
  );

DROP POLICY IF EXISTS "Service can insert calls" ON public.voice_call_log;
CREATE POLICY "Service can insert calls"
  ON public.voice_call_log FOR INSERT TO service_role
  WITH CHECK (true);

DROP POLICY IF EXISTS "Service can update calls" ON public.voice_call_log;
CREATE POLICY "Service can update calls"
  ON public.voice_call_log FOR UPDATE TO service_role
  USING (true) WITH CHECK (true);

CREATE OR REPLACE FUNCTION public.get_call_feedback_context(_token uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _row record;
  _dealer record;
  _first_name text;
  _vehicle_short text;
  _expired boolean;
BEGIN
  SELECT vcl.id, vcl.dealership_id, vcl.customer_name, vcl.vehicle_info,
         vcl.started_at, vcl.feedback_score, vcl.feedback_sent_at, vcl.created_at
  INTO _row
  FROM voice_call_log vcl
  WHERE vcl.feedback_token = _token
  LIMIT 1;

  IF _row.id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_found');
  END IF;

  _expired := _row.started_at < now() - interval '14 days'
              OR (_row.feedback_sent_at IS NOT NULL
                  AND _row.feedback_sent_at < now() - interval '30 days');
  IF _expired THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'expired');
  END IF;

  _first_name := split_part(coalesce(_row.customer_name, ''), ' ', 1);
  _vehicle_short := nullif(trim(
    split_part(coalesce(_row.vehicle_info, ''), ' ', 1) || ' ' ||
    split_part(coalesce(_row.vehicle_info, ''), ' ', 2)
  ), '');

  SELECT display_name, phone INTO _dealer
  FROM site_config
  WHERE dealership_id::text = _row.dealership_id::text
  LIMIT 1;

  RETURN jsonb_build_object(
    'ok', true,
    'customer_first_name',  _first_name,
    'vehicle_short',        _vehicle_short,
    'already_submitted',    _row.feedback_score IS NOT NULL,
    'dealer_display_name',  COALESCE(_dealer.display_name, 'our team'),
    'dealer_phone',         _dealer.phone,
    'customer_name',  _first_name,
    'vehicle_info',   _vehicle_short
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_call_feedback_context(uuid) TO anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.submit_call_feedback(
  _token uuid, _score smallint, _comment text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _call_id uuid;
  _existing_score smallint;
  _started_at timestamptz;
  _delta numeric;
BEGIN
  IF _score IS NULL OR _score < 1 OR _score > 5 THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'invalid_score');
  END IF;

  SELECT id, feedback_score, started_at
  INTO _call_id, _existing_score, _started_at
  FROM voice_call_log WHERE feedback_token = _token;

  IF _call_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'token_not_found');
  END IF;

  IF _started_at < now() - interval '14 days' THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'expired');
  END IF;

  IF _existing_score IS NOT NULL THEN
    RETURN jsonb_build_object('ok', true, 'reason', 'already_submitted');
  END IF;

  UPDATE voice_call_log
  SET feedback_score = _score,
      feedback_comment = NULLIF(trim(COALESCE(_comment, '')), ''),
      feedback_captured_at = now()
  WHERE id = _call_id;

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

NOTIFY pgrst, 'reload schema';