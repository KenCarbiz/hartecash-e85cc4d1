ALTER TABLE public.notification_settings
  ADD COLUMN IF NOT EXISTS notify_customer_offer_ready boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS customer_offer_ready_channels text[] NOT NULL DEFAULT '{email}'::text[],
  ADD COLUMN IF NOT EXISTS notify_customer_appointment_reminder boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS customer_appointment_reminder_channels text[] NOT NULL DEFAULT '{email,sms}'::text[],
  ADD COLUMN IF NOT EXISTS notify_customer_appointment_rescheduled boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS customer_appointment_rescheduled_channels text[] NOT NULL DEFAULT '{email,sms}'::text[],
  ADD COLUMN IF NOT EXISTS notify_staff_customer_accepted boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS staff_customer_accepted_channels text[] NOT NULL DEFAULT '{email,sms}'::text[],
  ADD COLUMN IF NOT EXISTS notify_staff_deal_completed boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS staff_deal_completed_channels text[] NOT NULL DEFAULT '{email}'::text[];