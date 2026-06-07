
-- 1. notification_settings: restrict SELECT to admins only (was: any staff)
DROP POLICY IF EXISTS "Staff can read own tenant notification settings" ON public.notification_settings;

CREATE POLICY "Admins can read own tenant notification settings"
ON public.notification_settings
FOR SELECT
USING (
  public.is_platform_admin(auth.uid())
  OR (
    public.has_role(auth.uid(), 'admin'::app_role)
    AND dealership_id = public.get_user_dealership_id(auth.uid())
  )
);

-- 2. Storage upload policies: require token_expires_at > now()
DROP POLICY IF EXISTS "Token-based upload for photos" ON storage.objects;
DROP POLICY IF EXISTS "Token-based upload for documents" ON storage.objects;

CREATE POLICY "Token-based upload for photos"
ON storage.objects
FOR INSERT
WITH CHECK (
  bucket_id = 'submission-photos'
  AND (storage.foldername(name))[1] IN (
    SELECT token FROM public.submissions
    WHERE token IS NOT NULL
      AND (token_expires_at IS NULL OR token_expires_at > now())
  )
);

CREATE POLICY "Token-based upload for documents"
ON storage.objects
FOR INSERT
WITH CHECK (
  bucket_id = 'customer-documents'
  AND (storage.foldername(name))[1] IN (
    SELECT token FROM public.submissions
    WHERE token IS NOT NULL
      AND (token_expires_at IS NULL OR token_expires_at > now())
  )
);

NOTIFY pgrst, 'reload schema';
