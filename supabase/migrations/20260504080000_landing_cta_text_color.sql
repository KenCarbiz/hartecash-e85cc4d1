-- Optional dealer override for the landing CTA button TEXT color.
-- Pairs with the existing landing_cta_color (button background) so
-- the dealer can pick both colors when the default near-black copy
-- doesn't read against their chosen background.
--
-- Idempotent + safe to re-run.

ALTER TABLE public.site_config
  ADD COLUMN IF NOT EXISTS landing_cta_text_color text;

COMMENT ON COLUMN public.site_config.landing_cta_text_color IS
  'Optional dealer override for the landing CTA button text color (hex). NULL = component default (#0A0A0A near-black).';

NOTIFY pgrst, 'reload schema';
