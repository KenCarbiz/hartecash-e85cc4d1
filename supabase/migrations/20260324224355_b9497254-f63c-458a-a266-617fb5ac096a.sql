ALTER TABLE public.notification_settings
ADD COLUMN IF NOT EXISTS staff_trigger_recipients jsonb NOT NULL DEFAULT '{}'::jsonb;