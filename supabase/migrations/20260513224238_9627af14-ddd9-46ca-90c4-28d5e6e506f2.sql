-- PR 2.1 — tenant-scope three cross-tenant is_staff policies.
-- Same predicate shape as the voice_campaigns / dealer_subscriptions fixes:
--   is_platform_admin(auth.uid())
--   OR (is_staff(auth.uid()) AND dealership_id = get_user_dealership_id(auth.uid()))

-- ── consent_log SELECT ─────────────────────────────────────────
DROP POLICY IF EXISTS "Staff can read consent logs" ON public.consent_log;
CREATE POLICY "Staff can read consent logs"
  ON public.consent_log
  FOR SELECT
  TO authenticated
  USING (
    public.is_platform_admin(auth.uid())
    OR (
      public.is_staff(auth.uid())
      AND dealership_id = public.get_user_dealership_id(auth.uid())
    )
  );

-- ── appointments SELECT ────────────────────────────────────────
DROP POLICY IF EXISTS "Staff can read appointments" ON public.appointments;
CREATE POLICY "Staff can read appointments"
  ON public.appointments
  FOR SELECT
  TO authenticated
  USING (
    public.is_platform_admin(auth.uid())
    OR (
      public.is_staff(auth.uid())
      AND dealership_id = public.get_user_dealership_id(auth.uid())
    )
  );

-- ── appointments DELETE ────────────────────────────────────────
DROP POLICY IF EXISTS "Staff can delete appointments" ON public.appointments;
CREATE POLICY "Staff can delete appointments"
  ON public.appointments
  FOR DELETE
  TO authenticated
  USING (
    public.is_platform_admin(auth.uid())
    OR (
      public.is_staff(auth.uid())
      AND dealership_id = public.get_user_dealership_id(auth.uid())
    )
  );

NOTIFY pgrst, 'reload schema';