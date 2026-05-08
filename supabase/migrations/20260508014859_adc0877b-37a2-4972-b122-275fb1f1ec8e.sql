ALTER TABLE public.notification_log
  ADD COLUMN IF NOT EXISTS provider_message_id text,
  ADD COLUMN IF NOT EXISTS delivered_at timestamptz;

CREATE INDEX IF NOT EXISTS notification_log_provider_message_idx
  ON public.notification_log (provider_message_id)
  WHERE provider_message_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS submissions_dealer_phone_idx
  ON public.submissions (dealership_id, phone)
  WHERE phone IS NOT NULL;

NOTIFY pgrst, 'reload schema';