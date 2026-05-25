
-- 1. conversation_events: require is_staff on INSERT
DROP POLICY IF EXISTS "Staff insert own-dealership conversation events" ON public.conversation_events;
CREATE POLICY "Staff insert own-dealership conversation events"
ON public.conversation_events
FOR INSERT
TO authenticated
WITH CHECK (
  is_platform_admin(auth.uid())
  OR (
    is_staff(auth.uid())
    AND dealership_id = get_user_dealership_id(auth.uid())
  )
);

-- 2. data-egress bucket: allow dealer staff to read their own dealership's files
DROP POLICY IF EXISTS "Dealer staff read own dealership data-egress files" ON storage.objects;
CREATE POLICY "Dealer staff read own dealership data-egress files"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'data-egress'
  AND is_staff(auth.uid())
  AND (storage.foldername(name))[1] = get_user_dealership_id(auth.uid())
);

-- 3. security_incident: restrict NULL dealership rows to platform admins
DROP POLICY IF EXISTS "Admins manage own tenant security_incident" ON public.security_incident;
CREATE POLICY "Admins manage own tenant security_incident"
ON public.security_incident
FOR ALL
TO authenticated
USING (
  (is_platform_admin(auth.uid()) AND dealership_id IS NULL)
  OR (has_role(auth.uid(), 'admin'::app_role) AND dealership_id = get_user_dealership_id(auth.uid()))
  OR is_platform_admin(auth.uid())
)
WITH CHECK (
  (is_platform_admin(auth.uid()) AND dealership_id IS NULL)
  OR (has_role(auth.uid(), 'admin'::app_role) AND dealership_id = get_user_dealership_id(auth.uid()))
  OR is_platform_admin(auth.uid())
);

NOTIFY pgrst, 'reload schema';
