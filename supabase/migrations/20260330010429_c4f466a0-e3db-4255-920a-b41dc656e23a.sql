-- Add dealership_id to user_roles for tenant scoping
ALTER TABLE public.user_roles 
  ADD COLUMN IF NOT EXISTS dealership_id text NOT NULL DEFAULT 'default';

CREATE INDEX IF NOT EXISTS idx_user_roles_dealership_id 
  ON public.user_roles(dealership_id);

-- Function to get a user's dealership_id
CREATE OR REPLACE FUNCTION public.get_user_dealership_id(_user_id uuid)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = 'public'
AS $$
  SELECT COALESCE(
    (SELECT dealership_id FROM public.user_roles WHERE user_id = _user_id LIMIT 1),
    'default'
  );
$$;

-- Drop and recreate tenant-scoped RLS policies for submissions
DROP POLICY IF EXISTS "Staff can read submissions" ON public.submissions;
CREATE POLICY "Staff can read own tenant submissions" ON public.submissions
  FOR SELECT TO authenticated
  USING (
    is_staff(auth.uid()) AND dealership_id = get_user_dealership_id(auth.uid())
  );

DROP POLICY IF EXISTS "Staff can update submissions" ON public.submissions;
CREATE POLICY "Staff can update own tenant submissions" ON public.submissions
  FOR UPDATE TO authenticated
  USING (
    is_staff(auth.uid()) AND dealership_id = get_user_dealership_id(auth.uid())
  );

-- Tenant-scoped policies for site_config
DROP POLICY IF EXISTS "Admins can manage site config" ON public.site_config;
CREATE POLICY "Admins can manage own tenant site config" ON public.site_config
  FOR ALL TO authenticated
  USING (
    has_role(auth.uid(), 'admin'::app_role) AND dealership_id = get_user_dealership_id(auth.uid())
  );

DROP POLICY IF EXISTS "Anyone can read site config" ON public.site_config;
CREATE POLICY "Anyone can read site config" ON public.site_config
  FOR SELECT USING (true);

-- Tenant-scoped policies for offer_settings  
DROP POLICY IF EXISTS "Admins can manage offer settings" ON public.offer_settings;
CREATE POLICY "Admins can manage own tenant offer settings" ON public.offer_settings
  FOR ALL TO authenticated
  USING (
    has_role(auth.uid(), 'admin'::app_role) AND dealership_id = get_user_dealership_id(auth.uid())
  );

DROP POLICY IF EXISTS "Staff can read offer settings" ON public.offer_settings;
CREATE POLICY "Staff can read own tenant offer settings" ON public.offer_settings
  FOR SELECT TO authenticated
  USING (
    is_staff(auth.uid()) AND dealership_id = get_user_dealership_id(auth.uid())
  );

-- Tenant-scoped policies for notification_settings
DROP POLICY IF EXISTS "Admins can manage notification settings" ON public.notification_settings;
CREATE POLICY "Admins can manage own tenant notification settings" ON public.notification_settings
  FOR ALL TO authenticated
  USING (
    has_role(auth.uid(), 'admin'::app_role) AND dealership_id = get_user_dealership_id(auth.uid())
  );

DROP POLICY IF EXISTS "Staff can read notification settings" ON public.notification_settings;
CREATE POLICY "Staff can read own tenant notification settings" ON public.notification_settings
  FOR SELECT TO authenticated
  USING (
    is_staff(auth.uid()) AND dealership_id = get_user_dealership_id(auth.uid())
  );

-- Tenant-scoped policies for dealership_locations
DROP POLICY IF EXISTS "Admins can manage locations" ON public.dealership_locations;
CREATE POLICY "Admins can manage own tenant locations" ON public.dealership_locations
  FOR ALL TO authenticated
  USING (
    has_role(auth.uid(), 'admin'::app_role) AND dealership_id = get_user_dealership_id(auth.uid())
  );

DROP POLICY IF EXISTS "Anyone can read active locations" ON public.dealership_locations;
CREATE POLICY "Anyone can read active locations" ON public.dealership_locations
  FOR SELECT USING (is_active = true);

DROP POLICY IF EXISTS "Staff can read all locations" ON public.dealership_locations;
CREATE POLICY "Staff can read own tenant locations" ON public.dealership_locations
  FOR SELECT TO authenticated
  USING (
    is_staff(auth.uid()) AND dealership_id = get_user_dealership_id(auth.uid())
  );