-- Admin override for submissions.customer_timezone.
--
-- Context: PR #234 captures the browser's IANA tz at form submit, and
-- the trigger from 20260515120000 preserves a non-NULL value over the
-- state-derived default. But for the 69 existing rows that were
-- backfilled from state alone (and for any legacy/imported submission
-- where the browser stamp never happened), the cached tz can be wrong
-- — a Pensacola customer in FL panhandle gets gated against Eastern
-- when they're actually Central.
--
-- The original geoip-backfill plan turned out non-viable in this
-- project: consent_log.ip_address exists in the schema but is never
-- populated (browser JS can't read its own public IP, and the form
-- submit doesn't capture client IP server-side).
--
-- Instead, this migration exposes a tightly-scoped admin RPC:
--
--   admin_set_customer_timezone(_submission_id uuid, _timezone text)
--     → returns the updated row id, or raises on invalid input
--
-- Usage:
--   * Staff opens a submission, notices the tz looks wrong, calls
--     this RPC from the admin UI.
--   * The RPC validates _timezone parses as a real IANA zone, updates
--     the row, and writes a staff_action_log entry so the change is
--     auditable.
--
-- RLS: SECURITY DEFINER with an internal staff/role check (matches the
-- pattern used by update_staff_role, decide_offer_request). Non-staff
-- callers get a hard reject.
--
-- Idempotent (CREATE OR REPLACE).

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
  v_caller_dealership text;
  v_old_tz text;
  v_sub_dealership text;
BEGIN
  -- 1. Must be authenticated.
  IF v_caller_id IS NULL THEN
    RAISE EXCEPTION 'not_authenticated' USING ERRCODE = '28000';
  END IF;

  -- 2. Must be staff on at least one tenant. We check user_roles
  --    instead of is_staff() so a platform admin can also override
  --    across rooftops.
  IF NOT EXISTS (
    SELECT 1 FROM public.user_roles
     WHERE user_id = v_caller_id
       AND role IN ('admin', 'manager', 'staff')
  ) THEN
    RAISE EXCEPTION 'not_staff' USING ERRCODE = '42501';
  END IF;

  -- 3. Validate the supplied tz parses as a real IANA zone. The
  --    cleanest way in plpgsql is AT TIME ZONE — invalid zones raise.
  BEGIN
    PERFORM now() AT TIME ZONE _timezone;
  EXCEPTION WHEN OTHERS THEN
    RAISE EXCEPTION 'invalid_timezone: %', _timezone USING ERRCODE = '22023';
  END;

  -- 4. Capture the prior value for the audit row.
  SELECT customer_timezone, dealership_id
    INTO v_old_tz, v_sub_dealership
    FROM public.submissions
   WHERE id = _submission_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'submission_not_found: %', _submission_id USING ERRCODE = '02000';
  END IF;

  -- 5. Tenant scope: a non-platform-admin must belong to the
  --    submission's dealership. Platform admins (is_platform_admin)
  --    bypass.
  IF NOT EXISTS (
    SELECT 1 FROM public.user_roles
     WHERE user_id = v_caller_id
       AND (is_platform_admin = true OR dealership_id = v_sub_dealership)
  ) THEN
    RAISE EXCEPTION 'wrong_tenant' USING ERRCODE = '42501';
  END IF;

  -- 6. Apply.
  UPDATE public.submissions
     SET customer_timezone = _timezone
   WHERE id = _submission_id;

  -- 7. Audit. Best-effort — auditing failure must not block the
  --    legitimate update.
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

COMMENT ON FUNCTION public.admin_set_customer_timezone(uuid, text) IS
  'Staff-only manual override for submissions.customer_timezone. Validates the IANA zone, writes a staff_action_log audit row. Use when the browser-stamped or state-derived tz is wrong (e.g. customer disclosed a different home tz). Platform admins bypass tenant-scope.';

REVOKE ALL ON FUNCTION public.admin_set_customer_timezone(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_set_customer_timezone(uuid, text) TO authenticated;

NOTIFY pgrst, 'reload schema';
