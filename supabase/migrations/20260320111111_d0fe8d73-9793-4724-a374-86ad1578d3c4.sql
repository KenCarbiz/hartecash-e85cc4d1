DROP FUNCTION IF EXISTS public.get_all_staff();

CREATE FUNCTION public.get_all_staff()
 RETURNS TABLE(user_id uuid, email text, display_name text, role text, role_id uuid, phone_number text, profile_image_url text)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $$
  SELECT ur.user_id, p.email, p.display_name, ur.role::text, ur.id as role_id, p.phone_number, p.profile_image_url
  FROM user_roles ur
  LEFT JOIN profiles p ON p.user_id = ur.user_id
  ORDER BY p.email;
$$;