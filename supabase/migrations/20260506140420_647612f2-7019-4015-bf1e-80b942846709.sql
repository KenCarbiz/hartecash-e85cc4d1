ALTER TABLE public.submissions ADD COLUMN IF NOT EXISTS embed_source TEXT;
ALTER TABLE public.submissions ADD COLUMN IF NOT EXISTS embed_vehicle_label TEXT;
ALTER TABLE public.submissions ADD COLUMN IF NOT EXISTS embed_vehicle_msrp NUMERIC;
ALTER TABLE public.submissions ADD COLUMN IF NOT EXISTS offer_made_at TIMESTAMPTZ;

UPDATE public.submissions
   SET offer_made_at = created_at
 WHERE offer_made_at IS NULL
   AND offered_price IS NOT NULL
   AND offered_price > 0;

CREATE OR REPLACE FUNCTION public.set_offer_made_at()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.offered_price IS NOT NULL AND NEW.offered_price > 0
     AND (OLD.offered_price IS NULL OR OLD.offered_price = 0)
     AND NEW.offer_made_at IS NULL THEN
    NEW.offer_made_at := NOW();
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS submissions_set_offer_made_at ON public.submissions;
CREATE TRIGGER submissions_set_offer_made_at
  BEFORE UPDATE ON public.submissions
  FOR EACH ROW EXECUTE FUNCTION public.set_offer_made_at();

CREATE OR REPLACE FUNCTION public.set_offer_made_at_insert()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.offered_price IS NOT NULL AND NEW.offered_price > 0
     AND NEW.offer_made_at IS NULL THEN
    NEW.offer_made_at := NOW();
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS submissions_set_offer_made_at_insert ON public.submissions;
CREATE TRIGGER submissions_set_offer_made_at_insert
  BEFORE INSERT ON public.submissions
  FOR EACH ROW EXECUTE FUNCTION public.set_offer_made_at_insert();

ALTER TABLE public.site_config
  ADD COLUMN IF NOT EXISTS embed_escalation_enabled BOOLEAN NOT NULL DEFAULT TRUE;
ALTER TABLE public.site_config
  ADD COLUMN IF NOT EXISTS embed_escalation_max_tier SMALLINT NOT NULL DEFAULT 3;

ALTER TABLE public.site_config DROP CONSTRAINT IF EXISTS site_config_embed_escalation_max_tier_check;
ALTER TABLE public.site_config ADD CONSTRAINT site_config_embed_escalation_max_tier_check
  CHECK (embed_escalation_max_tier >= 0 AND embed_escalation_max_tier <= 3);

CREATE TABLE IF NOT EXISTS public.embed_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  dealership_id TEXT NOT NULL,
  event_type TEXT NOT NULL,
  intent TEXT,
  tier SMALLINT,
  vehicle_label TEXT,
  vehicle_msrp NUMERIC,
  submission_token TEXT,
  page_url TEXT,
  user_agent TEXT,
  session_id TEXT,
  payload JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS embed_events_dealership_created_idx
  ON public.embed_events (dealership_id, created_at DESC);
CREATE INDEX IF NOT EXISTS embed_events_event_type_idx
  ON public.embed_events (event_type);
CREATE INDEX IF NOT EXISTS embed_events_session_idx
  ON public.embed_events (session_id) WHERE session_id IS NOT NULL;

ALTER TABLE public.embed_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "embed_events_dealer_read" ON public.embed_events;
DROP POLICY IF EXISTS "embed_events_service_write" ON public.embed_events;

CREATE POLICY "embed_events_dealer_read" ON public.embed_events
  FOR SELECT TO authenticated
  USING (
    public.is_platform_admin(auth.uid())
    OR dealership_id = public.get_user_dealership_id(auth.uid())
  );

CREATE POLICY "embed_events_service_write" ON public.embed_events
  FOR INSERT
  WITH CHECK (true);

NOTIFY pgrst, 'reload schema';