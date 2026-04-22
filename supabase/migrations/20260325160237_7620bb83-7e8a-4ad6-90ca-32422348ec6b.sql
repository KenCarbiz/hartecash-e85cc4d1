
-- Permission groups define named sets of allowed admin sections
CREATE TABLE public.permission_groups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text NOT NULL DEFAULT '',
  allowed_sections text[] NOT NULL DEFAULT '{}',
  is_default boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.permission_groups ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read permission groups" ON public.permission_groups
  FOR SELECT TO public USING (true);

CREATE POLICY "Admins can manage permission groups" ON public.permission_groups
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Assign permission groups to staff members
CREATE TABLE public.staff_permission_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  permission_group_id uuid NOT NULL REFERENCES public.permission_groups(id) ON DELETE CASCADE,
  assigned_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, permission_group_id)
);

ALTER TABLE public.staff_permission_assignments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff can read own assignments" ON public.staff_permission_assignments
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Admins can read all assignments" ON public.staff_permission_assignments
  FOR SELECT TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can manage assignments" ON public.staff_permission_assignments
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Access requests from staff
CREATE TABLE public.permission_access_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  requested_group_id uuid NOT NULL REFERENCES public.permission_groups(id) ON DELETE CASCADE,
  message text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'pending',
  reviewed_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  reviewed_at timestamptz
);

ALTER TABLE public.permission_access_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can create own requests" ON public.permission_access_requests
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can read own requests" ON public.permission_access_requests
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Admins can read all requests" ON public.permission_access_requests
  FOR SELECT TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can update requests" ON public.permission_access_requests
  FOR UPDATE TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

-- Add toggle to site_config for showing/hiding request access button
ALTER TABLE public.site_config
  ADD COLUMN IF NOT EXISTS show_request_access boolean NOT NULL DEFAULT true;

-- Seed default permission groups
INSERT INTO public.permission_groups (name, description, allowed_sections, is_default) VALUES
  ('Sales View', 'Basic access for Sales/BDC staff', ARRAY['submissions', 'appointments', 'consent', 'follow-ups', 'notification-log'], true),
  ('Manager View', 'Extended access for Used Car Managers', ARRAY['submissions', 'appointments', 'consent', 'follow-ups', 'notification-log', 'offer-settings', 'testimonials', 'comparison', 'image-inventory'], false),
  ('Full Access', 'Complete access to all admin sections', ARRAY['submissions', 'appointments', 'staff', 'requests', 'consent', 'follow-ups', 'notification-log', 'offer-settings', 'site-config', 'notifications', 'form-config', 'testimonials', 'comparison', 'locations', 'image-inventory', 'about-page', 'changelog', 'permissions'], false);
