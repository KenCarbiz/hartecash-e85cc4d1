-- Customer self check-in.
--
-- An SMS sent T-3h before a scheduled appointment includes two
-- one-tap links — "I'm on my way" and "I've arrived" — so the
-- customer can advance the funnel without the front desk having to
-- spot them. Self-check-in is a lightweight gain (the same data the
-- front desk would write) but it surfaces the customer's state to the
-- floor team in real time and feeds the Greeting Card / FrontDesk
-- arrival strip already in place.
--
-- The token is the existing per-submission token used by every other
-- customer-facing surface (/offer/:token, /upload/:token, /docs/:token,
-- /boost-offer/:token), so no new auth model.
--
-- New columns on submissions:
--   self_checkin_at      timestamptz  — when the customer tapped a link
--   self_checkin_status  text         — 'on_the_way' or 'arrived' (last)
--
-- New RPC `customer_self_checkin(_token, _status)`:
--   - SECURITY DEFINER (the customer is unauthenticated)
--   - Validates token, status enum
--   - Refuses to advance backwards (arrived -> on_the_way is a no-op)
--   - Writes progress_status, status_updated_at, self_checkin_at,
--     and an activity_log row
--   - Returns nothing; the customer-facing page only needs success/fail
--
-- Idempotent. Safe to re-run.

ALTER TABLE public.submissions
  ADD COLUMN IF NOT EXISTS self_checkin_at     timestamptz,
  ADD COLUMN IF NOT EXISTS self_checkin_status text;

ALTER TABLE public.submissions
  DROP CONSTRAINT IF EXISTS submissions_self_checkin_status_chk;
ALTER TABLE public.submissions
  ADD  CONSTRAINT submissions_self_checkin_status_chk
  CHECK (self_checkin_status IS NULL OR self_checkin_status IN ('on_the_way','arrived'));

CREATE OR REPLACE FUNCTION public.customer_self_checkin(
  _token  text,
  _status text  -- 'on_the_way' | 'arrived'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _sub_id      uuid;
  _current     text;
  _new_progress text;
BEGIN
  IF _status NOT IN ('on_the_way','arrived') THEN
    RAISE EXCEPTION 'invalid status %', _status;
  END IF;

  SELECT id, progress_status INTO _sub_id, _current
  FROM submissions
  WHERE token = _token;

  IF _sub_id IS NULL THEN
    RAISE EXCEPTION 'not_found';
  END IF;

  -- Block backwards transitions. If the customer already tapped
  -- "Arrived," tapping "On my way" later is a no-op (probably the
  -- spouse opened the link from a saved text). Final states never
  -- regress.
  IF _current = 'customer_arrived' AND _status = 'on_the_way' THEN
    RETURN jsonb_build_object('ok', true, 'noop', true);
  END IF;
  IF _current IN ('inspection_completed','appraisal_completed',
                  'manager_approval','manager_approval_inspection',
                  'price_agreed','deal_finalized',
                  'check_request_submitted','purchase_complete',
                  'dead_lead') THEN
    RETURN jsonb_build_object('ok', true, 'noop', true);
  END IF;

  _new_progress := CASE
    WHEN _status = 'arrived'    THEN 'customer_arrived'
    WHEN _status = 'on_the_way' THEN 'on_the_way'
  END;

  UPDATE submissions
  SET progress_status     = _new_progress,
      status_updated_at   = now(),
      self_checkin_at     = now(),
      self_checkin_status = _status
  WHERE id = _sub_id;

  -- Audit row so the front desk can tell self-check-in from a
  -- staff-driven check-in. The `performed_by` column is text — we
  -- write 'customer:self_checkin' so it never collides with a
  -- staff UUID.
  INSERT INTO activity_log
    (submission_id, action, old_value, new_value, performed_by, created_at)
  VALUES
    (_sub_id,
     'self_checkin',
     COALESCE(_current, ''),
     _new_progress,
     'customer:self_checkin',
     now());

  RETURN jsonb_build_object('ok', true, 'submission_id', _sub_id, 'progress_status', _new_progress);
END;
$function$;

GRANT EXECUTE ON FUNCTION public.customer_self_checkin(text, text) TO anon, authenticated;

NOTIFY pgrst, 'reload schema';
