-- 1. dealership_locations: lat/lng (idempotent)
ALTER TABLE public.dealership_locations
  ADD COLUMN IF NOT EXISTS center_lat double precision,
  ADD COLUMN IF NOT EXISTS center_lng double precision;

-- 2. analytics_events table
CREATE TABLE IF NOT EXISTS public.analytics_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_name text NOT NULL,
  properties jsonb NOT NULL DEFAULT '{}'::jsonb,
  page_url text,
  user_id uuid,
  dealership_id text,
  "timestamp" timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS analytics_events_recent_idx
  ON public.analytics_events (created_at DESC);
CREATE INDEX IF NOT EXISTS analytics_events_event_idx
  ON public.analytics_events (event_name, created_at DESC);
CREATE INDEX IF NOT EXISTS analytics_events_dealer_idx
  ON public.analytics_events (dealership_id, created_at DESC)
  WHERE dealership_id IS NOT NULL;

ALTER TABLE public.analytics_events ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'analytics_events'
      AND policyname = 'Anyone can insert analytics_events'
  ) THEN
    CREATE POLICY "Anyone can insert analytics_events"
      ON public.analytics_events
      FOR INSERT
      TO public
      WITH CHECK (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'analytics_events'
      AND policyname = 'Admins read own tenant analytics_events'
  ) THEN
    CREATE POLICY "Admins read own tenant analytics_events"
      ON public.analytics_events
      FOR SELECT
      TO authenticated
      USING (
        has_role(auth.uid(), 'admin'::app_role)
        AND (dealership_id IS NULL OR dealership_id = get_user_dealership_id(auth.uid()))
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'analytics_events'
      AND policyname = 'Service role full access analytics_events'
  ) THEN
    CREATE POLICY "Service role full access analytics_events"
      ON public.analytics_events
      TO service_role
      USING (true)
      WITH CHECK (true);
  END IF;
END $$;

NOTIFY pgrst, 'reload schema';
