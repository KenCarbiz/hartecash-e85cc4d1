-- Mobile inspection (Carvana-style "inspector comes to you").
--
-- Default OFF — most dealers don't run a mobile inspector. The dealer
-- admin opts in via Setup · Branding so the option only surfaces on
-- the customer's scheduling screen for tenants that actually run one.
--
-- inspection_mode + inspection_address live on the appointment row so
-- the receiving inspector knows where to drive. Existing 'in_store'
-- (default) keeps the legacy behavior — customer drives in.

ALTER TABLE public.site_config
  ADD COLUMN IF NOT EXISTS offers_mobile_inspection boolean NOT NULL DEFAULT false;

ALTER TABLE public.appointments
  ADD COLUMN IF NOT EXISTS inspection_mode text NOT NULL DEFAULT 'in_store',
  ADD COLUMN IF NOT EXISTS inspection_address text;

-- Sanity: only the two values we accept today. CHECK is idempotent
-- via DROP-then-ADD so a re-run stays clean if we widen it later.
ALTER TABLE public.appointments
  DROP CONSTRAINT IF EXISTS appointments_inspection_mode_check;
ALTER TABLE public.appointments
  ADD CONSTRAINT appointments_inspection_mode_check
  CHECK (inspection_mode IN ('in_store', 'mobile'));

NOTIFY pgrst, 'reload schema';
