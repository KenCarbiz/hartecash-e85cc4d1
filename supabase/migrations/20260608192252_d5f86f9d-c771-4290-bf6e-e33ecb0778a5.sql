-- Harden get_user_dealership_id against cross-tenant ambiguity.
-- If a non-platform-admin user somehow ends up with rows in multiple distinct
-- non-default dealerships, fail closed (return NULL) instead of silently
-- picking the first-sorted one.
CREATE OR REPLACE FUNCTION public.get_user_dealership_id(_user_id uuid)
RETURNS text
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _admin_dealership text;
  _tenant_count int;
  _tenant_dealership text;
BEGIN
  -- Platform admin row wins unambiguously.
  SELECT dealership_id INTO _admin_dealership
  FROM public.user_roles
  WHERE user_id = _user_id
    AND is_platform_admin = true
  ORDER BY id ASC
  LIMIT 1;
  IF _admin_dealership IS NOT NULL THEN
    RETURN _admin_dealership;
  END IF;

  -- Non-admin: require exactly one distinct tenant dealership.
  SELECT COUNT(DISTINCT dealership_id), MIN(dealership_id)
    INTO _tenant_count, _tenant_dealership
  FROM public.user_roles
  WHERE user_id = _user_id
    AND COALESCE(is_platform_admin, false) = false
    AND dealership_id IS NOT NULL
    AND dealership_id <> 'default';

  IF _tenant_count = 1 THEN
    RETURN _tenant_dealership;
  END IF;

  -- 0 rows or ambiguous (>1 tenant): fail closed.
  RETURN NULL;
END;
$function$;

NOTIFY pgrst, 'reload schema';