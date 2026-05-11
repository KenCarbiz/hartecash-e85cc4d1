-- Permissions Phase 1.A: appraiser as a matrix column.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'tenant_role_section_permissions'
      AND column_name = 'role'
      AND udt_name = 'app_role'
  ) THEN
    ALTER TABLE public.tenant_role_section_permissions
      ALTER COLUMN role TYPE text USING role::text;
  END IF;
END $$;

DROP FUNCTION IF EXISTS public.role_section_override(text, uuid, app_role, text);

CREATE OR REPLACE FUNCTION public.role_section_override(
  _dealership_id text,
  _location_id uuid,
  _role text,
  _section_key text
) RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT allowed FROM public.tenant_role_section_permissions
       WHERE dealership_id = _dealership_id
         AND location_id = _location_id
         AND role = _role
         AND section_key = _section_key
       LIMIT 1),
    (SELECT allowed FROM public.tenant_role_section_permissions
       WHERE dealership_id = _dealership_id
         AND location_id IS NULL
         AND role = _role
         AND section_key = _section_key
       LIMIT 1)
  );
$$;

NOTIFY pgrst, 'reload schema';