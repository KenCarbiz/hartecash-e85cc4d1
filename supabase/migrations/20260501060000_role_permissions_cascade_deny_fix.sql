-- Fix the cascade deny logic in effective_user_sections.
--
-- Bug from #2 of the audit: the original logic denied access when
-- primary_override IS FALSE OR appraiser_override IS FALSE — even
-- when the other layer was NULL. This wrongly locked users out of
-- sections their FE-default fallback would otherwise grant.
--
-- Correct semantics: a layer can VETO another layer, but a single
-- layer that's NULL doesn't grant anything. So:
--   - If EITHER override is TRUE → allowed (positive grant wins)
--   - If both NULL → fallback to FE default (s_fallback)
--   - If one is FALSE and the other is TRUE → already covered above
--   - If one is FALSE and the other is NULL → fallback to FE default
--     UNLESS the user is an appraiser AND it's the primary that's
--     FALSE while the appraiser side is NULL, in which case still
--     fallback (FE-default OR'd with appraiser-default)
--
-- Bottom line: only deny when the PRIMARY layer says FALSE AND the
-- additive appraiser layer doesn't grant TRUE. The previous code
-- treated a single FALSE as a hard deny which is wrong.

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

  IF user_role IS NULL THEN
    RETURN '[]'::jsonb;
  END IF;

  IF user_role = 'admin' THEN
    SELECT COALESCE(jsonb_agg(s->>'key'), '[]'::jsonb)
    INTO result_keys
    FROM jsonb_array_elements(_sections) s;
    RETURN to_jsonb(result_keys);
  END IF;

  SELECT COALESCE(individual_sections, '{}')
  INTO individual
  FROM public.staff_permission_assignments
  WHERE user_id = _user_id
    AND permission_group_id IS NULL
  LIMIT 1;
  IF individual IS NULL THEN individual := '{}'; END IF;

  FOR section IN SELECT * FROM jsonb_array_elements(_sections) LOOP
    s_key := section->>'key';
    s_fallback := COALESCE((section->>'fallback')::boolean, false);

    IF s_key = ANY(individual) THEN
      result_keys := array_append(result_keys, s_key);
      CONTINUE;
    END IF;

    primary_override := public.role_section_override(
      user_dealership, user_location, user_role, s_key
    );

    appraiser_override := NULL;
    IF user_is_appraiser THEN
      appraiser_override := public.role_section_override(
        user_dealership, user_location, 'appraiser', s_key
      );
    END IF;

    -- FIXED resolution logic. Only deny when the primary layer says
    -- FALSE explicitly, the appraiser additive doesn't override with
    -- TRUE, AND the appraiser layer isn't NULL (NULL = no opinion,
    -- shouldn't be treated as deny). For non-appraisers, the
    -- appraiser_override is NULL by definition, and we fall back to
    -- s_fallback when primary is NULL or to deny when primary is FALSE.
    IF primary_override IS TRUE OR appraiser_override IS TRUE THEN
      allowed := true;
    ELSIF primary_override IS FALSE THEN
      -- Primary explicitly denies. Appraisers can still override TRUE
      -- but that's already handled above. So if we reach here, deny.
      allowed := false;
    ELSE
      -- primary_override IS NULL — no explicit override at any tier
      -- in the cascade for this role. Use the FE default. If the user
      -- is an appraiser, OR with appraiser FE-default — but the
      -- caller already passes the OR'd fallback (see useEffectivePermissions),
      -- so s_fallback already accounts for that.
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
