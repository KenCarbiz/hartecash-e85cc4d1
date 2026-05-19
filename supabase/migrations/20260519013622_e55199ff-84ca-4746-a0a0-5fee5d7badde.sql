-- prune_processed_webhook_calls
CREATE OR REPLACE FUNCTION public.prune_processed_webhook_calls(
  _retention_days integer DEFAULT 30
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  deleted_count integer;
BEGIN
  IF _retention_days IS NULL OR _retention_days < 1 THEN
    RAISE EXCEPTION 'retention_days must be >= 1, got %', _retention_days;
  END IF;
  DELETE FROM public.processed_webhook_calls
   WHERE processed_at < now() - make_interval(days => _retention_days);
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$;
COMMENT ON FUNCTION public.prune_processed_webhook_calls(integer) IS
  'Retention prune for the webhook-replay dedupe ledger. Default 30d window.';
REVOKE ALL ON FUNCTION public.prune_processed_webhook_calls(integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.prune_processed_webhook_calls(integer) TO service_role;

-- admin_set_customer_timezone
CREATE OR REPLACE FUNCTION public.admin_set_customer_timezone(
  _submission_id uuid,
  _timezone text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller_id uuid := auth.uid();
  v_caller_email text;
  v_old_tz text;
  v_sub_dealership text;
BEGIN
  IF v_caller_id IS NULL THEN
    RAISE EXCEPTION 'not_authenticated' USING ERRCODE = '28000';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.user_roles
     WHERE user_id = v_caller_id
       AND role IN ('admin', 'manager', 'staff')
  ) THEN
    RAISE EXCEPTION 'not_staff' USING ERRCODE = '42501';
  END IF;
  BEGIN
    PERFORM now() AT TIME ZONE _timezone;
  EXCEPTION WHEN OTHERS THEN
    RAISE EXCEPTION 'invalid_timezone: %', _timezone USING ERRCODE = '22023';
  END;
  SELECT customer_timezone, dealership_id
    INTO v_old_tz, v_sub_dealership
    FROM public.submissions
   WHERE id = _submission_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'submission_not_found: %', _submission_id USING ERRCODE = '02000';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.user_roles
     WHERE user_id = v_caller_id
       AND (is_platform_admin = true OR dealership_id = v_sub_dealership)
  ) THEN
    RAISE EXCEPTION 'wrong_tenant' USING ERRCODE = '42501';
  END IF;
  UPDATE public.submissions
     SET customer_timezone = _timezone
   WHERE id = _submission_id;
  BEGIN
    SELECT email INTO v_caller_email FROM auth.users WHERE id = v_caller_id;
    INSERT INTO public.staff_action_log (
      dealership_id, user_id, user_email, action,
      target_type, target_id, before, after, notes
    ) VALUES (
      v_sub_dealership, v_caller_id, v_caller_email,
      'customer_timezone_overridden', 'submission', _submission_id::text,
      jsonb_build_object('customer_timezone', v_old_tz),
      jsonb_build_object('customer_timezone', _timezone),
      'Manual override via admin_set_customer_timezone RPC'
    );
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'audit insert failed: %', SQLERRM;
  END;
  RETURN _submission_id;
END;
$$;
COMMENT ON FUNCTION public.admin_set_customer_timezone(uuid, text) IS
  'Staff-only manual override for submissions.customer_timezone.';
REVOKE ALL ON FUNCTION public.admin_set_customer_timezone(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_set_customer_timezone(uuid, text) TO authenticated;

-- mark_call_golden: DROP first (existing function has different param defaults)
DROP FUNCTION IF EXISTS public.mark_call_golden(uuid, boolean);
CREATE FUNCTION public.mark_call_golden(
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
  UPDATE voice_call_grades SET golden_pinned = _pinned WHERE id = _grade_id;
  RETURN jsonb_build_object('ok', true, 'pinned', _pinned, 'grade_id', _grade_id);
END;
$$;
COMMENT ON FUNCTION public.mark_call_golden(uuid, boolean) IS
  'Toggle a voice call into / out of the golden-100 regression holdout. Staff-only.';
GRANT EXECUTE ON FUNCTION public.mark_call_golden(uuid, boolean) TO authenticated, service_role;

-- request_offer_increase: add staff gate
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
  FROM submissions WHERE id = _submission_id;
  IF _sub.id IS NULL THEN
    RAISE EXCEPTION 'submission_not_found';
  END IF;
  IF _requested_offer IS NULL OR _requested_offer <= 0 THEN
    RAISE EXCEPTION 'invalid_requested_offer';
  END IF;

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

  IF _is_manager THEN
    PERFORM set_config('app.accept_offer_bypass', 'true', true);
    UPDATE submissions SET offered_price = _requested_offer WHERE id = _submission_id;
    PERFORM set_config('app.accept_offer_bypass', 'false', true);
    _auto_approved := true;
  END IF;

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
  'Create an offer-increase request. Staff-only — non-staff callers raise 42501.';
GRANT EXECUTE ON FUNCTION public.request_offer_increase(uuid, numeric, text, text, text)
  TO authenticated, service_role;

NOTIFY pgrst, 'reload schema';
