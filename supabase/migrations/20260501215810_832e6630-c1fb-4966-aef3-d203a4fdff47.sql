
-- Permissions override table powering the Role Permissions Matrix
CREATE TABLE IF NOT EXISTS public.tenant_role_section_permissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  dealership_id text NOT NULL,
  location_id uuid NULL REFERENCES public.dealership_locations(id) ON DELETE CASCADE,
  role text NOT NULL,
  section_key text NOT NULL,
  allowed boolean NOT NULL,
  updated_by uuid NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- One override row per (scope, role, section)
CREATE UNIQUE INDEX IF NOT EXISTS tenant_role_section_permissions_scope_unique
  ON public.tenant_role_section_permissions (dealership_id, COALESCE(location_id::text, ''), role, section_key);

CREATE INDEX IF NOT EXISTS tenant_role_section_permissions_lookup_idx
  ON public.tenant_role_section_permissions (dealership_id, location_id, role);

ALTER TABLE public.tenant_role_section_permissions ENABLE ROW LEVEL SECURITY;

-- Platform admins manage the 'default' (platform-wide) seed rows and
-- can read/write everything. Tenant admins manage rows for their own
-- dealership only.
DROP POLICY IF EXISTS "permissions_select" ON public.tenant_role_section_permissions;
CREATE POLICY "permissions_select"
  ON public.tenant_role_section_permissions
  FOR SELECT
  TO authenticated
  USING (
    public.is_platform_admin(auth.uid())
    OR (
      public.has_role(auth.uid(), 'admin'::app_role)
      AND public.get_user_dealership_id(auth.uid()) = dealership_id
    )
  );

DROP POLICY IF EXISTS "permissions_insert" ON public.tenant_role_section_permissions;
CREATE POLICY "permissions_insert"
  ON public.tenant_role_section_permissions
  FOR INSERT
  TO authenticated
  WITH CHECK (
    public.is_platform_admin(auth.uid())
    OR (
      public.has_role(auth.uid(), 'admin'::app_role)
      AND public.get_user_dealership_id(auth.uid()) = dealership_id
    )
  );

DROP POLICY IF EXISTS "permissions_update" ON public.tenant_role_section_permissions;
CREATE POLICY "permissions_update"
  ON public.tenant_role_section_permissions
  FOR UPDATE
  TO authenticated
  USING (
    public.is_platform_admin(auth.uid())
    OR (
      public.has_role(auth.uid(), 'admin'::app_role)
      AND public.get_user_dealership_id(auth.uid()) = dealership_id
    )
  )
  WITH CHECK (
    public.is_platform_admin(auth.uid())
    OR (
      public.has_role(auth.uid(), 'admin'::app_role)
      AND public.get_user_dealership_id(auth.uid()) = dealership_id
    )
  );

DROP POLICY IF EXISTS "permissions_delete" ON public.tenant_role_section_permissions;
CREATE POLICY "permissions_delete"
  ON public.tenant_role_section_permissions
  FOR DELETE
  TO authenticated
  USING (
    public.is_platform_admin(auth.uid())
    OR (
      public.has_role(auth.uid(), 'admin'::app_role)
      AND public.get_user_dealership_id(auth.uid()) = dealership_id
    )
  );

CREATE TRIGGER tenant_role_section_permissions_updated_at
  BEFORE UPDATE ON public.tenant_role_section_permissions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Resolver: given a user and the FE-supplied (section_key, fallback)
-- list, return only the section keys the user is allowed to see.
-- Cascade: per-store override > tenant override > platform default > FE fallback.
CREATE OR REPLACE FUNCTION public.effective_user_sections(
  _user_id uuid,
  _sections jsonb
)
RETURNS text[]
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _dealership_id text;
  _location_id uuid;
  _user_role text;
  _is_appraiser boolean;
  _result text[] := ARRAY[]::text[];
  _section record;
  _allowed boolean;
  _override_value boolean;
BEGIN
  IF _user_id IS NULL THEN
    RETURN _result;
  END IF;

  -- Platform admins are unrestricted; FE handles them before calling
  -- this RPC, but be safe.
  IF public.is_platform_admin(_user_id) THEN
    SELECT array_agg(s->>'key')
      INTO _result
      FROM jsonb_array_elements(_sections) s;
    RETURN _result;
  END IF;

  SELECT dealership_id, location_id, role::text, COALESCE(is_appraiser, false)
    INTO _dealership_id, _location_id, _user_role, _is_appraiser
    FROM public.user_roles
    WHERE user_id = _user_id
    ORDER BY CASE role::text
      WHEN 'admin' THEN 1
      WHEN 'gsm_gm' THEN 2
      WHEN 'gm' THEN 3
      WHEN 'used_car_manager' THEN 4
      WHEN 'new_car_manager' THEN 5
      WHEN 'internet_manager' THEN 6
      WHEN 'sales_bdc' THEN 7
      WHEN 'sales' THEN 8
      WHEN 'receptionist' THEN 9
      ELSE 10
    END
    LIMIT 1;

  IF _user_role IS NULL THEN
    RETURN _result;
  END IF;

  FOR _section IN
    SELECT s->>'key' AS key, COALESCE((s->>'fallback')::boolean, false) AS fallback
    FROM jsonb_array_elements(_sections) s
  LOOP
    _allowed := _section.fallback;

    -- Platform default override
    SELECT allowed INTO _override_value
      FROM public.tenant_role_section_permissions
      WHERE dealership_id = 'default'
        AND location_id IS NULL
        AND role = _user_role
        AND section_key = _section.key
      LIMIT 1;
    IF FOUND THEN _allowed := _override_value; END IF;

    -- Tenant-wide override
    IF _dealership_id IS NOT NULL AND _dealership_id <> 'default' THEN
      SELECT allowed INTO _override_value
        FROM public.tenant_role_section_permissions
        WHERE dealership_id = _dealership_id
          AND location_id IS NULL
          AND role = _user_role
          AND section_key = _section.key
        LIMIT 1;
      IF FOUND THEN _allowed := _override_value; END IF;
    END IF;

    -- Per-store override
    IF _location_id IS NOT NULL THEN
      SELECT allowed INTO _override_value
        FROM public.tenant_role_section_permissions
        WHERE dealership_id = _dealership_id
          AND location_id = _location_id
          AND role = _user_role
          AND section_key = _section.key
        LIMIT 1;
      IF FOUND THEN _allowed := _override_value; END IF;
    END IF;

    -- Additive appraiser layer: OR the appraiser row's allowed value
    IF _is_appraiser AND NOT _allowed THEN
      SELECT allowed INTO _override_value
        FROM public.tenant_role_section_permissions
        WHERE dealership_id = COALESCE(_dealership_id, 'default')
          AND location_id IS NULL
          AND role = 'appraiser'
          AND section_key = _section.key
        LIMIT 1;
      IF FOUND AND _override_value THEN _allowed := true; END IF;
    END IF;

    IF _allowed THEN
      _result := array_append(_result, _section.key);
    END IF;
  END LOOP;

  RETURN _result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.effective_user_sections(uuid, jsonb) TO authenticated, anon;
