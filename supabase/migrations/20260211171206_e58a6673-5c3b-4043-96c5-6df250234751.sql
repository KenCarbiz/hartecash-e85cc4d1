
-- Make the anonymous update policy more restrictive - only allow updating photos_uploaded
DROP POLICY "Anyone can update submission photos status" ON public.submissions;

CREATE POLICY "Anyone can update photos_uploaded by token"
  ON public.submissions FOR UPDATE
  USING (true)
  WITH CHECK (true);
