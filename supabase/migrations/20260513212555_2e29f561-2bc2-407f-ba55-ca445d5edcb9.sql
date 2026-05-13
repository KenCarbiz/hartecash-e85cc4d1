-- Part A: helper now returns NULL for unassigned users (was 'default').
-- Edge functions that need the legacy fallback already coalesce to 'default' in app code.
CREATE OR REPLACE FUNCTION public.get_user_dealership_id(_user_id uuid)
RETURNS text
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT dealership_id
  FROM public.user_roles
  WHERE user_id = _user_id
  LIMIT 1;
$function$;

-- Part B: prepend is_staff(auth.uid()) to every dealership-scoped policy
-- the advisor flagged. Keep platform_admin / has_role('admin') OR-branches intact.

-- ai_reappraisal_log
DROP POLICY IF EXISTS "ai_reappraisal_staff_read_own_tenant" ON public.ai_reappraisal_log;
CREATE POLICY "ai_reappraisal_staff_read_own_tenant"
ON public.ai_reappraisal_log FOR SELECT
USING (
  public.is_platform_admin(auth.uid())
  OR (public.is_staff(auth.uid()) AND dealership_id = public.get_user_dealership_id(auth.uid()))
);

-- boost_bump_rules (FOR ALL — guard both USING and WITH CHECK)
DROP POLICY IF EXISTS "boost_bump_rules_dealer_rw" ON public.boost_bump_rules;
CREATE POLICY "boost_bump_rules_dealer_rw"
ON public.boost_bump_rules FOR ALL
USING (
  public.is_platform_admin(auth.uid())
  OR (public.is_staff(auth.uid()) AND dealership_id = public.get_user_dealership_id(auth.uid()))
)
WITH CHECK (
  public.is_platform_admin(auth.uid())
  OR (public.is_staff(auth.uid()) AND dealership_id = public.get_user_dealership_id(auth.uid()))
);

-- data_egress_log
DROP POLICY IF EXISTS "Dealer admin can read own egress logs" ON public.data_egress_log;
CREATE POLICY "Dealer admin can read own egress logs"
ON public.data_egress_log FOR SELECT
USING (
  public.is_staff(auth.uid())
  AND dealership_id = public.get_user_dealership_id(auth.uid())
);

-- dealer_subscriptions
DROP POLICY IF EXISTS "Dealers can read own subscription" ON public.dealer_subscriptions;
CREATE POLICY "Dealers can read own subscription"
ON public.dealer_subscriptions FOR SELECT
USING (
  public.is_platform_admin(auth.uid())
  OR (public.is_staff(auth.uid()) AND dealership_id = public.get_user_dealership_id(auth.uid()))
);

-- embed_events
DROP POLICY IF EXISTS "embed_events_dealer_read" ON public.embed_events;
CREATE POLICY "embed_events_dealer_read"
ON public.embed_events FOR SELECT
USING (
  public.is_platform_admin(auth.uid())
  OR (public.is_staff(auth.uid()) AND dealership_id = public.get_user_dealership_id(auth.uid()))
);

-- offer_approval_requests (INSERT + SELECT)
DROP POLICY IF EXISTS "Staff insert own tenant offer approvals" ON public.offer_approval_requests;
CREATE POLICY "Staff insert own tenant offer approvals"
ON public.offer_approval_requests FOR INSERT
WITH CHECK (
  public.has_role(auth.uid(), 'admin'::app_role)
  OR (public.is_staff(auth.uid()) AND dealership_id = public.get_user_dealership_id(auth.uid()))
);

DROP POLICY IF EXISTS "Staff read own tenant offer approvals" ON public.offer_approval_requests;
CREATE POLICY "Staff read own tenant offer approvals"
ON public.offer_approval_requests FOR SELECT
USING (
  public.has_role(auth.uid(), 'admin'::app_role)
  OR (public.is_staff(auth.uid()) AND dealership_id = public.get_user_dealership_id(auth.uid()))
);

-- offer_bumps
DROP POLICY IF EXISTS "offer_bumps_dealer_read" ON public.offer_bumps;
CREATE POLICY "offer_bumps_dealer_read"
ON public.offer_bumps FOR SELECT
USING (
  public.is_platform_admin(auth.uid())
  OR (public.is_staff(auth.uid()) AND dealership_id = public.get_user_dealership_id(auth.uid()))
);

NOTIFY pgrst, 'reload schema';