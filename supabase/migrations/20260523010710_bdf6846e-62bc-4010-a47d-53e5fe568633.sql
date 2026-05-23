
-- 1. login_attempt_log — scope admin reads to own tenant
DROP POLICY IF EXISTS "Authenticated read own login attempts" ON public.login_attempt_log;
CREATE POLICY "Authenticated read own or own-tenant login attempts"
ON public.login_attempt_log
FOR SELECT
TO authenticated
USING (
  email = (auth.jwt() ->> 'email')
  OR is_platform_admin(auth.uid())
  OR (
    has_role(auth.uid(), 'admin'::app_role)
    AND email IN (
      SELECT p.email
      FROM public.profiles p
      JOIN public.user_roles ur ON ur.user_id = p.user_id
      WHERE ur.dealership_id = get_user_dealership_id(auth.uid())
    )
  )
);

-- 2. pricing_model_access_requests — scope admin/GM management to own tenant
DROP POLICY IF EXISTS "Admins and GM can manage access requests" ON public.pricing_model_access_requests;
CREATE POLICY "Admins and GM manage own-tenant access requests"
ON public.pricing_model_access_requests
FOR ALL
TO authenticated
USING (
  is_platform_admin(auth.uid())
  OR (
    (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'gsm_gm'::app_role))
    AND EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.user_id = pricing_model_access_requests.user_id
        AND ur.dealership_id = get_user_dealership_id(auth.uid())
    )
  )
)
WITH CHECK (
  is_platform_admin(auth.uid())
  OR (
    (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'gsm_gm'::app_role))
    AND EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.user_id = pricing_model_access_requests.user_id
        AND ur.dealership_id = get_user_dealership_id(auth.uid())
    )
  )
);

-- 3. watched_vehicle_history — drop public read, keep staff-only
DROP POLICY IF EXISTS "Anyone can read history" ON public.watched_vehicle_history;
DROP POLICY IF EXISTS "Staff can read history" ON public.watched_vehicle_history;
CREATE POLICY "Staff can read history"
ON public.watched_vehicle_history
FOR SELECT
TO authenticated
USING (is_staff(auth.uid()));

-- 4. Cache tables — explicit service-role policies (documentation + safety)
DROP POLICY IF EXISTS "Service role manages bb_vin_cache" ON public.bb_vin_cache;
CREATE POLICY "Service role manages bb_vin_cache"
ON public.bb_vin_cache
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

DROP POLICY IF EXISTS "Service role manages lookup_attempts" ON public.lookup_attempts;
CREATE POLICY "Service role manages lookup_attempts"
ON public.lookup_attempts
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- 5. Realtime — block anonymous subscriptions explicitly (restrictive)
DROP POLICY IF EXISTS "Block anon realtime select" ON realtime.messages;
CREATE POLICY "Block anon realtime select"
ON realtime.messages
AS RESTRICTIVE
FOR SELECT
TO anon
USING (false);

DROP POLICY IF EXISTS "Block anon realtime insert" ON realtime.messages;
CREATE POLICY "Block anon realtime insert"
ON realtime.messages
AS RESTRICTIVE
FOR INSERT
TO anon
WITH CHECK (false);

NOTIFY pgrst, 'reload schema';
