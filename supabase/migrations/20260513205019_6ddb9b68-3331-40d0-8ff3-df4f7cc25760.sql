-- Security fixes: tighten RLS scoping for sensitive tables

-- 1) ai_reappraisal_log: remove blanket authenticated ALL policy; restrict
--    writes to service_role and reads to staff in the same dealership.
DROP POLICY IF EXISTS "ai_reappraisal_service_all" ON public.ai_reappraisal_log;

CREATE POLICY "ai_reappraisal_service_role_all"
  ON public.ai_reappraisal_log
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY "ai_reappraisal_staff_read_own_tenant"
  ON public.ai_reappraisal_log
  FOR SELECT
  TO authenticated
  USING (
    public.is_platform_admin(auth.uid())
    OR dealership_id = public.get_user_dealership_id(auth.uid())
  );

-- 2) customer_data_purge_queue: scope admin reads to their own tenant by
--    joining through submissions.dealership_id.
DROP POLICY IF EXISTS "Admins read own tenant purge_queue" ON public.customer_data_purge_queue;

CREATE POLICY "Admins read own tenant purge_queue"
  ON public.customer_data_purge_queue
  FOR SELECT
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin'::app_role)
    AND (
      public.is_platform_admin(auth.uid())
      OR EXISTS (
        SELECT 1 FROM public.submissions s
        WHERE s.id = customer_data_purge_queue.submission_id
          AND s.dealership_id = public.get_user_dealership_id(auth.uid())
      )
    )
  );

-- 3) boost_bump_rules: restrict write/read policy from public to authenticated.
DROP POLICY IF EXISTS "boost_bump_rules_dealer_rw" ON public.boost_bump_rules;

CREATE POLICY "boost_bump_rules_dealer_rw"
  ON public.boost_bump_rules
  FOR ALL
  TO authenticated
  USING (
    public.is_platform_admin(auth.uid())
    OR dealership_id = public.get_user_dealership_id(auth.uid())
  )
  WITH CHECK (
    public.is_platform_admin(auth.uid())
    OR dealership_id = public.get_user_dealership_id(auth.uid())
  );

-- 4) offer_bumps: restrict read policy from public to authenticated.
DROP POLICY IF EXISTS "offer_bumps_dealer_read" ON public.offer_bumps;

CREATE POLICY "offer_bumps_dealer_read"
  ON public.offer_bumps
  FOR SELECT
  TO authenticated
  USING (
    public.is_platform_admin(auth.uid())
    OR dealership_id = public.get_user_dealership_id(auth.uid())
  );

NOTIFY pgrst, 'reload schema';