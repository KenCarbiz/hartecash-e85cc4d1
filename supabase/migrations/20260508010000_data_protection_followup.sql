-- Customer-data air-tightening — follow-up lockdown.
--
-- The 20260508000000 migration closed the compile_voice_agent_prompt
-- anon leak and added the retention layer. A subsequent security
-- audit surfaced four more issues:
--
-- P0  voice_call_turns / voice_call_grades / voice_call_variants_used
--     have RLS that gates on is_staff(auth.uid()) only — NO dealership
--     filter. A staff user at any tenant can SELECT verbatim per-turn
--     customer speech (voice_call_turns.text) and grader rationale
--     (which often quotes customers back) for every other dealership.
--     Cross-tenant leak between staff users.
--
-- P1  voice_call_log INSERT/UPDATE policies use WITH CHECK (true)
--     without TO service_role. Today this is harmless because anon /
--     authenticated have no base-table grant, but if anyone GRANTs
--     INSERT/UPDATE in the future (easy mistake) the policy permits
--     cross-tenant writes. Pin to service_role for defense-in-depth.
--
-- P1  get_call_feedback_context returns the customer's FULL name and
--     full vehicle string to anyone with the SMS token. Customers
--     forward survey links to spouses / friends; the recipient sees
--     the original customer's full identity. Tighten to first name +
--     year/make only, drop model + last name + last_seen_at, and
--     reject the call if it's older than 14 days.
--
-- P2  voice-call-webhook console-logs submission_id alongside outcome
--     strings. Function logs have a separate retention from the DB
--     and are join-back-able to PII. Edge-function-level fix; this
--     migration tracks the remediation but the actual scrub is in
--     the function code commit.
--
-- Idempotent. Safe to re-run.

-- ── 1. voice_call_turns — dealership-scoped SELECT ────────────────
DROP POLICY IF EXISTS "Staff read voice_call_turns"
  ON public.voice_call_turns;
CREATE POLICY "Staff read voice_call_turns"
  ON public.voice_call_turns FOR SELECT TO authenticated
  USING (
    public.is_staff(auth.uid())
    AND EXISTS (
      SELECT 1 FROM public.voice_call_log vcl
      WHERE vcl.id = voice_call_turns.call_id
        AND vcl.dealership_id IN (
          SELECT dealership_id FROM public.user_roles
          WHERE user_id = auth.uid()
        )
    )
  );

-- ── 2. voice_call_grades — dealership-scoped SELECT ───────────────
DROP POLICY IF EXISTS "Staff read voice_call_grades"
  ON public.voice_call_grades;
CREATE POLICY "Staff read voice_call_grades"
  ON public.voice_call_grades FOR SELECT TO authenticated
  USING (
    public.is_staff(auth.uid())
    AND EXISTS (
      SELECT 1 FROM public.voice_call_log vcl
      WHERE vcl.id = voice_call_grades.call_id
        AND vcl.dealership_id IN (
          SELECT dealership_id FROM public.user_roles
          WHERE user_id = auth.uid()
        )
    )
  );

-- ── 3. voice_call_variants_used — dealership-scoped SELECT ────────
DROP POLICY IF EXISTS "Staff read voice_call_variants_used"
  ON public.voice_call_variants_used;
CREATE POLICY "Staff read voice_call_variants_used"
  ON public.voice_call_variants_used FOR SELECT TO authenticated
  USING (
    public.is_staff(auth.uid())
    AND EXISTS (
      SELECT 1 FROM public.voice_call_log vcl
      WHERE vcl.id = voice_call_variants_used.call_id
        AND vcl.dealership_id IN (
          SELECT dealership_id FROM public.user_roles
          WHERE user_id = auth.uid()
        )
    )
  );

-- ── 4. Pin voice_call_log write policies to service_role ──────────
-- The WITH CHECK (true) is fine *because* the policy is service-role
-- only. But the original migration (20260413400000) created the
-- policies without `TO service_role` — meaning a future GRANT INSERT
-- on voice_call_log to authenticated/anon would slip through the
-- policy. Re-create with explicit role pin.

DROP POLICY IF EXISTS "Service can insert calls" ON public.voice_call_log;
CREATE POLICY "Service can insert calls"
  ON public.voice_call_log FOR INSERT TO service_role
  WITH CHECK (true);

DROP POLICY IF EXISTS "Service can update calls" ON public.voice_call_log;
CREATE POLICY "Service can update calls"
  ON public.voice_call_log FOR UPDATE TO service_role
  USING (true) WITH CHECK (true);

-- ── 5. Tighten get_call_feedback_context payload + add expiry ─────
-- Returns:
--   customer_first_name (was customer_name — full)
--   vehicle_short       (was vehicle_info — year+make+model; now year+make only)
--   already_submitted   (unchanged)
--   dealer_display_name (unchanged)
--   dealer_phone        (unchanged)
--
-- Rejects when the call is older than 14 days OR more than 30 days
-- since feedback_sent_at, even if no submission has happened —
-- old SMS links should not be valid forever.

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
  _first_name text;
  _vehicle_short text;
  _expired boolean;
BEGIN
  SELECT
    vcl.id, vcl.dealership_id, vcl.customer_name, vcl.vehicle_info,
    vcl.started_at, vcl.feedback_score, vcl.feedback_sent_at,
    vcl.created_at
  INTO _row
  FROM voice_call_log vcl
  WHERE vcl.feedback_token = _token
  LIMIT 1;

  IF _row.id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_found');
  END IF;

  -- 14-day window from the call date is the legitimate response
  -- window for a survey. Older = the link was probably forwarded /
  -- archived; refuse it.
  _expired := _row.started_at < now() - interval '14 days'
              OR (_row.feedback_sent_at IS NOT NULL
                  AND _row.feedback_sent_at < now() - interval '30 days');
  IF _expired THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'expired');
  END IF;

  -- First name only — strip everything after the first whitespace.
  -- When name is null/empty, return empty string and the page still
  -- renders ("How was that call?" without a name).
  _first_name := split_part(coalesce(_row.customer_name, ''), ' ', 1);

  -- Vehicle short — drop model + trim to year+make. Customers don't
  -- need to see "2019 Toyota Camry XLE" to recognize their own car;
  -- "your 2019 Toyota" is enough context AND can't be cross-
  -- referenced as easily by a forwarded-link recipient.
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
    -- Backwards-compatible aliases so the existing CallFeedback page
    -- doesn't break before its frontend update lands. Drop these in
    -- a later migration once the page is updated to read the new
    -- field names exclusively.
    'customer_name',  _first_name,
    'vehicle_info',   _vehicle_short
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_call_feedback_context(uuid)
  TO anon, authenticated, service_role;

-- ── 6. submit_call_feedback — also enforce 14-day window ──────────
-- Symmetric with the context fn so a customer hitting an expired
-- link gets a consistent "expired" response across read + write.

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
  _started_at timestamptz;
  _delta numeric;
BEGIN
  IF _score IS NULL OR _score < 1 OR _score > 5 THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'invalid_score');
  END IF;

  SELECT id, feedback_score, started_at
  INTO _call_id, _existing_score, _started_at
  FROM voice_call_log
  WHERE feedback_token = _token;

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
  SET feedback_score        = _score,
      feedback_comment      = NULLIF(trim(COALESCE(_comment, '')), ''),
      feedback_captured_at  = now()
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
