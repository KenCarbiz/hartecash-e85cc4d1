-- Permissions Phase 1.A: appraiser as a matrix column.
--
-- The original permissions matrix table (20260429210000) typed the
-- role column as app_role, which restricts it to enum values
-- (admin, sales_bdc, used_car_manager, gsm_gm, ...). The user has
-- asked us to treat "appraiser" as a first-class column in the
-- matrix even though appraiser isn't a primary role — it's an
-- additive flag on user_roles.is_appraiser that any role can have.
--
-- Cleanest fix: widen the role column to text. The matrix UI gates
-- which strings are valid (DEFAULT_ROLES in rolePermissionDefaults.ts)
-- and resolution semantics live in the FE — appraiser rows are
-- ORed with the user's primary-role rows when their is_appraiser
-- flag is true.
--
-- Idempotent — checks the column type before altering. Drops the
-- old enum cast and replaces with text.

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

-- Same widening for the helper function so callers can pass
-- "appraiser" (or any future role-like string) without enum drama.
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
