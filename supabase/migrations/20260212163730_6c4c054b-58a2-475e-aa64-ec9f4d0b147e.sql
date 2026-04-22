
-- Create storage bucket for customer documents
INSERT INTO storage.buckets (id, name, public)
VALUES ('customer-documents', 'customer-documents', true)
ON CONFLICT (id) DO NOTHING;

-- Allow anyone to upload documents (token-based, like photos)
CREATE POLICY "Anyone can upload customer documents"
ON storage.objects
FOR INSERT
WITH CHECK (bucket_id = 'customer-documents');

-- Anyone can view customer documents
CREATE POLICY "Anyone can view customer documents"
ON storage.objects
FOR SELECT
USING (bucket_id = 'customer-documents');

-- Staff can delete customer documents
CREATE POLICY "Staff can delete customer documents"
ON storage.objects
FOR DELETE
USING (bucket_id = 'customer-documents' AND public.is_staff(auth.uid()));

-- Add docs_uploaded column to submissions
ALTER TABLE public.submissions
ADD COLUMN IF NOT EXISTS docs_uploaded boolean NOT NULL DEFAULT false;

-- Create RPC for marking docs uploaded
CREATE OR REPLACE FUNCTION public.mark_docs_uploaded(_token text)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = 'public'
AS $$
  UPDATE submissions SET docs_uploaded = true WHERE token = _token;
$$;
