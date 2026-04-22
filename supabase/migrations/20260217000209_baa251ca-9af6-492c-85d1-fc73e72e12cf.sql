
-- Drop and recreate get_all_staff with phone_number
DROP FUNCTION IF EXISTS public.get_all_staff();

CREATE FUNCTION public.get_all_staff()
 RETURNS TABLE(user_id uuid, email text, display_name text, role text, role_id uuid, phone_number text)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $$
  SELECT ur.user_id, p.email, p.display_name, ur.role::text, ur.id as role_id, p.phone_number
  FROM user_roles ur
  LEFT JOIN profiles p ON p.user_id = ur.user_id
  ORDER BY p.email;
$$;

-- Allow staff to read all profiles (for phone numbers in staff view)
CREATE POLICY "Staff can read all profiles"
ON public.profiles
FOR SELECT
USING (is_staff(auth.uid()));
