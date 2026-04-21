-- Funnel leak #2: appointment no-shows.
--
-- Industry data puts raw no-show rates at 25-40% when the only contact
-- after booking is the confirmation text. A 24h + 2h reminder cadence
-- plus a self-serve reschedule link typically lifts show-ups 15-25%.
-- This migration lays the schema + cron; the matching edge function
-- update (send-appointment-reminders) + customer-facing /reschedule
-- page ship in the same commit.

-- ── Reminder tracking + self-serve reschedule token ─────────────────
ALTER TABLE public.appointments
  ADD COLUMN IF NOT EXISTS reminder_24h_sent_at timestamptz,
  ADD COLUMN IF NOT EXISTS reminder_2h_sent_at timestamptz,
  ADD COLUMN IF NOT EXISTS reschedule_token text UNIQUE,
  ADD COLUMN IF NOT EXISTS rescheduled_at timestamptz,
  ADD COLUMN IF NOT EXISTS rescheduled_from timestamptz;

COMMENT ON COLUMN public.appointments.reminder_24h_sent_at IS
  'Timestamp of the 24-hour-before reminder send. Prevents duplicate sends when the cron runs multiple times in the window.';
COMMENT ON COLUMN public.appointments.reminder_2h_sent_at IS
  'Timestamp of the 2-hour-before reminder send. Same dedup pattern as the 24h column.';
COMMENT ON COLUMN public.appointments.reschedule_token IS
  'Random opaque token included in reminder SMS so the customer can self-serve a reschedule via /reschedule/:token without logging in. Rotates on every reschedule.';
COMMENT ON COLUMN public.appointments.rescheduled_at IS
  'When the customer last rescheduled via self-serve. Null = original time kept.';
COMMENT ON COLUMN public.appointments.rescheduled_from IS
  'The previous scheduled_at value when the customer reschedules — keeps one step of history without a separate audit table.';

-- Backfill reschedule_token for existing pending appointments so the
-- first reminder SMS that fires for them has a working link.
UPDATE public.appointments
SET reschedule_token = encode(gen_random_bytes(16), 'hex')
WHERE reschedule_token IS NULL
  AND status = 'pending';

-- Index for the customer-facing reschedule page lookup.
CREATE INDEX IF NOT EXISTS appointments_reschedule_token_idx
  ON public.appointments (reschedule_token)
  WHERE reschedule_token IS NOT NULL;

-- Index for the cron window scan — only scan pending future appointments.
CREATE INDEX IF NOT EXISTS appointments_reminder_window_idx
  ON public.appointments (scheduled_at)
  WHERE status = 'pending' AND scheduled_at IS NOT NULL;

-- ── Auto-issue a reschedule_token on new appointments ───────────────
CREATE OR REPLACE FUNCTION public.set_appointment_reschedule_token()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.reschedule_token IS NULL THEN
    NEW.reschedule_token := encode(gen_random_bytes(16), 'hex');
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS appointments_reschedule_token_default ON public.appointments;
CREATE TRIGGER appointments_reschedule_token_default
  BEFORE INSERT ON public.appointments
  FOR EACH ROW
  EXECUTE FUNCTION public.set_appointment_reschedule_token();

-- ── Cron: run the reminder sender every 15 minutes ──────────────────
-- Posts to the send-appointment-reminders edge function which handles
-- both the 24h and 2h windows + dedup via the tracking columns above.

SELECT cron.unschedule('appointment_reminder_cadence')
WHERE EXISTS (
  SELECT 1 FROM cron.job WHERE jobname = 'appointment_reminder_cadence'
);

SELECT cron.schedule(
  'appointment_reminder_cadence',
  '*/15 * * * *',
  $$
    SELECT net.http_post(
      url := current_setting('app.supabase_url', true) || '/functions/v1/send-appointment-reminders',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || current_setting('app.supabase_service_role_key', true)
      ),
      body := '{}'::jsonb
    );
  $$
);

NOTIFY pgrst, 'reload schema';
