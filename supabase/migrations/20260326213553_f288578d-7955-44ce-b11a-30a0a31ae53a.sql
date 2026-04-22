
ALTER TABLE public.notification_settings 
  ADD COLUMN IF NOT EXISTS notify_abandoned_lead boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS abandoned_lead_channels text[] NOT NULL DEFAULT '{email,sms}';
