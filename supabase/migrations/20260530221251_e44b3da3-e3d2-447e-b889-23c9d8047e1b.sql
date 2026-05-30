
-- 1. Tenant-scope decide_offer_request
CREATE OR REPLACE FUNCTION public.decide_offer_request(_request_id uuid, _decision text, _decision_notes text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _req   record;
  _is_manager boolean;
  _caller_dealership text;
BEGIN
  IF _decision NOT IN ('approved','denied') THEN
    RAISE EXCEPTION 'invalid_decision';
  END IF;

  SELECT * INTO _req FROM offer_approval_requests WHERE id = _request_id;
  IF _req.id IS NULL THEN
    RAISE EXCEPTION 'request_not_found';
  END IF;
  IF _req.status NOT IN ('pending') THEN
    RAISE EXCEPTION 'request_already_decided';
  END IF;

  -- Tenant isolation: caller must belong to the same dealership or be platform admin
  _caller_dealership := get_user_dealership_id(auth.uid());
  IF NOT is_platform_admin(auth.uid())
     AND (_req.dealership_id IS DISTINCT FROM _caller_dealership) THEN
    RAISE EXCEPTION 'cross_tenant_access_denied' USING ERRCODE = '42501';
  END IF;

  _is_manager :=
       has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'gsm_gm'::app_role)
    OR has_role(auth.uid(), 'gm'::app_role)
    OR has_role(auth.uid(), 'used_car_manager'::app_role);
  IF NOT _is_manager THEN
    RAISE EXCEPTION 'only_managers_can_decide';
  END IF;

  IF _decision = 'approved' THEN
    PERFORM set_config('app.accept_offer_bypass', 'true', true);
    UPDATE submissions
      SET offered_price = _req.requested_offer
      WHERE id = _req.submission_id;
    PERFORM set_config('app.accept_offer_bypass', 'false', true);
  END IF;

  UPDATE offer_approval_requests
  SET status = _decision,
      decided_by = auth.uid(),
      decided_at = now(),
      decision_notes = _decision_notes,
      applied_at = CASE WHEN _decision = 'approved' THEN now() ELSE NULL END
  WHERE id = _request_id;

  INSERT INTO activity_log
    (submission_id, action, old_value, new_value, performed_by, created_at)
  VALUES
    (_req.submission_id,
     'offer_increase_' || _decision,
     COALESCE(_req.current_offer::text, ''),
     _req.requested_offer::text,
     auth.uid()::text,
     now());

  RETURN jsonb_build_object(
    'ok', true,
    'request_id', _request_id,
    'status', _decision,
    'applied', _decision = 'approved'
  );
END;
$function$;

