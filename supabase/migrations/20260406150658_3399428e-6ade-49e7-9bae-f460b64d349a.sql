
DROP FUNCTION IF EXISTS public.get_all_staff(text);

CREATE OR REPLACE FUNCTION public.get_all_staff(_dealership_id text DEFAULT 'default'::text)
RETURNS TABLE(user_id uuid, email text, display_name text, role text, role_id uuid, phone_number text, profile_image_url text, location_id uuid)
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
    p.profile_image_url,
    ur.location_id
  FROM user_roles ur
  LEFT JOIN profiles p ON p.user_id = ur.user_id
  WHERE ur.dealership_id = _dealership_id
  ORDER BY ur.role, p.display_name;
$$;
