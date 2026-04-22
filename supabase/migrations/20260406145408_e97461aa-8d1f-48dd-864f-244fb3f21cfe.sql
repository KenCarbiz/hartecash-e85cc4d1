INSERT INTO storage.buckets (id, name, public) VALUES ('dealer-logos', 'dealer-logos', true);

CREATE POLICY "Anyone can view dealer logos"
ON storage.objects FOR SELECT
USING (bucket_id = 'dealer-logos');

CREATE POLICY "Staff can upload dealer logos"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'dealer-logos' AND auth.role() = 'authenticated');

CREATE POLICY "Staff can update dealer logos"
ON storage.objects FOR UPDATE
USING (bucket_id = 'dealer-logos' AND auth.role() = 'authenticated')
WITH CHECK (bucket_id = 'dealer-logos' AND auth.role() = 'authenticated');

CREATE POLICY "Staff can delete dealer logos"
ON storage.objects FOR DELETE
USING (bucket_id = 'dealer-logos' AND auth.role() = 'authenticated');