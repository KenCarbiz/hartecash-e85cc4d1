-- Consumer privacy-rights intake (CCPA/CPRA + state laws): lets a
-- customer submit an access / correction / deletion / opt-out request
-- from the public /my-data-rights page. Requests are tenant-scoped:
-- only the owning dealership's staff (or a platform super-admin) can
-- read or action them — never another dealership.
--
-- Idempotent.

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

ALTER TABLE public.privacy_requests ENABLE ROW LEVEL SECURITY;

-- PostgREST needs table-level privileges in addition to RLS policies:
-- anon can only INSERT (submit a request); authenticated staff get full
-- CRUD but every row is still gated by the RLS policies below.
GRANT INSERT ON public.privacy_requests TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.privacy_requests TO authenticated;

CREATE INDEX IF NOT EXISTS idx_privacy_requests_dealership ON public.privacy_requests (dealership_id, created_at DESC);

-- A consumer (anonymous) may submit a request.
DROP POLICY IF EXISTS "Anyone can submit a privacy request" ON public.privacy_requests;
CREATE POLICY "Anyone can submit a privacy request"
  ON public.privacy_requests FOR INSERT TO anon, authenticated
  WITH CHECK (true);

-- Only the owning dealership's staff (or platform super-admin) can read.
DROP POLICY IF EXISTS "Staff read own-tenant privacy requests" ON public.privacy_requests;
CREATE POLICY "Staff read own-tenant privacy requests"
  ON public.privacy_requests FOR SELECT TO authenticated
  USING (
    public.is_platform_admin(auth.uid())
    OR (public.is_staff(auth.uid()) AND dealership_id = public.get_user_dealership_id(auth.uid()))
  );

-- Only the owning dealership's staff (or platform super-admin) can update.
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
