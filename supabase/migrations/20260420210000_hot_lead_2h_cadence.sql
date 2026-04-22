-- Hot-lead sub-day followup cadence.
--
-- The existing run-acquisition-cadence edge function is day-indexed
-- (Day 0 offer notification, Day 1 gentle nudge, Day 2 first voice
-- call, ...). That leaves the most valuable window — the first few
-- hours after the customer saw their offer — without a nudge. Industry
-- data: a follow-up touch in the 2-4h window after offer generation
-- doubles inspection-appointment conversion for leads that otherwise
-- would have gone cold.
--
-- This migration adds the tracking columns + cron schedule; the
-- matching edge function run-hot-lead-cadence ships in the same commit.

ALTER TABLE public.submissions
  ADD COLUMN IF NOT EXISTS hot_followup_2h_sent_at timestamptz,
  ADD COLUMN IF NOT EXISTS hot_followup_4h_sent_at timestamptz;

COMMENT ON COLUMN public.submissions.hot_followup_2h_sent_at IS
  'Timestamp of the 2-hour SMS nudge ("still have questions about your offer?") fired by run-hot-lead-cadence. Dedup so cron retries never double-text.';
COMMENT ON COLUMN public.submissions.hot_followup_4h_sent_at IS
  'Timestamp of the 4-hour AI voice call attempt. Fired only when the 2h SMS got no engagement (no appointment, no portal re-view, no accept).';

-- Index the hot-lead scan window — submissions from the last 6 hours
-- with an offer but no appointment. Cron runs every 30 min so cheap.
CREATE INDEX IF NOT EXISTS submissions_hot_lead_window_idx
  ON public.submissions (created_at DESC)
  WHERE estimated_offer_high IS NOT NULL
    AND appointment_set = false;

SELECT cron.unschedule('hot_lead_cadence_30min')
WHERE EXISTS (
  SELECT 1 FROM cron.job WHERE jobname = 'hot_lead_cadence_30min'
);

SELECT cron.schedule(
  'hot_lead_cadence_30min',
  '*/30 * * * *',
  $$
    SELECT net.http_post(
      url := current_setting('app.supabase_url', true) || '/functions/v1/run-hot-lead-cadence',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || current_setting('app.supabase_service_role_key', true)
      ),
      body := '{}'::jsonb
    );
  $$
);

NOTIFY pgrst, 'reload schema';
