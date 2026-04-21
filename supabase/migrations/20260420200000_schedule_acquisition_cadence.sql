-- Schedule the acquisition cadence that already exists as an edge
-- function but wasn't wired to a cron.
--
-- run-acquisition-cadence walks a per-day cadence for each lead:
--   Day 0 — instant offer notification
--   Day 1 — gentle SMS nudge
--   Day 2 — AI voice call #1
--   Day 3 — tire/brake value-add SMS
--   Day 5 — AI voice call #2
--   Day 6 — urgency SMS
--   Day 8 — AI voice call #3 (with price-bump if configured)
--   Day 14 — final check-in
-- Plus a parallel cadence for accepted-but-not-booked leads (schedule
-- the inspection).
--
-- Running once a day at 10:15 local means every lead that crossed a
-- cadence-step boundary gets picked up within a business-day window.
-- Not hourly — voice-call volume would balloon and the cadence is
-- day-indexed anyway.

SELECT cron.unschedule('acquisition_cadence_daily')
WHERE EXISTS (
  SELECT 1 FROM cron.job WHERE jobname = 'acquisition_cadence_daily'
);

SELECT cron.schedule(
  'acquisition_cadence_daily',
  -- 10:15 UTC ~= morning East Coast / mid-morning Central.
  -- If dealers span multiple time zones we'll add per-tenant scheduling
  -- later; for now this hits mid-morning for most US stores.
  '15 10 * * *',
  $$
    SELECT net.http_post(
      url := current_setting('app.supabase_url', true) || '/functions/v1/run-acquisition-cadence',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || current_setting('app.supabase_service_role_key', true)
      ),
      body := '{}'::jsonb
    );
  $$
);
