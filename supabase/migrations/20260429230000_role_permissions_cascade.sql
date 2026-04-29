-- Permissions Phase B — cascade with platform defaults.
--
-- Semantics:
--   PLATFORM DEFAULT  = rows with dealership_id='default' AND
--                       location_id IS NULL. Set by the platform
--                       super admin (Ken). Seed for every tenant.
--   TENANT OVERRIDE   = rows with dealership_id='<tenant>' AND
--                       location_id IS NULL. Set by the dealership
--                       admin via Setup · Staff & Permissions.
--   STORE OVERRIDE    = rows with dealership_id='<tenant>' AND
--                       location_id=<store-uuid>. For multi-rooftop
--                       dealers who want a single store to differ.
--
-- Resolution: most specific wins. Store > Tenant > Platform > NULL
-- (FE falls back to defaultAllowedForRole code).
--
-- A NULL return from this helper means "no override, use the
-- built-in code default" — the FE checks that branch.

DROP FUNCTION IF EXISTS public.role_section_override(text, uuid, text, text);

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
    -- 1. store-level (only when a location is in scope)
    (SELECT allowed FROM public.tenant_role_section_permissions
       WHERE dealership_id = _dealership_id
         AND location_id = _location_id
         AND role = _role
         AND section_key = _section_key
       LIMIT 1),
    -- 2. tenant-wide
    (SELECT allowed FROM public.tenant_role_section_permissions
       WHERE dealership_id = _dealership_id
         AND location_id IS NULL
         AND role = _role
         AND section_key = _section_key
       LIMIT 1),
    -- 3. platform default (super admin's seed)
    (SELECT allowed FROM public.tenant_role_section_permissions
       WHERE dealership_id = 'default'
         AND location_id IS NULL
         AND role = _role
         AND section_key = _section_key
       LIMIT 1)
  );
$$;

GRANT EXECUTE ON FUNCTION public.role_section_override(text, uuid, text, text)
  TO authenticated;

-- Convenience: return the EFFECTIVE allowed boolean — falls back
-- to a baked-in default map when nothing in the table matches.
-- This intentionally only knows about the tier-defaults; the FE's
-- defaultAllowedForRole map is the canonical source so we don't
-- duplicate the section list in SQL.
--
-- Most consumers should still call role_section_override() and
-- handle NULL on the FE. This helper is a convenience for SQL-side
-- callers that want a single boolean.
CREATE OR REPLACE FUNCTION public.is_role_section_allowed(
  _dealership_id text,
  _location_id uuid,
  _role text,
  _section_key text,
  _fallback boolean
) RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    public.role_section_override(_dealership_id, _location_id, _role, _section_key),
    _fallback
  );
$$;

GRANT EXECUTE ON FUNCTION public.is_role_section_allowed(text, uuid, text, text, boolean)
  TO authenticated;

-- Helper to seed a new tenant from the platform default. Called by
-- the onboarding edge function (or manually) after a tenant is
-- created. Copies every dealership_id='default' row to the new
-- tenant — a snapshot, not a live link, so the dealer can drift
-- from platform afterwards without surprise.
CREATE OR REPLACE FUNCTION public.seed_tenant_role_permissions(_dealership_id text)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  copied integer := 0;
BEGIN
  IF _dealership_id IS NULL OR _dealership_id = 'default' THEN
    RETURN 0;
  END IF;

  INSERT INTO public.tenant_role_section_permissions
    (dealership_id, location_id, role, section_key, allowed, updated_at)
  SELECT _dealership_id, NULL, role, section_key, allowed, now()
  FROM public.tenant_role_section_permissions
  WHERE dealership_id = 'default'
    AND location_id IS NULL
  ON CONFLICT DO NOTHING;

  GET DIAGNOSTICS copied = ROW_COUNT;
  RETURN copied;
END;
$$;

GRANT EXECUTE ON FUNCTION public.seed_tenant_role_permissions(text)
  TO authenticated, service_role;

NOTIFY pgrst, 'reload schema';
