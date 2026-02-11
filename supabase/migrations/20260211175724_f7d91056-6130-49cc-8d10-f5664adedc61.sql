
-- Helper function: check if user has ANY staff role
CREATE OR REPLACE FUNCTION public.is_staff(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id
    AND role IN ('admin', 'sales_bdc', 'used_car_manager', 'gsm_gm')
  )
$$;

-- Update submissions SELECT: all staff can read
DROP POLICY IF EXISTS "Admins can read all submissions" ON public.submissions;
CREATE POLICY "Staff can read all submissions"
  ON public.submissions FOR SELECT
  USING (is_staff(auth.uid()));

-- Update submissions UPDATE: all staff can update
DROP POLICY IF EXISTS "Admins can update submissions" ON public.submissions;
CREATE POLICY "Staff can update submissions"
  ON public.submissions FOR UPDATE
  USING (is_staff(auth.uid()))
  WITH CHECK (is_staff(auth.uid()));

-- Admins can read all roles (for access requests tab)
CREATE POLICY "Admins can read all roles"
  ON public.user_roles FOR SELECT
  USING (has_role(auth.uid(), 'admin'));
