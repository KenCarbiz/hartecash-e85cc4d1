-- Tenant role × section permission matrix.
--
-- Phase 1 of a gradual permissions roll-out. Until now sidebar
-- visibility was hardcoded per role inside AdminSidebar.tsx (e.g.
-- "managers can see Voice AI"). Dealers couldn't fine-tune which
-- sections each role on their team could open.
--
-- This table lets the dealership admin override the built-in
-- defaults per role per section. Effective resolution at lookup
-- time:
--   1. Location-specific row (location_id = N, role, section_key)
--      [Phase 2 — not surfaced in the UI yet]
--   2. Tenant-wide row (location_id IS NULL, role, section_key)
--      [Phase 1 — what the matrix UI writes]
--   3. Built-in default from the FE's role_section_defaults map
--
-- Phase 1 only writes tenant-wide rows (location_id IS NULL).
-- The schema already supports per-store overrides so Phase 2 can
-- ship without another migration.

CREATE TABLE IF NOT EXISTS public.tenant_role_section_permissions (
  dealership_id text NOT NULL DEFAULT 'default',
  location_id uuid REFERENCES public.dealership_locations(id) ON DELETE CASCADE,
  role app_role NOT NULL,
  section_key text NOT NULL,
  allowed boolean NOT NULL DEFAULT true,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid,

  -- Composite PK that allows both NULL (tenant-wide) and concrete
  -- location_id rows. PG treats NULLs as distinct in unique
  -- constraints, so we use COALESCE in the index instead.
  PRIMARY KEY (dealership_id, COALESCE(location_id::text, ''), role, section_key)
);

COMMENT ON TABLE public.tenant_role_section_permissions IS
  'Per-tenant override of which sidebar sections each role can open. NULL location_id = tenant-wide; non-null = per-store. Resolution: location > tenant > built-in default.';

CREATE INDEX IF NOT EXISTS tenant_role_section_perm_dealer_role_idx
  ON public.tenant_role_section_permissions (dealership_id, role)
  WHERE location_id IS NULL;

ALTER TABLE public.tenant_role_section_permissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff read own-tenant role permissions"
  ON public.tenant_role_section_permissions
  FOR SELECT TO authenticated
  USING (
    dealership_id = public.get_user_dealership_id(auth.uid())
    OR public.has_role(auth.uid(), 'admin'::app_role)
  );

CREATE POLICY "Admin manage own-tenant role permissions"
  ON public.tenant_role_section_permissions
  FOR ALL TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin'::app_role)
    AND (
      dealership_id = public.get_user_dealership_id(auth.uid())
      OR public.get_user_dealership_id(auth.uid()) = 'default'
    )
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'admin'::app_role)
    AND (
      dealership_id = public.get_user_dealership_id(auth.uid())
      OR public.get_user_dealership_id(auth.uid()) = 'default'
    )
  );

CREATE POLICY "Service role full role permissions"
  ON public.tenant_role_section_permissions
  FOR ALL TO service_role
  USING (true) WITH CHECK (true);

-- Resolution helper — the built-in default is the FE's responsibility
-- (the canonical map lives in src/lib/rolePermissionDefaults.ts so
-- the UI and the helper agree). This RPC just resolves the override
-- chain. Returns NULL when no override exists; the FE falls back to
-- the default in that case.
CREATE OR REPLACE FUNCTION public.role_section_override(
  _dealership_id text,
  _location_id uuid,
  _role app_role,
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
