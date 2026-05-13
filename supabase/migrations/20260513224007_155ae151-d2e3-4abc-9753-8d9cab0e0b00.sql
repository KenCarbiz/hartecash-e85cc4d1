-- PR 2 — 5 mechanical security fixes
-- All idempotent; safe to re-run.

-- ─────────────────────────────────────────────────────────────
-- 1) profiles.manager_pin_hash + manager_pin_set_at
--    Column-level REVOKE so the existing "Staff can read all profiles"
--    SELECT policy can no longer leak the bcrypt hash. Verification
--    continues to go through the verify_my_manager_pin SECURITY DEFINER
--    RPC, which is unaffected by column GRANTs.
-- ─────────────────────────────────────────────────────────────
REVOKE SELECT (manager_pin_hash, manager_pin_set_at)
  ON public.profiles
  FROM authenticated, anon;

-- ─────────────────────────────────────────────────────────────
-- 2) voice_campaigns SELECT — tenant-scope
--    Old: USING (is_staff(auth.uid()))   ← cross-tenant readable
-- ─────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Staff can view campaigns" ON public.voice_campaigns;
CREATE POLICY "Staff can view campaigns"
  ON public.voice_campaigns
  FOR SELECT
  TO authenticated
  USING (
    public.is_platform_admin(auth.uid())
    OR (
      public.is_staff(auth.uid())
      AND dealership_id = (public.get_user_dealership_id(auth.uid()))::uuid
    )
  );

-- ─────────────────────────────────────────────────────────────
-- 3) user_roles admin SELECT — tenant-scope
--    Old: USING (has_role(auth.uid(),'admin'))  ← any admin sees all tenants
--    Self-read ("Users can read own roles") and anon-deny policies are
--    left in place; this only narrows the admin view.
-- ─────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Admins can read all roles" ON public.user_roles;
CREATE POLICY "Admins can read all roles"
  ON public.user_roles
  FOR SELECT
  TO authenticated
  USING (
    public.is_platform_admin(auth.uid())
    OR (
      public.has_role(auth.uid(), 'admin'::app_role)
      AND dealership_id = public.get_user_dealership_id(auth.uid())
    )
  );

-- ─────────────────────────────────────────────────────────────
-- 4 + 5) Storage: drop the two blanket "Anyone can upload" INSERT
--   policies on submission-photos and customer-documents. Token-scoped
--   INSERT policies (created in 20260212191846_*) remain and continue
--   to permit the legitimate anonymous upload flow.
--
--   NOT touching storage.buckets.public for submission-photos in this
--   PR — that flip pairs with a getPublicUrl→createSignedUrl refactor
--   across 7 call sites and ships in PR 3.
-- ─────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Anyone can upload submission photos" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can upload customer documents" ON storage.objects;

NOTIFY pgrst, 'reload schema';