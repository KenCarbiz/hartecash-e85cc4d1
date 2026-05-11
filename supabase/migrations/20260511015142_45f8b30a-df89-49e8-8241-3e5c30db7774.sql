-- Group C retry
ALTER TABLE public.appointments
  ADD COLUMN IF NOT EXISTS scheduled_at timestamptz,
  ADD COLUMN IF NOT EXISTS confirmed_at timestamptz,
  ADD COLUMN IF NOT EXISTS location text,
  ADD COLUMN IF NOT EXISTS reminder_24h_sent_at timestamptz,
  ADD COLUMN IF NOT EXISTS reminder_2h_sent_at timestamptz,
  ADD COLUMN IF NOT EXISTS reschedule_token text UNIQUE,
  ADD COLUMN IF NOT EXISTS rescheduled_at timestamptz,
  ADD COLUMN IF NOT EXISTS rescheduled_from timestamptz;

-- Backfill scheduled_at from preferred_date + preferred_time when possible
UPDATE public.appointments
SET scheduled_at = (preferred_date::text || ' ' || preferred_time)::timestamptz
WHERE scheduled_at IS NULL
  AND preferred_date IS NOT NULL
  AND preferred_time IS NOT NULL
  AND preferred_time ~ '^[0-9]{1,2}:[0-9]{2}(:[0-9]{2})?$';

UPDATE public.appointments
SET reschedule_token = encode(gen_random_bytes(16), 'hex')
WHERE reschedule_token IS NULL
  AND status = 'pending';

CREATE INDEX IF NOT EXISTS appointments_reschedule_token_idx
  ON public.appointments (reschedule_token)
  WHERE reschedule_token IS NOT NULL;

CREATE INDEX IF NOT EXISTS appointments_reminder_window_idx
  ON public.appointments (scheduled_at)
  WHERE status = 'pending' AND scheduled_at IS NOT NULL;

CREATE OR REPLACE FUNCTION public.set_appointment_reschedule_token()
RETURNS trigger LANGUAGE plpgsql AS $$
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
  FOR EACH ROW EXECUTE FUNCTION public.set_appointment_reschedule_token();

DO $$
BEGIN
  PERFORM cron.unschedule('appointment_reminder_cadence');
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

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

ALTER TABLE public.submissions
  ADD COLUMN IF NOT EXISTS portal_view_count int NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS portal_last_viewed_at timestamptz,
  ADD COLUMN IF NOT EXISTS offer_locked_at timestamptz;

ALTER TABLE public.site_config
  ADD COLUMN IF NOT EXISTS auto_lock_offer_on_re_engagement boolean NOT NULL DEFAULT true;

CREATE OR REPLACE FUNCTION public.increment_portal_view(_token text)
RETURNS TABLE(view_count int, offer_locked_at timestamptz)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _submission_id uuid;
  _dealership_id text;
  _auto_lock boolean;
  _new_count int;
  _now timestamptz := now();
BEGIN
  SELECT id, dealership_id INTO _submission_id, _dealership_id
  FROM public.submissions WHERE token = _token LIMIT 1;
  IF _submission_id IS NULL THEN RETURN; END IF;

  SELECT COALESCE(sc.auto_lock_offer_on_re_engagement, true) INTO _auto_lock
  FROM public.site_config sc WHERE sc.dealership_id = _dealership_id LIMIT 1;

  UPDATE public.submissions s
  SET
    portal_view_count = s.portal_view_count + 1,
    portal_last_viewed_at = _now,
    offer_locked_at = CASE
      WHEN s.offer_locked_at IS NULL
        AND COALESCE(_auto_lock, true) = true
        AND s.portal_view_count + 1 >= 2
      THEN _now
      ELSE s.offer_locked_at
    END
  WHERE s.id = _submission_id
  RETURNING s.portal_view_count, s.offer_locked_at
  INTO _new_count, offer_locked_at;

  view_count := _new_count;
  RETURN NEXT;
END;
$$;

GRANT EXECUTE ON FUNCTION public.increment_portal_view(text) TO anon, authenticated;

ALTER TABLE public.submissions
  ADD COLUMN IF NOT EXISTS inspection_started_notified_at timestamptz,
  ADD COLUMN IF NOT EXISTS inspection_progress_notified_at timestamptz;

NOTIFY pgrst, 'reload schema';