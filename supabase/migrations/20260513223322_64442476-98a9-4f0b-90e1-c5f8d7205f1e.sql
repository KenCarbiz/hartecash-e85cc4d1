-- PR 1 hotfix: close user_roles INSERT + UPDATE privilege escalation.
--
-- Vector: existing "Admins can insert roles" INSERT policy only checked
-- `has_role(auth.uid(),'admin')` with no tenant scope and no
-- is_platform_admin block. Any tenant admin could INSERT a row with
-- dealership_id='default' or is_platform_admin=true and become a
-- platform super-admin.
--
-- Vector 2: existing UPDATE policy was tenant-scoped on dealership_id
-- but did not block flipping is_platform_admin=true on a row already
-- in the caller's own tenant. Same escalation, different verb.
--
-- Platform admins remain unrestricted (first OR branch). Tenant admins
-- can only manage rows in their own non-default tenant and may not set
-- the platform-admin boolean. `IS NOT TRUE` covers both false and NULL
-- so callers omitting the column (using the default false) still pass.

DROP POLICY IF EXISTS "Admins can insert roles" ON public.user_roles;
CREATE POLICY "Admins can insert roles"
  ON public.user_roles
  FOR INSERT
  TO authenticated
  WITH CHECK (
    public.is_platform_admin(auth.uid())
    OR (
      public.has_role(auth.uid(), 'admin'::app_role)
      AND dealership_id = public.get_user_dealership_id(auth.uid())
      AND dealership_id <> 'default'
      AND is_platform_admin IS NOT TRUE
    )
  );

DROP POLICY IF EXISTS "Admins can update user_roles in own tenant" ON public.user_roles;
CREATE POLICY "Admins can update user_roles in own tenant"
  ON public.user_roles
  FOR UPDATE
  TO authenticated
  USING (
    public.is_platform_admin(auth.uid())
    OR (
      public.has_role(auth.uid(), 'admin'::app_role)
      AND (
        public.get_user_dealership_id(auth.uid()) = 'default'
        OR dealership_id = public.get_user_dealership_id(auth.uid())
      )
    )
  )
  WITH CHECK (
    public.is_platform_admin(auth.uid())
    OR (
      public.has_role(auth.uid(), 'admin'::app_role)
      AND dealership_id = public.get_user_dealership_id(auth.uid())
      AND dealership_id <> 'default'
      AND is_platform_admin IS NOT TRUE
    )
  );

NOTIFY pgrst, 'reload schema';