
-- 1. Add dealership_id to testimonials and changelog_entries for tenant scoping
ALTER TABLE public.testimonials ADD COLUMN IF NOT EXISTS dealership_id text NOT NULL DEFAULT 'default';
ALTER TABLE public.changelog_entries ADD COLUMN IF NOT EXISTS dealership_id text NOT NULL DEFAULT 'default';

-- 2. Tenant-scoped RLS on pricing_models
DROP POLICY IF EXISTS "Staff can read pricing models" ON public.pricing_models;
CREATE POLICY "Staff can read own tenant pricing models" ON public.pricing_models
  FOR SELECT TO authenticated
  USING (is_staff(auth.uid()) AND dealership_id = get_user_dealership_id(auth.uid()));

DROP POLICY IF EXISTS "Admins and GM can manage pricing models" ON public.pricing_models;
CREATE POLICY "Admins and GM can manage own tenant pricing models" ON public.pricing_models
  FOR ALL TO authenticated
  USING (
    (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'gsm_gm'))
    AND dealership_id = get_user_dealership_id(auth.uid())
  )
  WITH CHECK (
    (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'gsm_gm'))
    AND dealership_id = get_user_dealership_id(auth.uid())
  );

-- 3. Tenant-scoped RLS on offer_rules
DROP POLICY IF EXISTS "Staff can read offer rules" ON public.offer_rules;
CREATE POLICY "Staff can read own tenant offer rules" ON public.offer_rules
  FOR SELECT TO authenticated
  USING (is_staff(auth.uid()) AND dealership_id = get_user_dealership_id(auth.uid()));

DROP POLICY IF EXISTS "Admins can manage offer rules" ON public.offer_rules;
CREATE POLICY "Admins can manage own tenant offer rules" ON public.offer_rules
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin') AND dealership_id = get_user_dealership_id(auth.uid()))
  WITH CHECK (has_role(auth.uid(), 'admin') AND dealership_id = get_user_dealership_id(auth.uid()));

-- 4. Tenant-scoped RLS on depth_policies
DROP POLICY IF EXISTS "Staff can read depth policies" ON public.depth_policies;
CREATE POLICY "Staff can read own tenant depth policies" ON public.depth_policies
  FOR SELECT TO authenticated
  USING (is_staff(auth.uid()) AND dealership_id = get_user_dealership_id(auth.uid()));

DROP POLICY IF EXISTS "Admins can manage depth policies" ON public.depth_policies;
CREATE POLICY "Admins can manage own tenant depth policies" ON public.depth_policies
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin') AND dealership_id = get_user_dealership_id(auth.uid()))
  WITH CHECK (has_role(auth.uid(), 'admin') AND dealership_id = get_user_dealership_id(auth.uid()));

-- 5. Tenant-scoped RLS on notification_templates
DROP POLICY IF EXISTS "Staff can read notification templates" ON public.notification_templates;
CREATE POLICY "Staff can read own tenant notification templates" ON public.notification_templates
  FOR SELECT TO authenticated
  USING (is_staff(auth.uid()) AND dealership_id = get_user_dealership_id(auth.uid()));

DROP POLICY IF EXISTS "Admins can manage notification templates" ON public.notification_templates;
CREATE POLICY "Admins can manage own tenant notification templates" ON public.notification_templates
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin') AND dealership_id = get_user_dealership_id(auth.uid()))
  WITH CHECK (has_role(auth.uid(), 'admin') AND dealership_id = get_user_dealership_id(auth.uid()));

-- 6. Update get_all_staff to accept dealership_id parameter
DROP FUNCTION IF EXISTS public.get_all_staff();

CREATE FUNCTION public.get_all_staff(_dealership_id text DEFAULT 'default')
RETURNS TABLE(user_id uuid, email text, display_name text, role text, role_id uuid, phone_number text, profile_image_url text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    ur.user_id,
    p.email,
    p.display_name,
    ur.role::text,
    ur.id AS role_id,
    p.phone_number,
    p.profile_image_url
  FROM user_roles ur
  LEFT JOIN profiles p ON p.user_id = ur.user_id
  WHERE ur.dealership_id = _dealership_id
  ORDER BY ur.role, p.display_name;
$$;
