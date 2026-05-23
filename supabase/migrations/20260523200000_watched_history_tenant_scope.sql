-- Tighten RLS on watched_vehicle_history.
--
-- Prior policies (from the watch-my-car migration consolidation in
-- 20260519021248):
--
--   "Anyone can read history" -- FOR SELECT TO public USING (true).
--     This was a critical PII leak: anonymous users could SELECT every
--     row in the table. The history table joins to watched_vehicles
--     which holds VIN + email + phone + Black Book valuation snapshots
--     for every opted-in customer across every tenant.
--
--   "Service role manages history" -- FOR ALL TO authenticated
--     USING (is_staff(auth.uid())) WITH CHECK (is_staff(auth.uid())).
--     Cross-tenant leak: the name says "service role" but the policy
--     is gated on is_staff() with no dealership scoping, so any
--     authenticated staff member from any tenant could read or write
--     every history row in the table.
--
-- New posture:
--   1. Drop the legacy "Anyone can read history" + "Staff can read
--      history" + "Service role manages history" policies if any
--      exist (covers both the original migration shape and any
--      intermediate fix that may have renamed the SELECT policy).
--   2. Staff get SELECT scoped to their own dealership via a join
--      to watched_vehicles -- mirrors the canonical tenant-scoped
--      SELECT pattern in 20260509134048.
--   3. Service role gets FOR ALL on its own dedicated policy so the
--      recompute-watched-values cron edge function can keep inserting
--      snapshots. Service role bypasses RLS anyway, but the explicit
--      policy is documented intent.
--   4. Customers continue to read their own history through the
--      existing SECURITY DEFINER RPC watched_vehicle_history_for_token
--      (registered in 20260522210016) -- no public/anon SELECT needed.
--
-- Idempotent (DROP IF EXISTS + CREATE), safe to re-apply.
--
-- Per CLAUDE.md: this migration does NOT auto-apply on merge. Run via
-- Lovable Push, `supabase db push`, or SQL Editor paste after merging.

DROP POLICY IF EXISTS "Anyone can read history"             ON public.watched_vehicle_history;
DROP POLICY IF EXISTS "Staff can read history"              ON public.watched_vehicle_history;
DROP POLICY IF EXISTS "Service role manages history"        ON public.watched_vehicle_history;

CREATE POLICY "Staff can read history within dealership"
  ON public.watched_vehicle_history
  FOR SELECT
  TO authenticated
  USING (
    public.is_staff(auth.uid())
    AND EXISTS (
      SELECT 1
      FROM public.watched_vehicles wv
      WHERE wv.id = watched_vehicle_history.watched_vehicle_id
        AND wv.dealership_id = public.get_user_dealership_id(auth.uid())
    )
  );

CREATE POLICY "Service role manages history"
  ON public.watched_vehicle_history
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

NOTIFY pgrst, 'reload schema';
