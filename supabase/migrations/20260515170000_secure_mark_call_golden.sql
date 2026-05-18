-- Security fix: gate mark_call_golden() and request_offer_increase()
-- to staff only.
--
-- Both functions are SECURITY DEFINER + GRANT EXECUTE TO authenticated,
-- but neither performed an internal authorization check. Any logged-in
-- user — including a customer holding a /portal token — could call
-- them.
--
-- mark_call_golden (HIGH risk):
--   * Pin every voice call as "golden" → poisons the regression set
--     used to grade the voice-AI agent on rubric changes
--   * Unpin the human-curated golden-100 → destroys the regression
--     baseline that catches bad prompt edits
--
-- request_offer_increase (LOW risk, but still wrong):
--   * Anyone can create offer-increase requests against any
--     submission → manager dispatch queue spam
--   * The decide path (decide_offer_request) is already gated, so
--     no actual money moves without a manager touching it; but the
--     queue noise is a real DoS surface
--
-- Fix: explicit staff check at the top of each function. We use the
-- same user_roles pattern as admin_set_customer_timezone
-- (20260515160000): caller must have a role in (admin, manager, staff,
-- gsm_gm, gm, used_car_manager, salesperson, bdc).
--
-- The application-side audit rows (logStaffAction from PR #237) are
-- unchanged. These migrations are defense-in-depth against direct
-- RPC calls that bypass the UI.
--
-- Idempotent (CREATE OR REPLACE). The bodies are copied verbatim from
-- their original migrations (20260507220000 / 20260507120000) with
-- only the staff gate added at the top.

-- ── mark_call_golden: staff-only ────────────────────────────────────
CREATE OR REPLACE FUNCTION public.mark_call_golden(
  _call_id uuid,
  _pinned  boolean
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _grade_id uuid;
  _caller_id uuid := auth.uid();
BEGIN
  IF _caller_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_authenticated');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.user_roles
     WHERE user_id = _caller_id
       AND role IN ('admin', 'manager', 'staff', 'gsm_gm', 'gm',
                    'used_car_manager', 'salesperson', 'bdc')
  ) THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_staff');
  END IF;

  SELECT id INTO _grade_id
  FROM voice_call_grades
  WHERE call_id = _call_id
  ORDER BY created_at DESC
  LIMIT 1;

  IF _grade_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'no_grade_yet');
  END IF;

  UPDATE voice_call_grades
  SET golden_pinned = _pinned
  WHERE id = _grade_id;

  RETURN jsonb_build_object('ok', true, 'pinned', _pinned, 'grade_id', _grade_id);
END;
$$;

COMMENT ON FUNCTION public.mark_call_golden(uuid, boolean) IS
  'Toggle a voice call into / out of the golden-100 regression holdout. Staff-only — requires a user_roles row with any non-customer role. The pin lives on the most-recent voice_call_grades row for the call.';

GRANT EXECUTE ON FUNCTION public.mark_call_golden(uuid, boolean)
  TO authenticated, service_role;

-- ── request_offer_increase: staff-only ──────────────────────────────
-- Body is identical to 20260507120000 except for the staff gate
-- added at the top of the BEGIN block. Validation, the
-- app.accept_offer_bypass dance for the trigger, and the activity_log
-- audit row are all preserved verbatim.
CREATE OR REPLACE FUNCTION public.request_offer_increase(
  _submission_id    uuid,
  _requested_offer  numeric,
  _reason           text DEFAULT 'other',
  _reason_notes     text DEFAULT NULL,
  _requested_by_role text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _sub               record;
  _is_manager        boolean;
  _request_id        uuid;
  _auto_approved     boolean := false;
  _result            jsonb;
  _caller_id         uuid := auth.uid();
BEGIN
  -- ── Staff gate (added 2026-05-15) ──
  -- Defense-in-depth against direct RPC calls. The decide path is
  -- manager-gated, so no offered_price changes without a manager
  -- — but creating pending rows is itself a queue-spam surface.
  IF _caller_id IS NULL THEN
    RAISE EXCEPTION 'not_authenticated' USING ERRCODE = '28000';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.user_roles
     WHERE user_id = _caller_id
       AND role IN ('admin', 'manager', 'staff', 'gsm_gm', 'gm',
                    'used_car_manager', 'salesperson', 'bdc')
  ) THEN
    RAISE EXCEPTION 'not_staff' USING ERRCODE = '42501';
  END IF;

  SELECT id, dealership_id, offered_price, acv_value, name
    INTO _sub
  FROM submissions
  WHERE id = _submission_id;
  IF _sub.id IS NULL THEN
    RAISE EXCEPTION 'submission_not_found';
  END IF;

  IF _requested_offer IS NULL OR _requested_offer <= 0 THEN
    RAISE EXCEPTION 'invalid_requested_offer';
  END IF;

  -- A manager calling this in-band auto-approves. Everyone else
  -- creates a pending request.
  _is_manager :=
       has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'gsm_gm'::app_role)
    OR has_role(auth.uid(), 'gm'::app_role)
    OR has_role(auth.uid(), 'used_car_manager'::app_role);

  INSERT INTO offer_approval_requests
    (submission_id, dealership_id, current_offer, requested_offer,
     acv_value_at_request, reason, reason_notes,
     requested_by, requested_by_role, status,
     decided_by, decided_at, applied_at)
  VALUES
    (_submission_id, _sub.dealership_id, _sub.offered_price, _requested_offer,
     _sub.acv_value, _reason, _reason_notes,
     auth.uid(),
     COALESCE(_requested_by_role, CASE WHEN _is_manager THEN 'manager' ELSE 'staff' END),
     CASE WHEN _is_manager THEN 'auto_approved' ELSE 'pending' END,
     CASE WHEN _is_manager THEN auth.uid() ELSE NULL END,
     CASE WHEN _is_manager THEN now() ELSE NULL END,
     CASE WHEN _is_manager THEN now() ELSE NULL END)
  RETURNING id INTO _request_id;

  -- Manager-as-requester path: apply immediately. The trigger
  -- enforce_submission_update_roles runs on this UPDATE and will
  -- accept the manager's role; the bypass-flag set below preserves
  -- the audit trail (we don't fake the calling identity).
  IF _is_manager THEN
    PERFORM set_config('app.accept_offer_bypass', 'true', true);
    UPDATE submissions
      SET offered_price = _requested_offer
      WHERE id = _submission_id;
    PERFORM set_config('app.accept_offer_bypass', 'false', true);
    _auto_approved := true;
  END IF;

  -- Audit row.
  INSERT INTO activity_log
    (submission_id, action, old_value, new_value, performed_by, created_at)
  VALUES
    (_submission_id,
     CASE WHEN _is_manager THEN 'offer_increase_auto_approved' ELSE 'offer_increase_requested' END,
     COALESCE(_sub.offered_price::text, ''),
     _requested_offer::text,
     auth.uid()::text,
     now());

  _result := jsonb_build_object(
    'ok', true,
    'request_id', _request_id,
    'status', CASE WHEN _is_manager THEN 'auto_approved' ELSE 'pending' END,
    'auto_approved', _auto_approved
  );
  RETURN _result;
END;
$function$;

COMMENT ON FUNCTION public.request_offer_increase(uuid, numeric, text, text, text) IS
  'Create an offer-increase request. Staff-only — non-staff callers raise 42501. Manager roles auto-apply (offered_price updated + status=auto_approved). Other staff create a pending row for the manager dispatch queue.';

GRANT EXECUTE ON FUNCTION public.request_offer_increase(uuid, numeric, text, text, text)
  TO authenticated, service_role;

NOTIFY pgrst, 'reload schema';
