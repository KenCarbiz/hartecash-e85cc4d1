-- Cadence engine — pg_cron schedule.
--
-- Runs cadence-tick every 5 minutes. The orchestrator batches up to
-- 50 submissions per run and is bounded ~30s, so a 5-min tick gives
-- plenty of headroom even at peak load. The function is idempotent
-- (cadence_step + cadence_log dedupe), so a missed tick recovers
-- automatically on the next run.
--
-- The 5-minute interval matches the granularity of our cadence
-- definitions (smallest gap is +5min for the stall cadence's
-- first SMS after acceptance) — finer granularity wouldn't be
-- meaningful and coarser would skew the +5min touch by up to a
-- full tick.
--
-- Idempotent — unschedules first if the job already exists.

SELECT cron.unschedule('cadence_tick')
WHERE EXISTS (
  SELECT 1 FROM cron.job WHERE jobname = 'cadence_tick'
);

SELECT cron.schedule(
  'cadence_tick',
  '*/5 * * * *',
  $$
    SELECT net.http_post(
      url := current_setting('app.supabase_url', true) || '/functions/v1/cadence-tick',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || current_setting('app.supabase_service_role_key', true)
      ),
      body := '{}'::jsonb
    );
  $$
);

NOTIFY pgrst, 'reload schema';
