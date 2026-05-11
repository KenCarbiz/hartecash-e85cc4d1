-- ⚠️  DO NOT APPLY VIA LOVABLE PUSH.
--
-- This file is retained for historical record only. The cron schedule
-- it would have created is ALREADY REGISTERED in production by
-- Lovable's cron-management tool, using an anon-key bearer header
-- that works in this project's environment.
--
-- The body below uses `current_setting('app.supabase_service_role_key',
-- true)` which resolves to an empty string in this environment, so
-- re-applying this migration would silently break the working
-- schedule.
--
-- If the cron needs to be re-registered (e.g. fresh project bootstrap),
-- use Lovable's cron tool or hand-craft the schedule with the
-- correct auth header — do NOT replay this file.
--
-- ─────────────────────────────────────────────────────────────────
--
-- Schedule the voice-pipeline retry handler.
--
-- Calls the process-stuck-voice-calls edge function every 5 minutes
-- using net.http_post — same pattern used by escalation_sla_check
-- and the appointment-reminder cron.
--
-- The 5-minute cadence is the floor for "noticeable customer
-- impact": with 2-min retry backoff in mark_voice_pipeline_job,
-- a single transient failure resolves within 5 min; sustained
-- failures still get bounded retries before the 5-attempt
-- abandonment threshold trips.
--
-- Idempotent (unschedule-then-schedule).

SELECT cron.unschedule('process_stuck_voice_calls')
WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'process_stuck_voice_calls');

SELECT cron.schedule(
  'process_stuck_voice_calls',
  '*/5 * * * *',
  $$
    SELECT net.http_post(
      url := current_setting('app.supabase_url', true)
             || '/functions/v1/process-stuck-voice-calls',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer '
          || current_setting('app.supabase_service_role_key', true)
      ),
      body := '{}'::jsonb,
      timeout_milliseconds := 60000
    );
  $$
);

NOTIFY pgrst, 'reload schema';
