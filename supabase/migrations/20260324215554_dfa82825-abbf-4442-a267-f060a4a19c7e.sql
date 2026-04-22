ALTER TABLE public.notification_settings
  ADD COLUMN IF NOT EXISTS notify_customer_offer_accepted boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS customer_offer_accepted_channels text[] NOT NULL DEFAULT '{email,sms}'::text[],
  ADD COLUMN IF NOT EXISTS notify_customer_appointment_booked boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS customer_appointment_channels text[] NOT NULL DEFAULT '{email,sms}'::text[];