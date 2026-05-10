INSERT INTO storage.buckets (id, name, public) VALUES ('dealer-logos', 'dealer-logos', true)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "Anyone can view dealer logos"   ON storage.objects;
CREATE POLICY "Anyone can view dealer logos"
ON storage.objects FOR SELECT
USING (bucket_id = 'dealer-logos');

DROP POLICY IF EXISTS "Staff can upload dealer logos" ON storage.objects;
CREATE POLICY "Staff can upload dealer logos"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'dealer-logos' AND auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Staff can update dealer logos" ON storage.objects;
CREATE POLICY "Staff can update dealer logos"
ON storage.objects FOR UPDATE
USING (bucket_id = 'dealer-logos' AND auth.role() = 'authenticated')
WITH CHECK (bucket_id = 'dealer-logos' AND auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Staff can delete dealer logos" ON storage.objects;
CREATE POLICY "Staff can delete dealer logos"
ON storage.objects FOR DELETE
USING (bucket_id = 'dealer-logos' AND auth.role() = 'authenticated');
