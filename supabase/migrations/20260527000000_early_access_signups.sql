-- Early-access signups for the AutoCurb.io platform.
-- Dealers reach autocurb.io/early-access, fill out the form, and land here.
-- Public (anon) can INSERT a signup; only platform admins can read them.
-- Mirrors the prospect_demo_views anon-insert + platform-admin-read pattern.

CREATE TABLE IF NOT EXISTS public.early_access_signups (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  -- Contact + dealership identity (dealership_name + email required at the form).
  contact_name     text,
  dealership_name  text NOT NULL,
  email            text NOT NULL,
  phone            text,
  -- Free-text rooftop count / range as typed or picked ("1", "2-5", "20+").
  rooftops         text,
  -- "What are you using today?" note from the prospect.
  current_solution text,
  -- Pipeline status the Autocurb team moves through (new → contacted → ...).
  status           text NOT NULL DEFAULT 'new',
  -- Where the signup originated, in case we add more entry points later.
  source           text NOT NULL DEFAULT 'early-access-page',
  created_at       timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS early_access_signups_created_at_idx
  ON public.early_access_signups(created_at);
CREATE INDEX IF NOT EXISTS early_access_signups_status_idx
  ON public.early_access_signups(status);

ALTER TABLE public.early_access_signups ENABLE ROW LEVEL SECURITY;

-- Anyone (the public form) can submit a signup.
DROP POLICY IF EXISTS "Anyone can submit an early-access signup" ON public.early_access_signups;
CREATE POLICY "Anyone can submit an early-access signup"
ON public.early_access_signups
FOR INSERT
TO anon, authenticated
WITH CHECK (true);

-- Only platform admins (Autocurb staff) can read the signups.
DROP POLICY IF EXISTS "Platform admins can read early-access signups" ON public.early_access_signups;
CREATE POLICY "Platform admins can read early-access signups"
ON public.early_access_signups
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid()
      AND dealership_id = 'default'
      AND role = 'admin'
  )
);

NOTIFY pgrst, 'reload schema';
