-- Tenant-isolation hardening (security audit, June 2026).
--
-- Closes cross-tenant Row-Level-Security holes on PII tables so a
-- dealer's staff can never read or write another dealer's customer data:
--
--   1. submissions UPDATE  — add the missing dealership_id check.
--   2. appointments UPDATE — add the missing dealership_id check.
--   3. appointments SELECT/DELETE — re-assert dealership-scoped (defensive).
--   4. conversation_events SELECT/INSERT — the tenant-blind
--      `OR has_role('admin')` let any dealer admin read every dealer's
--      message content; replace with `OR is_platform_admin()`.
--   5. is_platform_admin() — drop the `OR dealership_id = 'default'`
--      fallback so a mis-seeded admin row can't become a silent
--      cross-tenant super-admin. (Backfill the boolean first so no
--      current super-admin loses access.)
--
-- Fully idempotent (DROP POLICY IF EXISTS + CREATE; CREATE OR REPLACE).

-- ── 0. Backfill the platform-admin boolean BEFORE tightening the helper
--      (safety: any legacy dealership_id='default' admin keeps access).
UPDATE public.user_roles
SET is_platform_admin = true
WHERE role = 'admin'::app_role
  AND dealership_id = 'default'
  AND is_platform_admin = false;

-- ── 1. submissions UPDATE — scope to the caller's own dealership ───────
DROP POLICY IF EXISTS "Admins can update submissions" ON public.submissions;
DROP POLICY IF EXISTS "Staff can update submissions" ON public.submissions;
DROP POLICY IF EXISTS "Staff can update scoped submissions" ON public.submissions;
DROP POLICY IF EXISTS "Staff can update submissions in licensed states" ON public.submissions;
CREATE POLICY "Staff can update submissions in licensed states"
  ON public.submissions FOR UPDATE TO authenticated
  USING (
    public.is_platform_admin(auth.uid())
    OR (
      public.has_role(auth.uid(), 'admin'::app_role)
      AND dealership_id = public.get_user_dealership_id(auth.uid())
      AND public.can_act_in_state(auth.uid(), COALESCE(state, ''))
    )
  )
  WITH CHECK (
    public.is_platform_admin(auth.uid())
    OR (
      public.has_role(auth.uid(), 'admin'::app_role)
      AND dealership_id = public.get_user_dealership_id(auth.uid())
      AND public.can_act_in_state(auth.uid(), COALESCE(state, ''))
    )
  );

-- ── 2. appointments UPDATE — scope to the caller's own dealership ──────
DROP POLICY IF EXISTS "Staff can update appointments" ON public.appointments;
DROP POLICY IF EXISTS "Staff can update appointments in licensed states" ON public.appointments;
CREATE POLICY "Staff can update appointments in licensed states"
  ON public.appointments FOR UPDATE TO authenticated
  USING (
    public.is_platform_admin(auth.uid())
    OR (
      public.is_staff(auth.uid())
      AND dealership_id = public.get_user_dealership_id(auth.uid())
      AND public.can_act_in_state(
        auth.uid(),
        COALESCE((SELECT state FROM public.dealership_locations WHERE id = appointments.store_location_id), '')
      )
    )
  )
  WITH CHECK (
    public.is_platform_admin(auth.uid())
    OR (
      public.is_staff(auth.uid())
      AND dealership_id = public.get_user_dealership_id(auth.uid())
      AND public.can_act_in_state(
        auth.uid(),
        COALESCE((SELECT state FROM public.dealership_locations WHERE id = appointments.store_location_id), '')
      )
    )
  );

-- ── 3. appointments SELECT/DELETE — re-assert dealership-scoped ────────
DROP POLICY IF EXISTS "Staff can read appointments" ON public.appointments;
CREATE POLICY "Staff can read appointments"
  ON public.appointments FOR SELECT TO authenticated
  USING (
    public.is_platform_admin(auth.uid())
    OR (public.is_staff(auth.uid()) AND dealership_id = public.get_user_dealership_id(auth.uid()))
  );

DROP POLICY IF EXISTS "Staff can delete appointments" ON public.appointments;
CREATE POLICY "Staff can delete appointments"
  ON public.appointments FOR DELETE TO authenticated
  USING (
    public.is_platform_admin(auth.uid())
    OR (public.is_staff(auth.uid()) AND dealership_id = public.get_user_dealership_id(auth.uid()))
  );

-- ── 4. conversation_events — kill the tenant-blind admin branch ───────
DROP POLICY IF EXISTS "Staff read own-dealership conversation events" ON public.conversation_events;
CREATE POLICY "Staff read own-dealership conversation events"
  ON public.conversation_events FOR SELECT TO authenticated
  USING (
    dealership_id = public.get_user_dealership_id(auth.uid())
    OR public.is_platform_admin(auth.uid())
  );

DROP POLICY IF EXISTS "Staff insert own-dealership conversation events" ON public.conversation_events;
CREATE POLICY "Staff insert own-dealership conversation events"
  ON public.conversation_events FOR INSERT TO authenticated
  WITH CHECK (
    dealership_id = public.get_user_dealership_id(auth.uid())
    OR public.is_platform_admin(auth.uid())
  );

-- ── 5. is_platform_admin() — rely solely on the explicit boolean ──────
CREATE OR REPLACE FUNCTION public.is_platform_admin(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id
      AND role = 'admin'::app_role
      AND is_platform_admin = true
  );
$$;

NOTIFY pgrst, 'reload schema';
