-- Allow admins to delete submission photos
CREATE POLICY "Admins can delete submission photos"
ON storage.objects
FOR DELETE
USING (bucket_id = 'submission-photos' AND has_role(auth.uid(), 'admin'::app_role));

-- Update existing customer-documents delete policy to admin-only
DROP POLICY IF EXISTS "Staff can delete customer documents" ON storage.objects;

CREATE POLICY "Admins can delete customer documents"
ON storage.objects
FOR DELETE
USING (bucket_id = 'customer-documents' AND has_role(auth.uid(), 'admin'::app_role));