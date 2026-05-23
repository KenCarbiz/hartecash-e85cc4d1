-- 1. conversation_events: restrict to authenticated only
DROP POLICY IF EXISTS "Staff insert own-dealership conversation events" ON public.conversation_events;
CREATE POLICY "Staff insert own-dealership conversation events"
ON public.conversation_events
FOR INSERT
TO authenticated
WITH CHECK (
  is_platform_admin(auth.uid())
  OR (dealership_id = get_user_dealership_id(auth.uid()))
);

DROP POLICY IF EXISTS "Staff read own-dealership conversation events" ON public.conversation_events;
CREATE POLICY "Staff read own-dealership conversation events"
ON public.conversation_events
FOR SELECT
TO authenticated
USING (
  is_platform_admin(auth.uid())
  OR (dealership_id = get_user_dealership_id(auth.uid()))
);

-- 2. opt_outs: explicit anon SELECT block
DROP POLICY IF EXISTS "Block anon select opt_outs" ON public.opt_outs;
CREATE POLICY "Block anon select opt_outs"
ON public.opt_outs
AS RESTRICTIVE
FOR SELECT
TO anon
USING (false);

-- 3. ocr_jobs: explicit anon SELECT block
DROP POLICY IF EXISTS "Block anon select ocr_jobs" ON public.ocr_jobs;
CREATE POLICY "Block anon select ocr_jobs"
ON public.ocr_jobs
AS RESTRICTIVE
FOR SELECT
TO anon
USING (false);

-- 4. photo_metadata: require submission_token to match existing submission
DROP POLICY IF EXISTS "Anonymous insert photo_metadata" ON public.photo_metadata;
CREATE POLICY "Anonymous insert photo_metadata"
ON public.photo_metadata
FOR INSERT
TO anon, authenticated
WITH CHECK (
  submission_token IS NOT NULL
  AND EXISTS (
    SELECT 1 FROM public.submissions s
    WHERE s.token = photo_metadata.submission_token
      AND (photo_metadata.submission_id IS NULL OR s.id = photo_metadata.submission_id)
  )
);

-- 5. dealer-logos storage: tenant-scoped staff write access
DROP POLICY IF EXISTS "Staff can upload dealer logos" ON storage.objects;
CREATE POLICY "Staff can upload dealer logos"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'dealer-logos'
  AND is_staff(auth.uid())
  AND (
    is_platform_admin(auth.uid())
    OR (storage.foldername(name))[1] = get_user_dealership_id(auth.uid())
    OR name LIKE 'about/' || get_user_dealership_id(auth.uid()) || '_%'
  )
);

DROP POLICY IF EXISTS "Staff can update dealer logos" ON storage.objects;
CREATE POLICY "Staff can update dealer logos"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'dealer-logos'
  AND is_staff(auth.uid())
  AND (
    is_platform_admin(auth.uid())
    OR (storage.foldername(name))[1] = get_user_dealership_id(auth.uid())
    OR name LIKE 'about/' || get_user_dealership_id(auth.uid()) || '_%'
  )
)
WITH CHECK (
  bucket_id = 'dealer-logos'
  AND is_staff(auth.uid())
  AND (
    is_platform_admin(auth.uid())
    OR (storage.foldername(name))[1] = get_user_dealership_id(auth.uid())
    OR name LIKE 'about/' || get_user_dealership_id(auth.uid()) || '_%'
  )
);

DROP POLICY IF EXISTS "Staff can delete dealer logos" ON storage.objects;
CREATE POLICY "Staff can delete dealer logos"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'dealer-logos'
  AND is_staff(auth.uid())
  AND (
    is_platform_admin(auth.uid())
    OR (storage.foldername(name))[1] = get_user_dealership_id(auth.uid())
    OR name LIKE 'about/' || get_user_dealership_id(auth.uid()) || '_%'
  )
);

NOTIFY pgrst, 'reload schema';