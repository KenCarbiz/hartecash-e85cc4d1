
-- Function for admins to list all staff with their profile info
CREATE OR REPLACE FUNCTION public.get_all_staff()
RETURNS TABLE(user_id uuid, email text, display_name text, role text, role_id uuid)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT ur.user_id, p.email, p.display_name, ur.role::text, ur.id as role_id
  FROM user_roles ur
  LEFT JOIN profiles p ON p.user_id = ur.user_id
  ORDER BY p.email;
$$;

-- Function for admins to remove a staff member's role
CREATE OR REPLACE FUNCTION public.remove_staff_role(_role_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'Only admins can remove staff roles';
  END IF;
  DELETE FROM user_roles WHERE id = _role_id;
END;
$$;
