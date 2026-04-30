-- Permissions Phase C — per-user grants on top of the role cascade.
--
-- Stack (least → most specific):
--   1. Built-in default       (FE defaultAllowedForRole map)
--   2. Platform default       (dealership_id='default', location_id NULL)
--   3. Tenant override        (dealership_id=<tenant>, location_id NULL)
--   4. Store override         (dealership_id=<tenant>, location_id=<store>)
--   5. Appraiser additive     (OR'd with above when user.is_appraiser=true)
--   6. Per-user grant         (staff_permission_assignments.individual_sections)
--                             — additive: explicit grant always wins true
--
-- The FE owns the built-in default map (rolePermissionDefaults.ts) so the
-- caller passes a fallback boolean for each section it cares about. SQL
-- handles every other layer.
--
-- One RPC, one round trip. Caller sends a jsonb array of
--   [{ "key": "today", "fallback": true }, ...]
-- and gets back a jsonb array of section keys the user is allowed to see.

CREATE OR REPLACE FUNCTION public.effective_user_sections(
  _user_id uuid,
  _sections jsonb
) RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  user_role text;
  user_dealership text;
  user_location uuid;
  user_is_appraiser boolean;
  individual text[];
  result_keys text[] := '{}';
  section jsonb;
  s_key text;
  s_fallback boolean;
  primary_override boolean;
  appraiser_override boolean;
  allowed boolean;
BEGIN
  -- One row per user_id (most-recent role wins if multiple). The
  -- user_roles table allows multiple rows per user historically; we
  -- pick the highest-privilege primary role available.
  SELECT
    role::text,
    dealership_id,
    location_id,
    COALESCE(is_appraiser, false)
  INTO user_role, user_dealership, user_location, user_is_appraiser
  FROM public.user_roles
  WHERE user_id = _user_id
  ORDER BY
    CASE role::text
      WHEN 'admin' THEN 1
      WHEN 'gsm_gm' THEN 2
      WHEN 'gm' THEN 3
      WHEN 'used_car_manager' THEN 4
      WHEN 'new_car_manager' THEN 5
      WHEN 'internet_manager' THEN 6
      WHEN 'sales_bdc' THEN 7
      WHEN 'sales' THEN 8
      WHEN 'receptionist' THEN 9
      ELSE 99
    END
  LIMIT 1;

  -- No role row → no access (sidebar shows nothing).
  IF user_role IS NULL THEN
    RETURN '[]'::jsonb;
  END IF;

  -- Admin = unrestricted; return every key the caller asked about.
  IF user_role = 'admin' THEN
    SELECT COALESCE(jsonb_agg(s->>'key'), '[]'::jsonb)
    INTO result_keys
    FROM jsonb_array_elements(_sections) s;
    RETURN to_jsonb(result_keys);
  END IF;

  -- Pull individual grants once (additive: any key in this array is
  -- allowed regardless of role-level cascade).
  SELECT COALESCE(individual_sections, '{}')
  INTO individual
  FROM public.staff_permission_assignments
  WHERE user_id = _user_id
    AND permission_group_id IS NULL
  LIMIT 1;
  IF individual IS NULL THEN individual := '{}'; END IF;

  -- Resolve each requested section.
  FOR section IN SELECT * FROM jsonb_array_elements(_sections) LOOP
    s_key := section->>'key';
    s_fallback := COALESCE((section->>'fallback')::boolean, false);

    -- Per-user explicit grant short-circuits to allowed.
    IF s_key = ANY(individual) THEN
      result_keys := array_append(result_keys, s_key);
      CONTINUE;
    END IF;

    -- Primary-role cascade (store > tenant > platform).
    primary_override := public.role_section_override(
      user_dealership, user_location, user_role, s_key
    );

    -- Appraiser additive layer — only consulted when the user has the
    -- additive flag on. Treated as OR with primary: true wins.
    appraiser_override := NULL;
    IF user_is_appraiser THEN
      appraiser_override := public.role_section_override(
        user_dealership, user_location, 'appraiser', s_key
      );
    END IF;

    -- Resolve final allowed:
    --   1. If either layer explicitly says true → allow.
    --   2. If either explicitly says false AND no true on the other → deny.
    --   3. If both NULL → fallback to FE default (caller provided).
    IF primary_override IS TRUE OR appraiser_override IS TRUE THEN
      allowed := true;
    ELSIF primary_override IS FALSE OR appraiser_override IS FALSE THEN
      allowed := false;
    ELSE
      allowed := s_fallback;
    END IF;

    IF allowed THEN
      result_keys := array_append(result_keys, s_key);
    END IF;
  END LOOP;

  RETURN to_jsonb(result_keys);
END;
$$;

GRANT EXECUTE ON FUNCTION public.effective_user_sections(uuid, jsonb)
  TO authenticated;

NOTIFY pgrst, 'reload schema';
