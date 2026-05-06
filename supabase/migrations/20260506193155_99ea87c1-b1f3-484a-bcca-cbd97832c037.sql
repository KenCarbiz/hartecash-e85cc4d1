CREATE TABLE IF NOT EXISTS public.offer_bumps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  submission_id UUID NOT NULL,
  dealership_id TEXT NOT NULL,
  previous_offer NUMERIC NOT NULL,
  new_offer NUMERIC NOT NULL,
  bump_amount NUMERIC NOT NULL,
  line_items JSONB DEFAULT '[]'::jsonb,
  source TEXT NOT NULL DEFAULT 'boost_offer',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS offer_bumps_submission_idx
  ON public.offer_bumps (submission_id, created_at DESC);
CREATE INDEX IF NOT EXISTS offer_bumps_dealership_idx
  ON public.offer_bumps (dealership_id, created_at DESC);

ALTER TABLE public.offer_bumps ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "offer_bumps_dealer_read" ON public.offer_bumps;
DROP POLICY IF EXISTS "offer_bumps_service_write" ON public.offer_bumps;

-- Dealers see bumps for their own dealership (matches submission visibility model).
CREATE POLICY "offer_bumps_dealer_read" ON public.offer_bumps
  FOR SELECT
  USING (
    public.is_platform_admin(auth.uid())
    OR public.get_user_dealership_id(auth.uid()) = dealership_id
  );

-- Writes only via service role (edge function); block all client inserts.
CREATE POLICY "offer_bumps_service_write" ON public.offer_bumps
  FOR INSERT
  WITH CHECK (false);

NOTIFY pgrst, 'reload schema';