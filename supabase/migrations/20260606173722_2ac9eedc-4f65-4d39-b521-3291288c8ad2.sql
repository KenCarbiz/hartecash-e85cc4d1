DROP POLICY IF EXISTS consent_text_versions_deny_anon ON public.consent_text_versions;
CREATE POLICY consent_text_versions_deny_anon ON public.consent_text_versions
  AS RESTRICTIVE FOR SELECT TO anon USING (false);

CREATE OR REPLACE FUNCTION public.is_staff(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id
      AND role IN ('admin', 'sales_bdc', 'used_car_manager', 'gsm_gm', 'gm')
  )
$function$;

DROP POLICY IF EXISTS "Anonymous insert photo_metadata" ON public.photo_metadata;
CREATE POLICY "Anonymous insert photo_metadata"
  ON public.photo_metadata
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (
    submission_id IS NOT NULL
    AND EXISTS (SELECT 1 FROM public.submissions s WHERE s.id = submission_id)
  );

NOTIFY pgrst, 'reload schema';