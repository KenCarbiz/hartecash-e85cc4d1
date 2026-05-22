
-- Security hardening: RLS tightening (safe set)
-- See security scan results 2026-05-22

-- 1. activity_log: convert misleading PERMISSIVE deny into a RESTRICTIVE deny
DROP POLICY IF EXISTS "Deny anonymous access to activity_log" ON public.activity_log;
CREATE POLICY "Deny anonymous access to activity_log"
  ON public.activity_log AS RESTRICTIVE FOR ALL TO anon
  USING (false) WITH CHECK (false);

-- 2. platform_pricing_model: remove anon read; authenticated only
DROP POLICY IF EXISTS "Anyone can read pricing model" ON public.platform_pricing_model;
CREATE POLICY "Authenticated can read pricing model"
  ON public.platform_pricing_model FOR SELECT TO authenticated
  USING (true);

-- 3. sms_opt_outs: scope staff read to own tenant (platform admin sees all)
DROP POLICY IF EXISTS "Staff read opt-outs" ON public.sms_opt_outs;
CREATE POLICY "Staff read opt-outs in own tenant"
  ON public.sms_opt_outs FOR SELECT TO authenticated
  USING (
    public.is_platform_admin(auth.uid())
    OR (public.is_staff(auth.uid())
        AND dealership_id = public.get_user_dealership_id(auth.uid()))
  );

-- 4. staff_action_log: lock down INSERT to staff in own tenant
DROP POLICY IF EXISTS staff_action_log_authenticated_insert ON public.staff_action_log;
CREATE POLICY staff_action_log_staff_insert
  ON public.staff_action_log FOR INSERT TO authenticated
  WITH CHECK (
    public.is_platform_admin(auth.uid())
    OR (public.is_staff(auth.uid())
        AND dealership_id = public.get_user_dealership_id(auth.uid())
        AND (user_id IS NULL OR user_id = auth.uid()))
  );

-- 5. dealer_accounts: restrict SELECT to admins only (vAuto credentials live here)
--    Sales/BDC reps lose direct table read access; admin UI continues to work.
DROP POLICY IF EXISTS "Staff can read own tenant dealer accounts" ON public.dealer_accounts;
CREATE POLICY "Admins can read own tenant dealer accounts"
  ON public.dealer_accounts FOR SELECT TO authenticated
  USING (
    public.is_platform_admin(auth.uid())
    OR (public.has_role(auth.uid(), 'admin'::public.app_role)
        AND dealership_id = public.get_user_dealership_id(auth.uid()))
  );

-- 6. offer_watches: drop unscoped staff_read; restrict to platform admins (no
--    dealership_id column to scope tenant staff). Insert-by-anon stays.
DROP POLICY IF EXISTS offer_watches_staff_read ON public.offer_watches;
CREATE POLICY offer_watches_platform_admin_read
  ON public.offer_watches FOR SELECT TO authenticated
  USING (public.is_platform_admin(auth.uid()));

NOTIFY pgrst, 'reload schema';
