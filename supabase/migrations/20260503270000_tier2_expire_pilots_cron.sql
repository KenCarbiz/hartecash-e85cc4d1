-- Tier 2.10 — pg_cron schedule for expire_pilots().
--
-- The expire_pilots() function (added in 20260503230000_tier2_rooftop_
-- activations.sql) promotes any rooftop_activations row whose
-- pilot_ends_at has passed from status='pilot' to status='active'.
-- This migration wires it to pg_cron on an hourly cadence — a missed
-- run is harmless (the function is idempotent) and an hour of pilot
-- "lag" before promotion has no downstream effect since billing is
-- driven by Stripe's own trial-end transitions independently.
--
-- IDEMPOTENT — uses unschedule + schedule pair so re-running this
-- migration replaces any prior schedule of the same name.

DO $$
BEGIN
  -- Drop any prior schedule under the same name. cron.unschedule is
  -- a function that errors if no row matches, so wrap in EXCEPTION.
  BEGIN
    PERFORM cron.unschedule('expire_rooftop_pilots');
  EXCEPTION WHEN OTHERS THEN
    -- ignore: no prior schedule
    NULL;
  END;
END $$;

-- Run hourly. Cron format: minute hour day month weekday.
SELECT cron.schedule(
  'expire_rooftop_pilots',
  '5 * * * *', -- 5 minutes past every hour
  $$ SELECT public.expire_pilots(); $$
);

NOTIFY pgrst, 'reload schema';
