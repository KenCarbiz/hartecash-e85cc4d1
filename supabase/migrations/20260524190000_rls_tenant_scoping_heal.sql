-- Tenant-scoping heal for RLS + storage policies flagged by the May 2026
-- security advisor. Each policy below used is_staff(auth.uid()) with NO
-- dealership filter, letting a staff member at one tenant read, write, or
-- spoof another tenant's data. Scope every policy to the caller's own
-- dealership; platform admins keep cross-tenant access via is_platform_admin.
--
-- IDEMPOTENT — DROP POLICY IF EXISTS before each CREATE, safe to re-apply.
-- Helpers (public.is_staff / is_platform_admin / get_user_dealership_id /
-- has_role) already exist and are used by sibling policies.
--
-- ⚠️ NOT auto-applied on merge to main — a human must run this against the
-- Supabase project (ref ptiwdwfdckfqivoocyvp). See CLAUDE.md.

-- ── 1. changelog_entries — staff SELECT scoped to own dealership ──────────
-- (The public "is_active = true" read policy is untouched, so the
--  customer-facing changelog still works.)
DROP POLICY IF EXISTS "Staff can read all changelog entries" ON public.changelog_entries;
CREATE POLICY "Staff can read all changelog entries"
  ON public.changelog_entries FOR SELECT
  TO authenticated
  USING (
    public.is_platform_admin(auth.uid())
    OR (public.is_staff(auth.uid()) AND dealership_id = public.get_user_dealership_id(auth.uid()))
  );

-- ── 2. promotions — staff SELECT scoped to own dealership ─────────────────
DROP POLICY IF EXISTS "Staff can view promotions" ON public.promotions;
CREATE POLICY "Staff can view promotions"
  ON public.promotions FOR SELECT
  TO authenticated
  USING (
    public.is_platform_admin(auth.uid())
    OR (public.is_staff(auth.uid()) AND dealership_id = public.get_user_dealership_id(auth.uid()))
  );

-- ── 3. inspection_config — staff SELECT scoped to own dealership ──────────
-- (A separate "Anyone can read inspection config" policy still covers the
--  anonymous widget read path, so scoping the staff policy is safe.)
DROP POLICY IF EXISTS "Staff can read inspection config" ON public.inspection_config;
CREATE POLICY "Staff can read inspection config"
  ON public.inspection_config FOR SELECT
  TO authenticated
  USING (
    public.is_platform_admin(auth.uid())
    OR (public.is_staff(auth.uid()) AND dealership_id = public.get_user_dealership_id(auth.uid()))
  );

-- ── 4. notification_log INSERT — staff may only write rows for their own
--      dealership (prevents forging another tenant's notification history).
--      Edge functions use the service-role key and bypass RLS, so the real
--      send path is unaffected.
DROP POLICY IF EXISTS "Staff can insert notification logs" ON public.notification_log;
CREATE POLICY "Staff can insert notification logs"
  ON public.notification_log FOR INSERT
  TO authenticated
  WITH CHECK (
    public.is_platform_admin(auth.uid())
    OR (public.is_staff(auth.uid()) AND dealership_id = public.get_user_dealership_id(auth.uid()))
  );

-- ── 5. boost_bump_rules — these amounts directly change customer offers, so
--      writes are limited to managers. Split the old FOR ALL policy into a
--      dealership-scoped staff SELECT and admin / used-car-manager-only writes.
DROP POLICY IF EXISTS "boost_bump_rules_dealer_rw" ON public.boost_bump_rules;
DROP POLICY IF EXISTS "boost_bump_rules_staff_read" ON public.boost_bump_rules;
DROP POLICY IF EXISTS "boost_bump_rules_manager_write" ON public.boost_bump_rules;

CREATE POLICY "boost_bump_rules_staff_read"
  ON public.boost_bump_rules FOR SELECT
  TO authenticated
  USING (
    public.is_platform_admin(auth.uid())
    OR (public.is_staff(auth.uid()) AND dealership_id = public.get_user_dealership_id(auth.uid()))
  );

CREATE POLICY "boost_bump_rules_manager_write"
  ON public.boost_bump_rules FOR ALL
  TO authenticated
  USING (
    public.is_platform_admin(auth.uid())
    OR (
      dealership_id = public.get_user_dealership_id(auth.uid())
      AND (
        has_role(auth.uid(), 'admin'::app_role)
        OR has_role(auth.uid(), 'used_car_manager'::app_role)
      )
    )
  )
  WITH CHECK (
    public.is_platform_admin(auth.uid())
    OR (
      dealership_id = public.get_user_dealership_id(auth.uid())
      AND (
        has_role(auth.uid(), 'admin'::app_role)
        OR has_role(auth.uid(), 'used_car_manager'::app_role)
      )
    )
  );

-- ── 6. storage: staff-avatars — a staff member could delete/overwrite any
--      other tenant's avatar. Avatars live at "{user_id}/avatar.jpg", so
--      restrict write ops to the caller's own avatar OR an avatar owned by
--      a user in the caller's dealership (lets a dealer admin manage their
--      own team's avatars without reaching across tenants).
DROP POLICY IF EXISTS "Staff can upload any avatar" ON storage.objects;
DROP POLICY IF EXISTS "Staff can update any avatar" ON storage.objects;
DROP POLICY IF EXISTS "Staff can delete any avatar" ON storage.objects;

CREATE POLICY "Staff can upload own-tenant avatar"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'staff-avatars'
    AND (
      (storage.foldername(name))[1] = (auth.uid())::text
      OR public.is_platform_admin(auth.uid())
      OR (
        public.is_staff(auth.uid())
        AND EXISTS (
          SELECT 1 FROM public.user_roles ur
          WHERE ur.user_id::text = (storage.foldername(name))[1]
            AND ur.dealership_id = public.get_user_dealership_id(auth.uid())
        )
      )
    )
  );

CREATE POLICY "Staff can update own-tenant avatar"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'staff-avatars'
    AND (
      (storage.foldername(name))[1] = (auth.uid())::text
      OR public.is_platform_admin(auth.uid())
      OR (
        public.is_staff(auth.uid())
        AND EXISTS (
          SELECT 1 FROM public.user_roles ur
          WHERE ur.user_id::text = (storage.foldername(name))[1]
            AND ur.dealership_id = public.get_user_dealership_id(auth.uid())
        )
      )
    )
  );

CREATE POLICY "Staff can delete own-tenant avatar"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'staff-avatars'
    AND (
      (storage.foldername(name))[1] = (auth.uid())::text
      OR public.is_platform_admin(auth.uid())
      OR (
        public.is_staff(auth.uid())
        AND EXISTS (
          SELECT 1 FROM public.user_roles ur
          WHERE ur.user_id::text = (storage.foldername(name))[1]
            AND ur.dealership_id = public.get_user_dealership_id(auth.uid())
        )
      )
    )
  );

NOTIFY pgrst, 'reload schema';
