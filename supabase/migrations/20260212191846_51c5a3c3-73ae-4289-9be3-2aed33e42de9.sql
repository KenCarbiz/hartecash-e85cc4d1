
-- Fix 1: Drop the overly permissive UPDATE policy on submissions
DROP POLICY IF EXISTS "Anyone can update submission photos status" ON public.submissions;

-- Fix 2: Make storage buckets private
UPDATE storage.buckets SET public = false WHERE id IN ('submission-photos', 'customer-documents');

-- Fix 3: Drop overly permissive storage SELECT policies
DROP POLICY IF EXISTS "Anyone can view submission photos" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can view customer documents" ON storage.objects;

-- Fix 4: Add staff-only SELECT policy for both buckets
CREATE POLICY "Staff can view all storage"
ON storage.objects FOR SELECT
USING (
  bucket_id IN ('submission-photos', 'customer-documents')
  AND is_staff(auth.uid())
);

-- Keep existing upload policies (token-based INSERT) if they exist
-- Add token-based upload policies if missing
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Token-based upload for photos' AND tablename = 'objects') THEN
    EXECUTE 'CREATE POLICY "Token-based upload for photos" ON storage.objects FOR INSERT WITH CHECK (bucket_id = ''submission-photos'' AND (storage.foldername(name))[1] IN (SELECT token FROM public.submissions))';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Token-based upload for documents' AND tablename = 'objects') THEN
    EXECUTE 'CREATE POLICY "Token-based upload for documents" ON storage.objects FOR INSERT WITH CHECK (bucket_id = ''customer-documents'' AND (storage.foldername(name))[1] IN (SELECT token FROM public.submissions))';
  END IF;
END $$;
