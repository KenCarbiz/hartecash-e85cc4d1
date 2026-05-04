-- Optional dealer override for the landing CTA button color. Hex
-- string, e.g. "#FACC15". When NULL the LandingPlateInput uses the
-- saturated SaaS-default yellow (Tailwind yellow-400).
--
-- Idempotent + safe to re-run.

ALTER TABLE public.site_config
  ADD COLUMN IF NOT EXISTS landing_cta_color text;

COMMENT ON COLUMN public.site_config.landing_cta_color IS
  'Optional dealer override for the landing CTA button color (hex). NULL = component default (#FACC15).';

NOTIFY pgrst, 'reload schema';
