-- Tier 1.2 — Close three open RLS holes flagged in the May 2026 tenant audit.
--
--   1. notification_log SELECT — leaks recipient PII (phone + email) across
--      tenants. Current policy is `is_staff(auth.uid())` with NO dealership
--      filter; any authenticated staff at any tenant can read every other
--      tenant's notification_log. Add a dealership_id check.
--
--   2. dealer_subscriptions — both SELECT and ALL policies are `USING (true)`
--      from 20260412000000_platform_multi_product.sql, meaning billing rows
--      (tier_ids, monthly_amount, status, trial dates) are readable AND
--      writable by anyone authenticated. App-layer gating is the only guard
--      today. Replace with: dealership-scoped read; platform-admin-only writes.
--
--   3. platform_pricing_model — same `USING (true)` + `WITH CHECK (true)`
--      from 20260415140000_*_heal.sql + 20260416000000_ensure_*.sql. The
--      global SaaS price catalog is writable by any authenticated session.
--      Replace with: anyone-can-read (it powers the dealer-facing picker);
--      platform-admin-only writes.
--
-- IDEMPOTENT — uses DROP POLICY IF EXISTS before CREATE so safe to re-apply.
-- Uses the existing public.is_platform_admin() helper, which today resolves
-- on dealership_id = 'default' magic string. Tier 1.1 will swap the helper's
-- internals to a real `is_platform_admin` boolean column without changing
-- any of these policies.

-- ── 1. notification_log ──────────────────────────────────────────────────

DROP POLICY IF EXISTS "Staff can read notification logs" ON public.notification_log;

CREATE POLICY "Staff can read notification logs"
  ON public.notification_log FOR SELECT
  TO authenticated
  USING (
    public.is_platform_admin(auth.uid())
    OR (
      public.is_staff(auth.uid())
      AND dealership_id = public.get_user_dealership_id(auth.uid())
    )
  );

-- ── 2. dealer_subscriptions ──────────────────────────────────────────────
-- Read = the dealer themselves (for /plan + onboarding picker prefill) plus
-- platform admins (for the cross-tenant Platform & Billing surface).
-- Write = platform admins only. Stripe edge functions use the service-role
-- key which bypasses RLS, so the write path through billing-* still works.

DROP POLICY IF EXISTS "Staff can read subscriptions" ON public.dealer_subscriptions;
DROP POLICY IF EXISTS "Admin can manage subscriptions" ON public.dealer_subscriptions;
DROP POLICY IF EXISTS "Dealers can read own subscription" ON public.dealer_subscriptions;
DROP POLICY IF EXISTS "Platform admin can manage subscriptions" ON public.dealer_subscriptions;

CREATE POLICY "Dealers can read own subscription"
  ON public.dealer_subscriptions FOR SELECT
  TO authenticated
  USING (
    public.is_platform_admin(auth.uid())
    OR dealership_id = public.get_user_dealership_id(auth.uid())
  );

CREATE POLICY "Platform admin can manage subscriptions"
  ON public.dealer_subscriptions FOR ALL
  TO authenticated
  USING (public.is_platform_admin(auth.uid()))
  WITH CHECK (public.is_platform_admin(auth.uid()));

-- ── 3. platform_pricing_model ────────────────────────────────────────────
-- Read stays open — the picker on /plan calls this anonymously during
-- onboarding before the dealer has a session. Write tightens to platform
-- admins only.

DROP POLICY IF EXISTS "pricing_model_select" ON public.platform_pricing_model;
DROP POLICY IF EXISTS "pricing_model_insert" ON public.platform_pricing_model;
DROP POLICY IF EXISTS "pricing_model_update" ON public.platform_pricing_model;
DROP POLICY IF EXISTS "Anyone can read pricing model" ON public.platform_pricing_model;
DROP POLICY IF EXISTS "Anyone can update pricing model" ON public.platform_pricing_model;
DROP POLICY IF EXISTS "Anyone can write pricing model" ON public.platform_pricing_model;
DROP POLICY IF EXISTS "Platform admin can write pricing model" ON public.platform_pricing_model;

CREATE POLICY "Anyone can read pricing model"
  ON public.platform_pricing_model FOR SELECT
  USING (true);

CREATE POLICY "Platform admin can write pricing model"
  ON public.platform_pricing_model FOR ALL
  TO authenticated
  USING (public.is_platform_admin(auth.uid()))
  WITH CHECK (public.is_platform_admin(auth.uid()));

NOTIFY pgrst, 'reload schema';
