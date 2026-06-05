CREATE TABLE IF NOT EXISTS public.privacy_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  dealership_id text NOT NULL,
  request_type text NOT NULL CHECK (request_type IN ('access', 'correct', 'delete', 'optout')),
  name text,
  email text,
  phone text,
  details text,
  status text NOT NULL DEFAULT 'new',
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT INSERT ON public.privacy_requests TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.privacy_requests TO authenticated;
GRANT ALL ON public.privacy_requests TO service_role;

ALTER TABLE public.privacy_requests ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_privacy_requests_dealership ON public.privacy_requests (dealership_id, created_at DESC);

DROP POLICY IF EXISTS "Anyone can submit a privacy request" ON public.privacy_requests;
CREATE POLICY "Anyone can submit a privacy request"
  ON public.privacy_requests FOR INSERT TO anon, authenticated
  WITH CHECK (true);

DROP POLICY IF EXISTS "Staff read own-tenant privacy requests" ON public.privacy_requests;
CREATE POLICY "Staff read own-tenant privacy requests"
  ON public.privacy_requests FOR SELECT TO authenticated
  USING (
    public.is_platform_admin(auth.uid())
    OR (public.is_staff(auth.uid()) AND dealership_id = public.get_user_dealership_id(auth.uid()))
  );

DROP POLICY IF EXISTS "Staff update own-tenant privacy requests" ON public.privacy_requests;
CREATE POLICY "Staff update own-tenant privacy requests"
  ON public.privacy_requests FOR UPDATE TO authenticated
  USING (
    public.is_platform_admin(auth.uid())
    OR (public.is_staff(auth.uid()) AND dealership_id = public.get_user_dealership_id(auth.uid()))
  )
  WITH CHECK (
    public.is_platform_admin(auth.uid())
    OR (public.is_staff(auth.uid()) AND dealership_id = public.get_user_dealership_id(auth.uid()))
  );

NOTIFY pgrst, 'reload schema';