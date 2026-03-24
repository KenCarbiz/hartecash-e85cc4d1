ALTER TABLE public.notification_settings
  ADD COLUMN IF NOT EXISTS notify_customer_offer_increased boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS customer_offer_increased_channels text[] NOT NULL DEFAULT '{email}'::text[];