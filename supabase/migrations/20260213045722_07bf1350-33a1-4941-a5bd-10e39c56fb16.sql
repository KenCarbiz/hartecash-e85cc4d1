
CREATE OR REPLACE FUNCTION public.update_staff_role(_role_id uuid, _new_role app_role)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'Only admins can change staff roles';
  END IF;
  UPDATE user_roles SET role = _new_role WHERE id = _role_id;
END;
$$;
