-- Fill the long-standing gap on user_roles: there's a SELECT policy
-- and an INSERT (admin-only) policy, but NO UPDATE policy. That means
-- UPDATE through PostgREST returns 0 affected rows for everyone — the
-- StaffManagement phone editor and the new CallAvailabilityDialog
-- have been silently no-op'ing on save.
--
-- Two policies fix it:
--
-- 1. Admins can UPDATE rows in their own tenant (or anywhere if
--    platform-admin / super-admin at dealership_id='default').
-- 2. A user can UPDATE their OWN row, but only via the SECURITY
--    DEFINER RPC `set_my_call_availability` below — direct REST
--    updates are still blocked for non-admins so they can't escalate
--    their role or change tenant.
--
-- The RPC accepts the four call-availability columns and the cell
-- phone, all of which are safe for self-edit.

-- ── Admin UPDATE policy ───────────────────────────────────────────
CREATE POLICY "Admins can update user_roles in own tenant"
  ON public.user_roles
  FOR UPDATE
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin')
    AND (
      -- Platform admins (default tenant) can touch any row.
      public.get_user_dealership_id(auth.uid()) = 'default'
      -- Tenant admins are scoped to their own tenant.
      OR dealership_id = public.get_user_dealership_id(auth.uid())
    )
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'admin')
    AND (
      public.get_user_dealership_id(auth.uid()) = 'default'
      OR dealership_id = public.get_user_dealership_id(auth.uid())
    )
  );

-- ── Self-serve availability RPC ───────────────────────────────────
-- SECURITY DEFINER bypasses RLS for the specific columns it touches.
-- Only updates the caller's own row; never the role or dealership_id.
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

  -- Validate quiet-hour pairing — both null or both set.
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

COMMENT ON FUNCTION public.set_my_call_availability(text, boolean, time, time, text) IS
  'Self-serve update of click-to-dial availability + cell phone for the calling user. Only touches columns safe for self-edit; role/dealership_id are never modified. Used by the My Availability page so reps can manage their own DND + quiet hours without going through an admin.';

-- Grant authenticated role direct EXECUTE so RLS-blocked users can
-- still call it (the SECURITY DEFINER does the actual update).
GRANT EXECUTE ON FUNCTION public.set_my_call_availability(text, boolean, time, time, text) TO authenticated;

NOTIFY pgrst, 'reload schema';
