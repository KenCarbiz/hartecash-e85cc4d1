-- 1. changelog_entries
DROP POLICY IF EXISTS "Staff can read all changelog entries" ON public.changelog_entries;
CREATE POLICY "Staff can read all changelog entries"
  ON public.changelog_entries FOR SELECT TO authenticated
  USING (
    public.is_platform_admin(auth.uid())
    OR (public.is_staff(auth.uid()) AND dealership_id = public.get_user_dealership_id(auth.uid()))
  );

-- 2. promotions
DROP POLICY IF EXISTS "Staff can view promotions" ON public.promotions;
CREATE POLICY "Staff can view promotions"
  ON public.promotions FOR SELECT TO authenticated
  USING (
    public.is_platform_admin(auth.uid())
    OR (public.is_staff(auth.uid()) AND dealership_id = public.get_user_dealership_id(auth.uid()))
  );

-- 3. inspection_config
DROP POLICY IF EXISTS "Staff can read inspection config" ON public.inspection_config;
CREATE POLICY "Staff can read inspection config"
  ON public.inspection_config FOR SELECT TO authenticated
  USING (
    public.is_platform_admin(auth.uid())
    OR (public.is_staff(auth.uid()) AND dealership_id = public.get_user_dealership_id(auth.uid()))
  );

-- 4. notification_log INSERT
DROP POLICY IF EXISTS "Staff can insert notification logs" ON public.notification_log;
CREATE POLICY "Staff can insert notification logs"
  ON public.notification_log FOR INSERT TO authenticated
  WITH CHECK (
    public.is_platform_admin(auth.uid())
    OR (public.is_staff(auth.uid()) AND dealership_id = public.get_user_dealership_id(auth.uid()))
  );

-- 5. boost_bump_rules
DROP POLICY IF EXISTS "boost_bump_rules_dealer_rw" ON public.boost_bump_rules;
DROP POLICY IF EXISTS "boost_bump_rules_staff_read" ON public.boost_bump_rules;
DROP POLICY IF EXISTS "boost_bump_rules_manager_write" ON public.boost_bump_rules;
CREATE POLICY "boost_bump_rules_staff_read"
  ON public.boost_bump_rules FOR SELECT TO authenticated
  USING (
    public.is_platform_admin(auth.uid())
    OR (public.is_staff(auth.uid()) AND dealership_id = public.get_user_dealership_id(auth.uid()))
  );
CREATE POLICY "boost_bump_rules_manager_write"
  ON public.boost_bump_rules FOR ALL TO authenticated
  USING (
    public.is_platform_admin(auth.uid())
    OR (
      dealership_id = public.get_user_dealership_id(auth.uid())
      AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'used_car_manager'::app_role))
    )
  )
  WITH CHECK (
    public.is_platform_admin(auth.uid())
    OR (
      dealership_id = public.get_user_dealership_id(auth.uid())
      AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'used_car_manager'::app_role))
    )
  );

-- 6. storage: staff-avatars
DROP POLICY IF EXISTS "Staff can upload any avatar" ON storage.objects;
DROP POLICY IF EXISTS "Staff can update any avatar" ON storage.objects;
DROP POLICY IF EXISTS "Staff can delete any avatar" ON storage.objects;
DROP POLICY IF EXISTS "Staff can upload own-tenant avatar" ON storage.objects;
DROP POLICY IF EXISTS "Staff can update own-tenant avatar" ON storage.objects;
DROP POLICY IF EXISTS "Staff can delete own-tenant avatar" ON storage.objects;
CREATE POLICY "Staff can upload own-tenant avatar"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'staff-avatars' AND (
      (storage.foldername(name))[1] = (auth.uid())::text
      OR public.is_platform_admin(auth.uid())
      OR (public.is_staff(auth.uid()) AND EXISTS (
        SELECT 1 FROM public.user_roles ur
        WHERE ur.user_id::text = (storage.foldername(name))[1]
          AND ur.dealership_id = public.get_user_dealership_id(auth.uid())))
    )
  );
CREATE POLICY "Staff can update own-tenant avatar"
  ON storage.objects FOR UPDATE TO authenticated
  USING (
    bucket_id = 'staff-avatars' AND (
      (storage.foldername(name))[1] = (auth.uid())::text
      OR public.is_platform_admin(auth.uid())
      OR (public.is_staff(auth.uid()) AND EXISTS (
        SELECT 1 FROM public.user_roles ur
        WHERE ur.user_id::text = (storage.foldername(name))[1]
          AND ur.dealership_id = public.get_user_dealership_id(auth.uid())))
    )
  );
CREATE POLICY "Staff can delete own-tenant avatar"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'staff-avatars' AND (
      (storage.foldername(name))[1] = (auth.uid())::text
      OR public.is_platform_admin(auth.uid())
      OR (public.is_staff(auth.uid()) AND EXISTS (
        SELECT 1 FROM public.user_roles ur
        WHERE ur.user_id::text = (storage.foldername(name))[1]
          AND ur.dealership_id = public.get_user_dealership_id(auth.uid())))
    )
  );

NOTIFY pgrst, 'reload schema';