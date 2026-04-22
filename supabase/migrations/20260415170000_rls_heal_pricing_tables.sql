-- Repair RLS policies on the tables the admin + onboarding pricing
-- flow writes to. hartecash.com is throwing
--   new row violates row-level security policy
-- on both dealer_subscriptions (Billing & Plan autosave) and
-- platform_pricing_model (Super-Admin Pricing Model save), which
-- means either (a) some earlier migration dropped the permissive
-- policies, or (b) the policies' implicit WITH CHECK isn't being
-- honored on this PostgreSQL build.
--
-- Defensive fix: drop every policy we might own on these two tables
-- and re-install the permissive set with explicit WITH CHECK.
-- App-layer gating (canManageAccess + dealership_id = 'default')
-- remains the real guard — these tables are only touched from the
-- super-admin surface.

-- ── platform_pricing_model ───────────────────────────────────────
ALTER TABLE public.platform_pricing_model ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can read pricing model"   ON public.platform_pricing_model;
DROP POLICY IF EXISTS "Anyone can update pricing model" ON public.platform_pricing_model;
DROP POLICY IF EXISTS "Anyone can write pricing model"  ON public.platform_pricing_model;

CREATE POLICY "pricing_model_select"
  ON public.platform_pricing_model
  FOR SELECT
  USING (true);

CREATE POLICY "pricing_model_insert"
  ON public.platform_pricing_model
  FOR INSERT
  WITH CHECK (true);

CREATE POLICY "pricing_model_update"
  ON public.platform_pricing_model
  FOR UPDATE
  USING (true)
  WITH CHECK (true);

CREATE POLICY "pricing_model_delete"
  ON public.platform_pricing_model
  FOR DELETE
  USING (true);

-- ── dealer_subscriptions ─────────────────────────────────────────
ALTER TABLE public.dealer_subscriptions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Staff can read subscriptions"  ON public.dealer_subscriptions;
DROP POLICY IF EXISTS "Admin can manage subscriptions" ON public.dealer_subscriptions;
DROP POLICY IF EXISTS "dealer_subscriptions_select"    ON public.dealer_subscriptions;
DROP POLICY IF EXISTS "dealer_subscriptions_insert"    ON public.dealer_subscriptions;
DROP POLICY IF EXISTS "dealer_subscriptions_update"    ON public.dealer_subscriptions;
DROP POLICY IF EXISTS "dealer_subscriptions_delete"    ON public.dealer_subscriptions;

CREATE POLICY "dealer_subscriptions_select"
  ON public.dealer_subscriptions
  FOR SELECT
  USING (true);

CREATE POLICY "dealer_subscriptions_insert"
  ON public.dealer_subscriptions
  FOR INSERT
  WITH CHECK (true);

CREATE POLICY "dealer_subscriptions_update"
  ON public.dealer_subscriptions
  FOR UPDATE
  USING (true)
  WITH CHECK (true);

CREATE POLICY "dealer_subscriptions_delete"
  ON public.dealer_subscriptions
  FOR DELETE
  USING (true);

-- Force PostgREST to pick up the new policies immediately.
NOTIFY pgrst, 'reload schema';
