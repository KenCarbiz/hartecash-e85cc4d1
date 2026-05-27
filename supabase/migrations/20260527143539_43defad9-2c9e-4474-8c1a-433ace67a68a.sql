CREATE TABLE IF NOT EXISTS public.early_access_signups (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_name     text,
  dealership_name  text NOT NULL,
  email            text NOT NULL,
  phone            text,
  rooftops         text,
  current_solution text,
  status           text NOT NULL DEFAULT 'new',
  source           text NOT NULL DEFAULT 'early-access-page',
  created_at       timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT ON public.early_access_signups TO anon;
GRANT SELECT, INSERT ON public.early_access_signups TO authenticated;
GRANT ALL ON public.early_access_signups TO service_role;

CREATE INDEX IF NOT EXISTS early_access_signups_created_at_idx ON public.early_access_signups(created_at);
CREATE INDEX IF NOT EXISTS early_access_signups_status_idx ON public.early_access_signups(status);

ALTER TABLE public.early_access_signups ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can submit an early-access signup" ON public.early_access_signups;
CREATE POLICY "Anyone can submit an early-access signup"
ON public.early_access_signups FOR INSERT TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "Platform admins can read early-access signups" ON public.early_access_signups;
CREATE POLICY "Platform admins can read early-access signups"
ON public.early_access_signups FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND dealership_id = 'default' AND role = 'admin'));

NOTIFY pgrst, 'reload schema';