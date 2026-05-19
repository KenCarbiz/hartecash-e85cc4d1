-- ── vehicle_scans ───────────────────────────────────────────────────
DROP POLICY IF EXISTS "Staff can view scans" ON public.vehicle_scans;
DROP POLICY IF EXISTS "Staff can insert scans" ON public.vehicle_scans;
DROP POLICY IF EXISTS "Staff can update scans" ON public.vehicle_scans;
DROP POLICY IF EXISTS "Staff read own-tenant vehicle_scans" ON public.vehicle_scans;
DROP POLICY IF EXISTS "Staff write own-tenant vehicle_scans" ON public.vehicle_scans;
DROP POLICY IF EXISTS "Staff update own-tenant vehicle_scans" ON public.vehicle_scans;

CREATE POLICY "Staff read own-tenant vehicle_scans"
  ON public.vehicle_scans FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.submissions s
      WHERE s.id = vehicle_scans.submission_id
        AND (
          s.dealership_id = public.get_user_dealership_id(auth.uid())
          OR public.is_platform_admin(auth.uid())
        )
    )
  );

CREATE POLICY "Staff write own-tenant vehicle_scans"
  ON public.vehicle_scans FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.submissions s
      WHERE s.id = vehicle_scans.submission_id
        AND (
          s.dealership_id = public.get_user_dealership_id(auth.uid())
          OR public.is_platform_admin(auth.uid())
        )
    )
  );

CREATE POLICY "Staff update own-tenant vehicle_scans"
  ON public.vehicle_scans FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.submissions s
      WHERE s.id = vehicle_scans.submission_id
        AND (
          s.dealership_id = public.get_user_dealership_id(auth.uid())
          OR public.is_platform_admin(auth.uid())
        )
    )
  );

-- ── vauto_push_log ──────────────────────────────────────────────────
DROP POLICY IF EXISTS "Staff can view push logs" ON public.vauto_push_log;
DROP POLICY IF EXISTS "Staff can insert push logs" ON public.vauto_push_log;
DROP POLICY IF EXISTS "Staff read own-tenant vauto_push_log" ON public.vauto_push_log;
DROP POLICY IF EXISTS "Staff write own-tenant vauto_push_log" ON public.vauto_push_log;

CREATE POLICY "Staff read own-tenant vauto_push_log"
  ON public.vauto_push_log FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.submissions s
      WHERE s.id = vauto_push_log.submission_id
        AND (
          s.dealership_id = public.get_user_dealership_id(auth.uid())
          OR public.is_platform_admin(auth.uid())
        )
    )
  );

CREATE POLICY "Staff write own-tenant vauto_push_log"
  ON public.vauto_push_log FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.submissions s
      WHERE s.id = vauto_push_log.submission_id
        AND (
          s.dealership_id = public.get_user_dealership_id(auth.uid())
          OR public.is_platform_admin(auth.uid())
        )
    )
  );

-- ── revaluation_log ─────────────────────────────────────────────────
DROP POLICY IF EXISTS "Staff can view revaluation log" ON public.revaluation_log;
DROP POLICY IF EXISTS "Service can insert revaluation" ON public.revaluation_log;
DROP POLICY IF EXISTS "Staff read own-tenant revaluation_log" ON public.revaluation_log;

CREATE POLICY "Staff read own-tenant revaluation_log"
  ON public.revaluation_log FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.submissions s
      WHERE s.id = revaluation_log.submission_id
        AND (
          s.dealership_id = public.get_user_dealership_id(auth.uid())
          OR public.is_platform_admin(auth.uid())
        )
    )
  );

-- ── sms_inbound_log ─────────────────────────────────────────────────
DROP POLICY IF EXISTS "Staff read inbound log" ON public.sms_inbound_log;
DROP POLICY IF EXISTS "Staff read own-tenant sms_inbound_log" ON public.sms_inbound_log;

CREATE POLICY "Staff read own-tenant sms_inbound_log"
  ON public.sms_inbound_log FOR SELECT TO authenticated
  USING (
    (
      submission_id IS NOT NULL
      AND EXISTS (
        SELECT 1 FROM public.submissions s
        WHERE s.id = sms_inbound_log.submission_id
          AND s.dealership_id = public.get_user_dealership_id(auth.uid())
      )
    )
    OR (
      submission_id IS NULL
      AND sms_inbound_log.dealership_id = public.get_user_dealership_id(auth.uid())
    )
    OR public.is_platform_admin(auth.uid())
  );

-- ── photo_metadata ──────────────────────────────────────────────────
DROP POLICY IF EXISTS photo_metadata_select_all ON public.photo_metadata;
DROP POLICY IF EXISTS photo_metadata_insert_all ON public.photo_metadata;
DROP POLICY IF EXISTS photo_metadata_update_all ON public.photo_metadata;
DROP POLICY IF EXISTS "Staff read own-tenant photo_metadata" ON public.photo_metadata;
DROP POLICY IF EXISTS "Anonymous insert photo_metadata" ON public.photo_metadata;
DROP POLICY IF EXISTS "Staff update own-tenant photo_metadata" ON public.photo_metadata;

CREATE POLICY "Staff read own-tenant photo_metadata"
  ON public.photo_metadata FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.submissions s
      WHERE s.id = photo_metadata.submission_id
        AND (
          s.dealership_id = public.get_user_dealership_id(auth.uid())
          OR public.is_platform_admin(auth.uid())
        )
    )
  );

CREATE POLICY "Anonymous insert photo_metadata"
  ON public.photo_metadata FOR INSERT TO anon, authenticated
  WITH CHECK (true);

CREATE POLICY "Staff update own-tenant photo_metadata"
  ON public.photo_metadata FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.submissions s
      WHERE s.id = photo_metadata.submission_id
        AND (
          s.dealership_id = public.get_user_dealership_id(auth.uid())
          OR public.is_platform_admin(auth.uid())
        )
    )
  );

-- ── admin_set_customer_timezone: broaden role list ──────────────────
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
       AND role IN ('admin', 'manager', 'staff', 'gsm_gm', 'gm',
                    'used_car_manager', 'salesperson', 'bdc')
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
      v_sub_dealership,
      v_caller_id,
      v_caller_email,
      'customer_timezone_overridden',
      'submission',
      _submission_id::text,
      jsonb_build_object('customer_timezone', v_old_tz),
      jsonb_build_object('customer_timezone', _timezone),
      'Manual override via admin_set_customer_timezone RPC'
    );
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'admin_set_customer_timezone: audit insert failed (continuing): %', SQLERRM;
  END;

  RETURN _submission_id;
END;
$$;

NOTIFY pgrst, 'reload schema';