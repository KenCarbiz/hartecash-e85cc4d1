-- Add profile_image_url column to profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS profile_image_url text;

-- Create storage bucket for staff avatars
INSERT INTO storage.buckets (id, name, public)
VALUES ('staff-avatars', 'staff-avatars', true)
ON CONFLICT (id) DO NOTHING;

-- Allow authenticated users to upload their own avatar
CREATE POLICY "Users can upload own avatar"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'staff-avatars' AND (storage.foldername(name))[1] = auth.uid()::text);

-- Allow authenticated users to update their own avatar
CREATE POLICY "Users can update own avatar"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'staff-avatars' AND (storage.foldername(name))[1] = auth.uid()::text);

-- Allow authenticated users to delete their own avatar
CREATE POLICY "Users can delete own avatar"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'staff-avatars' AND (storage.foldername(name))[1] = auth.uid()::text);

-- Staff (admins) can upload avatars for any user
CREATE POLICY "Staff can upload any avatar"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'staff-avatars' AND is_staff(auth.uid()));

-- Staff can update any avatar
CREATE POLICY "Staff can update any avatar"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'staff-avatars' AND is_staff(auth.uid()));

-- Staff can delete any avatar
CREATE POLICY "Staff can delete any avatar"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'staff-avatars' AND is_staff(auth.uid()));

-- Anyone can view avatars (public bucket)
CREATE POLICY "Anyone can view avatars"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'staff-avatars');