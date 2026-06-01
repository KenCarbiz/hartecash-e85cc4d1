-- Fix storage policy joins: s.name → objects.name
DROP POLICY IF EXISTS "Staff can view own-tenant storage" ON storage.objects;
CREATE POLICY "Staff can view own-tenant storage"
ON storage.objects FOR SELECT
USING (
  (bucket_id = ANY (ARRAY['submission-photos'::text, 'customer-documents'::text]))
  AND (
    is_platform_admin(auth.uid())
    OR (
      is_staff(auth.uid())
      AND EXISTS (
        SELECT 1 FROM public.submissions s
        WHERE s.token = (storage.foldername(objects.name))[1]
          AND s.dealership_id = get_user_dealership_id(auth.uid())
      )
    )
  )
);

DROP POLICY IF EXISTS "Admins can delete own-tenant customer documents" ON storage.objects;
CREATE POLICY "Admins can delete own-tenant customer documents"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'customer-documents'
  AND (
    is_platform_admin(auth.uid())
    OR (
      has_role(auth.uid(), 'admin'::app_role)
      AND EXISTS (
        SELECT 1 FROM public.submissions s
        WHERE s.token = (storage.foldername(objects.name))[1]
          AND s.dealership_id = get_user_dealership_id(auth.uid())
      )
    )
  )
);

DROP POLICY IF EXISTS "Admins can delete own-tenant submission photos" ON storage.objects;
CREATE POLICY "Admins can delete own-tenant submission photos"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'submission-photos'
  AND (
    is_platform_admin(auth.uid())
    OR (
      has_role(auth.uid(), 'admin'::app_role)
      AND EXISTS (
        SELECT 1 FROM public.submissions s
        WHERE s.token = (storage.foldername(objects.name))[1]
          AND s.dealership_id = get_user_dealership_id(auth.uid())
      )
    )
  )
);

-- Belt-and-suspenders restrictive deny for early_access_signups: only platform admins read.
-- (Permissive-only model already denies non-admins by default, but a RESTRICTIVE policy
-- makes the intent explicit and survives future permissive additions.)
DROP POLICY IF EXISTS "Restrict early-access reads to platform admins" ON public.early_access_signups;
CREATE POLICY "Restrict early-access reads to platform admins"
ON public.early_access_signups AS RESTRICTIVE FOR SELECT TO anon, authenticated
USING (is_platform_admin(auth.uid()));

NOTIFY pgrst, 'reload schema';