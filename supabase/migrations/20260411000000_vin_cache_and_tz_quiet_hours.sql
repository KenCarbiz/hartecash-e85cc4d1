-- Part 1 cleanup (items #15 and #18):
-- 1. Add a timezone column to notification_settings so quiet hours are honored
--    in a specific IANA timezone instead of the edge function's UTC clock.
-- 2. Create a Black Book VIN response cache so duplicate lookups within a
--    24h window do not charge the dealership twice.

-- ── Quiet hours timezone ────────────────────────────────────────────────
ALTER TABLE public.notification_settings
  ADD COLUMN IF NOT EXISTS quiet_hours_timezone text NOT NULL DEFAULT 'America/New_York';

COMMENT ON COLUMN public.notification_settings.quiet_hours_timezone IS
  'IANA timezone used when evaluating quiet_hours_start/end. Defaults to America/New_York.';

-- ── Black Book VIN cache ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.bb_vin_cache (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cache_key text NOT NULL UNIQUE,
  lookup_type text NOT NULL,
  vin text,
  plate text,
  state text,
  mileage integer,
  response_json jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '24 hours')
);

CREATE INDEX IF NOT EXISTS idx_bb_vin_cache_expires
  ON public.bb_vin_cache (expires_at);

CREATE INDEX IF NOT EXISTS idx_bb_vin_cache_vin
  ON public.bb_vin_cache (vin)
  WHERE vin IS NOT NULL;

ALTER TABLE public.bb_vin_cache ENABLE ROW LEVEL SECURITY;

-- Edge functions use the service role and bypass RLS, so no policies needed
-- for writes. Reads are service-role only as well; no client should ever
-- read this table directly.

-- Cleanup function — can be invoked from any scheduled job or called
-- opportunistically from the bb-lookup edge function.
CREATE OR REPLACE FUNCTION public.cleanup_expired_bb_vin_cache()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM public.bb_vin_cache WHERE expires_at < now();
END;
$$;
