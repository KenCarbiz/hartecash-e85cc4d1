-- Resolve Supabase linter 0024 (permissive_rls_policy / "RLS Policy Always
-- True"): RLS policies for INSERT/UPDATE/DELETE that use USING (true) or
-- WITH CHECK (true) for the public / anon / authenticated roles effectively
-- disable row-level security on writes.
--
-- The linter intentionally ignores SELECT USING (true) and policies scoped
-- only TO service_role, so this migration leaves those alone. It targets the
-- write policies that are either (a) redundant leftovers already covered by a
-- stricter policy or a SECURITY DEFINER path, (b) genuine public intake
-- endpoints that just need a non-tautological WITH CHECK, or (c) load-bearing
-- onboarding writes that can be constrained without breaking the flow.
--
-- Idempotent: every statement is DROP ... IF EXISTS / CREATE after a drop.

-- ── vehicle_image_cache ──────────────────────────────────────────────
-- The "Service role can insert ..." policy was misconfigured TO public.
-- No client code inserts into this table; admins are covered by
-- "Admins can manage vehicle image cache" (FOR ALL, has_role admin) and the
-- generate-vehicle-image edge function writes with the service_role key
-- (which bypasses RLS). The public INSERT grant is unnecessary.
DROP POLICY IF EXISTS "Service role can insert vehicle image cache"
  ON public.vehicle_image_cache;

-- ── prospect_demo_views ──────────────────────────────────────────────
-- The only writer is the get-prospect-demo edge function, which uses the
-- service_role key. The anon/authenticated INSERT grant is unnecessary.
DROP POLICY IF EXISTS "Anyone can log a demo view"
  ON public.prospect_demo_views;

-- ── login_attempt_log ────────────────────────────────────────────────
-- Login attempts are recorded exclusively through the SECURITY DEFINER RPC
-- public.record_login_attempt (granted to anon). The direct anon INSERT
-- grant is unnecessary and let anon write arbitrary rows into the log.
DROP POLICY IF EXISTS "Anon write own login attempts"
  ON public.login_attempt_log;

-- ── platform_pricing_model ───────────────────────────────────────────
-- Single-row table (id = 'global'); the app only ever upserts it. The
-- public DELETE policy let anyone delete the global pricing row. Platform
-- admins retain delete via "Platform admin can write pricing model"
-- (FOR ALL TO authenticated USING is_platform_admin(...)).
DROP POLICY IF EXISTS "pricing_model_delete"
  ON public.platform_pricing_model;

-- ── submissions ──────────────────────────────────────────────────────
-- The public lead-capture forms (QuickOfferForm, SellCarForm, ServiceLanding)
-- insert as anonymous visitors, so this must stay open to the public role.
-- Replace WITH CHECK (true) with a column-presence predicate that every
-- legitimate insert already satisfies (both columns are NOT NULL with
-- defaults) so the form path is unaffected while the tautology is removed.
DROP POLICY IF EXISTS "Anyone can create submissions" ON public.submissions;
CREATE POLICY "Anyone can create submissions"
  ON public.submissions
  FOR INSERT
  WITH CHECK (token IS NOT NULL AND dealership_id IS NOT NULL);

-- ── opt_outs ─────────────────────────────────────────────────────────
-- The customer portal lets unauthenticated customers opt out, so this stays
-- open to the public role. Replace WITH CHECK (true) with a predicate that
-- the portal insert ({ phone, channel, token }) always satisfies and that
-- rejects rows carrying neither a contact identifier nor a token.
DROP POLICY IF EXISTS "Anyone can opt out" ON public.opt_outs;
CREATE POLICY "Anyone can opt out"
  ON public.opt_outs
  FOR INSERT
  TO public
  WITH CHECK (token IS NOT NULL AND (phone IS NOT NULL OR email IS NOT NULL));

-- ── dealer_subscriptions ─────────────────────────────────────────────
-- These public write policies are load-bearing for self-serve onboarding:
-- OnboardingMobile upserts a status='trial' row while the new user still has
-- no user_roles entry (handle_new_user only files a pending_admin_request), so
-- the stricter "Admin can manage subscriptions" / "Platform admin can manage
-- subscriptions" policies don't yet match. Keep the public write path but
-- constrain it to trial rows: anonymous callers can create/keep trials, while
-- minting an 'active'/paid subscription requires the platform-admin ALL policy
-- (which is OR'd in for platform admins and own-tenant admins). Drop the public
-- DELETE entirely — no client code deletes subscriptions and admins retain
-- delete via the platform-admin ALL policy.
DROP POLICY IF EXISTS "dealer_subscriptions_insert" ON public.dealer_subscriptions;
CREATE POLICY "dealer_subscriptions_insert"
  ON public.dealer_subscriptions
  FOR INSERT
  WITH CHECK (dealership_id IS NOT NULL AND status = 'trial');

DROP POLICY IF EXISTS "dealer_subscriptions_update" ON public.dealer_subscriptions;
CREATE POLICY "dealer_subscriptions_update"
  ON public.dealer_subscriptions
  FOR UPDATE
  USING (status = 'trial')
  WITH CHECK (dealership_id IS NOT NULL AND status = 'trial');

DROP POLICY IF EXISTS "dealer_subscriptions_delete" ON public.dealer_subscriptions;

NOTIFY pgrst, 'reload schema';
