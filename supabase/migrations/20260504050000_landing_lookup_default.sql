-- Dealer-controlled default for which lookup tab opens on the
-- landing-page LandingPlateInput cluster. Some dealer audiences are
-- more VIN-literate (luxury, fleet, out-of-state buyers) while most
-- consumer rooftops still expect plate + state. Default 'plate'.
--
-- Idempotent + safe to re-run.

ALTER TABLE public.site_config
  ADD COLUMN IF NOT EXISTS landing_lookup_default text NOT NULL DEFAULT 'plate';

ALTER TABLE public.site_config
  DROP CONSTRAINT IF EXISTS site_config_landing_lookup_default_check;

ALTER TABLE public.site_config
  ADD CONSTRAINT site_config_landing_lookup_default_check
  CHECK (landing_lookup_default IN ('plate','vin'));

COMMENT ON COLUMN public.site_config.landing_lookup_default IS
  'Which lookup tab opens by default on the landing input cluster. plate = plate + state visible; vin = single VIN field visible. Customer can still toggle to the other.';

NOTIFY pgrst, 'reload schema';
