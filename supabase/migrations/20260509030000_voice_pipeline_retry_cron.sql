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
