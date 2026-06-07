-- Tighten anonymous insert on photo_metadata to require knowing the submission token,
-- mirroring the pattern used by submission-photos uploads.
DROP POLICY IF EXISTS "Anonymous insert photo_metadata" ON public.photo_metadata;

CREATE POLICY "Anonymous insert photo_metadata"
ON public.photo_metadata
FOR INSERT
TO anon, authenticated
WITH CHECK (
  submission_id IS NOT NULL
  AND submission_token IS NOT NULL
  AND EXISTS (
    SELECT 1
    FROM public.submissions s
    WHERE s.id = photo_metadata.submission_id
      AND s.token = photo_metadata.submission_token
  )
);

-- Scrub internal staff contact email from publicly-readable site_config rows.
-- The 'email' column is intended for dealer-published support contacts;
-- ken@ken.cc is an internal address and must not leak via the public read policy.
UPDATE public.site_config
SET email = NULL
WHERE email = 'ken@ken.cc';

NOTIFY pgrst, 'reload schema';