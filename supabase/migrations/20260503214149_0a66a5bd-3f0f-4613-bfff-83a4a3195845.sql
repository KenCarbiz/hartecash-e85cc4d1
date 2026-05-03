-- embed_config
ALTER TABLE public.site_config ADD COLUMN IF NOT EXISTS embed_config jsonb NOT NULL DEFAULT '{}'::jsonb;

-- user_roles click-to-dial columns
ALTER TABLE public.user_roles
  ADD COLUMN IF NOT EXISTS phone text,
  ADD COLUMN IF NOT EXISTS click_to_dial_dnd boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS click_to_dial_quiet_start time,
  ADD COLUMN IF NOT EXISTS click_to_dial_quiet_end time,
  ADD COLUMN IF NOT EXISTS click_to_dial_quiet_tz text;

-- dealer_accounts recording opt-in
ALTER TABLE public.dealer_accounts
  ADD COLUMN IF NOT EXISTS click_to_dial_record_calls boolean NOT NULL DEFAULT false;

-- Admin UPDATE policy on user_roles
DROP POLICY IF EXISTS "Admins can update user_roles in own tenant" ON public.user_roles;
CREATE POLICY "Admins can update user_roles in own tenant"
  ON public.user_roles FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin')
    AND (public.get_user_dealership_id(auth.uid()) = 'default' OR dealership_id = public.get_user_dealership_id(auth.uid())))
  WITH CHECK (public.has_role(auth.uid(), 'admin')
    AND (public.get_user_dealership_id(auth.uid()) = 'default' OR dealership_id = public.get_user_dealership_id(auth.uid())));

-- Self-serve availability RPC
DROP FUNCTION IF EXISTS public.set_my_call_availability(text, boolean, time, time, text);
DROP FUNCTION IF EXISTS public.set_my_call_availability(text, boolean, text, text, text);
CREATE OR REPLACE FUNCTION public.set_my_call_availability(
  p_phone text, p_dnd boolean, p_quiet_start time, p_quiet_end time, p_quiet_tz text
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;
  IF (p_quiet_start IS NULL) <> (p_quiet_end IS NULL) THEN
    RAISE EXCEPTION 'quiet_start and quiet_end must be both set or both null';
  END IF;
  UPDATE public.user_roles
     SET phone = COALESCE(NULLIF(trim(p_phone), ''), NULL),
         click_to_dial_dnd = COALESCE(p_dnd, false),
         click_to_dial_quiet_start = p_quiet_start,
         click_to_dial_quiet_end = p_quiet_end,
         click_to_dial_quiet_tz = CASE WHEN p_quiet_start IS NULL THEN NULL
           ELSE COALESCE(NULLIF(trim(p_quiet_tz), ''), 'America/New_York') END
   WHERE user_id = auth.uid();
END;
$$;
GRANT EXECUTE ON FUNCTION public.set_my_call_availability(text, boolean, time, time, text) TO authenticated;

NOTIFY pgrst, 'reload schema';