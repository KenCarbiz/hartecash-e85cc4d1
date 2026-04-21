-- Escalation SLA: stale escalations auto-alert the next tier.
--
-- Today a BDC rep hits "Escalate to Manager" and the submission
-- surfaces on the queue with a badge — but if every manager is heads-
-- down the escalation can sit untouched for hours. Customer's already
-- cold by then. This migration adds a 30-minute SLA: if an escalation
-- isn't resolved in 30 minutes we fire a "staff_escalation_overdue"
-- notification to everyone in the management tier so someone grabs it.

ALTER TABLE public.submissions
  ADD COLUMN IF NOT EXISTS escalation_sla_breach_notified_at timestamptz;

COMMENT ON COLUMN public.submissions.escalation_sla_breach_notified_at IS
  'When the 30-minute SLA alert was fired for this escalation. Dedup so the cron doesn''t re-ping managers every 10 minutes forever. Cleared when a new escalation is opened on the same submission.';

-- ── Scheduled check every 10 minutes ─────────────────────────────
SELECT cron.unschedule('escalation_sla_check')
WHERE EXISTS (
  SELECT 1 FROM cron.job WHERE jobname = 'escalation_sla_check'
);

SELECT cron.schedule(
  'escalation_sla_check',
  '*/10 * * * *',
  $$
    SELECT net.http_post(
      url := current_setting('app.supabase_url', true) || '/functions/v1/check-escalation-sla',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || current_setting('app.supabase_service_role_key', true)
      ),
      body := '{}'::jsonb
    );
  $$
);

NOTIFY pgrst, 'reload schema';
