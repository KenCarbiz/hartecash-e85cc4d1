-- HEAL: My Availability page surfaced
--   "Could not find the function public.set_my_call_availability(...)
--    in the schema cache"
-- meaning the original migration (20260429160000_user_roles_update_policies)
-- hasn't reached this environment OR the PostgREST schema cache is stale.
--
-- Re-create the function idempotently and force a reload. Also drop
-- any historical signature variants (in case an older deploy created
-- it with different parameter types — PostgREST refuses to expose an
-- overloaded helper that was renamed/retyped).

DROP FUNCTION IF EXISTS public.set_my_call_availability(text, boolean, time, time, text);
DROP FUNCTION IF EXISTS public.set_my_call_availability(text, boolean, text, text, text);

CREATE OR REPLACE FUNCTION public.set_my_call_availability(
  p_phone text,
  p_dnd boolean,
  p_quiet_start time,
  p_quiet_end time,
  p_quiet_tz text
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;

  IF (p_quiet_start IS NULL) <> (p_quiet_end IS NULL) THEN
    RAISE EXCEPTION 'quiet_start and quiet_end must be both set or both null';
  END IF;

  UPDATE public.user_roles
     SET phone = COALESCE(NULLIF(trim(p_phone), ''), NULL),
         click_to_dial_dnd = COALESCE(p_dnd, false),
         click_to_dial_quiet_start = p_quiet_start,
         click_to_dial_quiet_end = p_quiet_end,
         click_to_dial_quiet_tz = CASE
           WHEN p_quiet_start IS NULL THEN NULL
           ELSE COALESCE(NULLIF(trim(p_quiet_tz), ''), 'America/New_York')
         END
   WHERE user_id = auth.uid();
END;
$$;

GRANT EXECUTE ON FUNCTION public.set_my_call_availability(text, boolean, time, time, text)
  TO authenticated;

-- Two NOTIFYs — PostgREST occasionally swallows the first signal
-- when it lands inside the same transaction as the function create.
NOTIFY pgrst, 'reload schema';
NOTIFY pgrst, 'reload schema';
