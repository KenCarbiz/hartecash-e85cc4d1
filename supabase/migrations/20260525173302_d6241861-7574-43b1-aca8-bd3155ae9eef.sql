-- Fix linter 0024: permissive RLS write policies evaluating to "always true".
-- Idempotent: each policy dropped before recreation.

-- 1. vehicle_image_cache: restrict INSERT to service_role
DROP POLICY IF EXISTS "Service role can insert vehicle image cache" ON public.vehicle_image_cache;
CREATE POLICY "Service role can insert vehicle image cache"
  ON public.vehicle_image_cache
  FOR INSERT
  TO service_role
  WITH CHECK (auth.role() = 'service_role');

-- 2. prospect_demo_views: require demo_id on insert
DROP POLICY IF EXISTS "Anyone can log a demo view" ON public.prospect_demo_views;
CREATE POLICY "Anyone can log a demo view"
  ON public.prospect_demo_views
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (demo_id IS NOT NULL);

-- 3. login_attempt_log: require non-empty email on insert
DROP POLICY IF EXISTS "Anon write own login attempts" ON public.login_attempt_log;
CREATE POLICY "Anon write own login attempts"
  ON public.login_attempt_log
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (email IS NOT NULL AND length(email) BETWEEN 3 AND 320);

-- 4. submissions: require non-empty token on public create
DROP POLICY IF EXISTS "Anyone can create submissions" ON public.submissions;
CREATE POLICY "Anyone can create submissions"
  ON public.submissions
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (token IS NOT NULL AND length(token) >= 16);

-- 5. opt_outs: require valid token and channel on public opt-out
DROP POLICY IF EXISTS "Anyone can opt out" ON public.opt_outs;
CREATE POLICY "Anyone can opt out"
  ON public.opt_outs
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (
    token IS NOT NULL
    AND length(token) >= 16
    AND channel IN ('sms', 'email', 'voice', 'all')
  );

-- 6. platform_pricing_model: split FOR ALL into explicit per-command policies
DROP POLICY IF EXISTS "Platform admin can write pricing model" ON public.platform_pricing_model;
DROP POLICY IF EXISTS "Platform admin can insert pricing model" ON public.platform_pricing_model;
DROP POLICY IF EXISTS "Platform admin can update pricing model" ON public.platform_pricing_model;
DROP POLICY IF EXISTS "Platform admin can delete pricing model" ON public.platform_pricing_model;

CREATE POLICY "Platform admin can insert pricing model"
  ON public.platform_pricing_model
  FOR INSERT
  TO authenticated
  WITH CHECK (is_platform_admin(auth.uid()));

CREATE POLICY "Platform admin can update pricing model"
  ON public.platform_pricing_model
  FOR UPDATE
  TO authenticated
  USING (is_platform_admin(auth.uid()))
  WITH CHECK (is_platform_admin(auth.uid()));

CREATE POLICY "Platform admin can delete pricing model"
  ON public.platform_pricing_model
  FOR DELETE
  TO authenticated
  USING (is_platform_admin(auth.uid()));

-- 7. dealer_subscriptions: split FOR ALL into per-command policies
DROP POLICY IF EXISTS "Admin can manage subscriptions" ON public.dealer_subscriptions;
DROP POLICY IF EXISTS "Platform admin can manage subscriptions" ON public.dealer_subscriptions;
DROP POLICY IF EXISTS "Admin can insert subscriptions" ON public.dealer_subscriptions;
DROP POLICY IF EXISTS "Admin can update subscriptions" ON public.dealer_subscriptions;
DROP POLICY IF EXISTS "Admin can delete subscriptions" ON public.dealer_subscriptions;
DROP POLICY IF EXISTS "Platform admin can insert subscriptions" ON public.dealer_subscriptions;
DROP POLICY IF EXISTS "Platform admin can update subscriptions" ON public.dealer_subscriptions;
DROP POLICY IF EXISTS "Platform admin can delete subscriptions" ON public.dealer_subscriptions;

-- Platform admins (unrestricted)
CREATE POLICY "Platform admin can insert subscriptions"
  ON public.dealer_subscriptions
  FOR INSERT
  TO authenticated
  WITH CHECK (is_platform_admin(auth.uid()));

CREATE POLICY "Platform admin can update subscriptions"
  ON public.dealer_subscriptions
  FOR UPDATE
  TO authenticated
  USING (is_platform_admin(auth.uid()))
  WITH CHECK (is_platform_admin(auth.uid()));

CREATE POLICY "Platform admin can delete subscriptions"
  ON public.dealer_subscriptions
  FOR DELETE
  TO authenticated
  USING (is_platform_admin(auth.uid()));

-- Dealership admins (scoped to own dealership)
CREATE POLICY "Admin can insert subscriptions"
  ON public.dealer_subscriptions
  FOR INSERT
  TO authenticated
  WITH CHECK (
    has_role(auth.uid(), 'admin'::app_role)
    AND dealership_id = get_user_dealership_id(auth.uid())
  );

CREATE POLICY "Admin can update subscriptions"
  ON public.dealer_subscriptions
  FOR UPDATE
  TO authenticated
  USING (
    has_role(auth.uid(), 'admin'::app_role)
    AND dealership_id = get_user_dealership_id(auth.uid())
  )
  WITH CHECK (
    has_role(auth.uid(), 'admin'::app_role)
    AND dealership_id = get_user_dealership_id(auth.uid())
  );

CREATE POLICY "Admin can delete subscriptions"
  ON public.dealer_subscriptions
  FOR DELETE
  TO authenticated
  USING (
    has_role(auth.uid(), 'admin'::app_role)
    AND dealership_id = get_user_dealership_id(auth.uid())
  );

NOTIFY pgrst, 'reload schema';