-- 2. Tenant-scope request_offer_increase: add cross-tenant guard after submission load
CREATE OR REPLACE FUNCTION public.request_offer_increase(_submission_id uuid, _requested_offer numeric, _reason text DEFAULT 'other'::text, _reason_notes text DEFAULT NULL::text, _requested_by_role text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _sub               record;
  _is_manager        boolean;
  _request_id        uuid;
  _caller_id         uuid := auth.uid();
  _caller_dealership text;
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

  -- Tenant isolation
  _caller_dealership := get_user_dealership_id(_caller_id);
  IF NOT is_platform_admin(_caller_id)
     AND (_sub.dealership_id IS DISTINCT FROM _caller_dealership) THEN
    RAISE EXCEPTION 'cross_tenant_access_denied' USING ERRCODE = '42501';
  END IF;

  IF _requested_offer IS NULL OR _requested_offer <= 0 THEN
    RAISE EXCEPTION 'invalid_requested_offer';
  END IF;

  _is_manager :=
       has_role(_caller_id, 'admin'::app_role)
    OR has_role(_caller_id, 'gsm_gm'::app_role)
    OR has_role(_caller_id, 'gm'::app_role)
    OR has_role(_caller_id, 'used_car_manager'::app_role);

  INSERT INTO offer_approval_requests
    (submission_id, dealership_id, current_offer, requested_offer,
     acv_value_at_request, reason, reason_notes,
     requested_by, requested_by_role, status,
     decided_by, decided_at, applied_at)
  VALUES
    (_submission_id, _sub.dealership_id, _sub.offered_price, _requested_offer,
     _sub.acv_value, _reason, _reason_notes,
     _caller_id,
     COALESCE(_requested_by_role, CASE WHEN _is_manager THEN 'manager' ELSE 'staff' END),
     'pending', NULL, NULL, NULL)
  RETURNING id INTO _request_id;

  RETURN jsonb_build_object('ok', true, 'request_id', _request_id, 'status', 'pending');
END;
$function$;

-- 3. UPDATE policy on offer_approval_requests (managers in same tenant)
DROP POLICY IF EXISTS "Managers update own tenant offer approvals" ON public.offer_approval_requests;
CREATE POLICY "Managers update own tenant offer approvals"
ON public.offer_approval_requests
FOR UPDATE
TO authenticated
USING (
  is_platform_admin(auth.uid())
  OR (
    (dealership_id = get_user_dealership_id(auth.uid()))
    AND (
      has_role(auth.uid(), 'admin'::app_role)
      OR has_role(auth.uid(), 'gsm_gm'::app_role)
      OR has_role(auth.uid(), 'gm'::app_role)
      OR has_role(auth.uid(), 'used_car_manager'::app_role)
    )
  )
)
WITH CHECK (
  is_platform_admin(auth.uid())
  OR (
    (dealership_id = get_user_dealership_id(auth.uid()))
    AND (
      has_role(auth.uid(), 'admin'::app_role)
      OR has_role(auth.uid(), 'gsm_gm'::app_role)
      OR has_role(auth.uid(), 'gm'::app_role)
      OR has_role(auth.uid(), 'used_car_manager'::app_role)
    )
  )
);

-- 4. INSERT/UPDATE/DELETE policies on offer_bumps for staff within same tenant
DROP POLICY IF EXISTS "offer_bumps_dealer_insert" ON public.offer_bumps;
CREATE POLICY "offer_bumps_dealer_insert"
ON public.offer_bumps
FOR INSERT
TO authenticated
WITH CHECK (
  is_platform_admin(auth.uid())
  OR (is_staff(auth.uid()) AND dealership_id = get_user_dealership_id(auth.uid()))
);

DROP POLICY IF EXISTS "offer_bumps_dealer_update" ON public.offer_bumps;
CREATE POLICY "offer_bumps_dealer_update"
ON public.offer_bumps
FOR UPDATE
TO authenticated
USING (
  is_platform_admin(auth.uid())
  OR (is_staff(auth.uid()) AND dealership_id = get_user_dealership_id(auth.uid()))
)
WITH CHECK (
  is_platform_admin(auth.uid())
  OR (is_staff(auth.uid()) AND dealership_id = get_user_dealership_id(auth.uid()))
);

DROP POLICY IF EXISTS "offer_bumps_dealer_delete" ON public.offer_bumps;
CREATE POLICY "offer_bumps_dealer_delete"
ON public.offer_bumps
FOR DELETE
TO authenticated
USING (
  is_platform_admin(auth.uid())
  OR (has_role(auth.uid(), 'admin'::app_role) AND dealership_id = get_user_dealership_id(auth.uid()))
);

-- 5. Staff SELECT on offer_watches scoped to same tenant via submissions.token
DROP POLICY IF EXISTS "offer_watches_staff_read_own_tenant" ON public.offer_watches;
CREATE POLICY "offer_watches_staff_read_own_tenant"
ON public.offer_watches
FOR SELECT
TO authenticated
USING (
  is_platform_admin(auth.uid())
  OR (
    is_staff(auth.uid())
    AND EXISTS (
      SELECT 1 FROM public.submissions s
      WHERE s.token = offer_watches.token
        AND s.dealership_id = get_user_dealership_id(auth.uid())
    )
  )
);

-- 6. error_log: allow client-side error reports, but scrub privileged fields
CREATE OR REPLACE FUNCTION public.scrub_error_log_client_insert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid uuid := auth.uid();
  _is_admin boolean := false;
BEGIN
  IF _uid IS NOT NULL THEN
    _is_admin := has_role(_uid, 'admin'::app_role) OR is_platform_admin(_uid);
  END IF;

  -- Non-admin client/anon callers cannot set privileged fields
  IF NOT _is_admin THEN
    NEW.source := 'client';
    NEW.user_id := _uid; -- bind to caller, or NULL for anon
    NEW.dealership_id := NULL;
    NEW.submission_id := NULL;
    NEW.call_id := NULL;
    -- Cap field sizes defensively
    IF NEW.message IS NOT NULL AND length(NEW.message) > 4000 THEN
      NEW.message := left(NEW.message, 4000);
    END IF;
    IF NEW.stack IS NOT NULL AND length(NEW.stack) > 8000 THEN
      NEW.stack := left(NEW.stack, 8000);
    END IF;
    IF NEW.page_url IS NOT NULL AND length(NEW.page_url) > 2000 THEN
      NEW.page_url := left(NEW.page_url, 2000);
    END IF;
    IF NEW.user_agent IS NOT NULL AND length(NEW.user_agent) > 1000 THEN
      NEW.user_agent := left(NEW.user_agent, 1000);
    END IF;
    -- Only allow non-fatal severities from clients
    IF NEW.severity NOT IN ('debug','info','warning','error') THEN
      NEW.severity := 'error';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_scrub_error_log_client_insert ON public.error_log;
CREATE TRIGGER trg_scrub_error_log_client_insert
BEFORE INSERT ON public.error_log
FOR EACH ROW
EXECUTE FUNCTION public.scrub_error_log_client_insert();

GRANT INSERT ON public.error_log TO anon, authenticated;

DROP POLICY IF EXISTS "Client error reports insert" ON public.error_log;
CREATE POLICY "Client error reports insert"
ON public.error_log
FOR INSERT
TO anon, authenticated
WITH CHECK (source = 'client');

NOTIFY pgrst, 'reload schema';
