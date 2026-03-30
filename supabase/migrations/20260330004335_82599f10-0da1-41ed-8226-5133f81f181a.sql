
-- Add dealership_id to submissions for multi-tenant scoping
ALTER TABLE public.submissions ADD COLUMN IF NOT EXISTS dealership_id text NOT NULL DEFAULT 'default';

-- Index for fast tenant-scoped queries
CREATE INDEX IF NOT EXISTS idx_submissions_dealership_id ON public.submissions(dealership_id);

-- Add dealership_id to appointments
ALTER TABLE public.appointments ADD COLUMN IF NOT EXISTS dealership_id text NOT NULL DEFAULT 'default';
CREATE INDEX IF NOT EXISTS idx_appointments_dealership_id ON public.appointments(dealership_id);

-- Add dealership_id to consent_log
ALTER TABLE public.consent_log ADD COLUMN IF NOT EXISTS dealership_id text NOT NULL DEFAULT 'default';

-- Add dealership_id to notification_log (already has it, skip if exists)
-- Add dealership_id to follow_ups
ALTER TABLE public.follow_ups ADD COLUMN IF NOT EXISTS dealership_id text NOT NULL DEFAULT 'default';

-- Add dealership_id to damage_reports
ALTER TABLE public.damage_reports ADD COLUMN IF NOT EXISTS dealership_id text NOT NULL DEFAULT 'default';
