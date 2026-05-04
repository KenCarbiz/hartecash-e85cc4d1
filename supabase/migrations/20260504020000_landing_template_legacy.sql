-- Add the "legacy" landing template (the pre-audit Hartecash long-scroll
-- look) to the allowed CHECK vocabulary on site_config and
-- dealership_locations. Idempotent and safe to re-run regardless of
-- which prior landing-template migrations have or have not landed.
--
-- Pairs with the new src/components/landing/templates/LegacyTemplate.tsx
-- frontend component (Hero + LandingForm + every marketing section
-- visible inline, no LearnMore accordion).

ALTER TABLE public.site_config
  DROP CONSTRAINT IF EXISTS site_config_landing_template_check;

ALTER TABLE public.site_config
  ADD CONSTRAINT site_config_landing_template_check
  CHECK (landing_template IN (
    'classic','bold','minimal','elegant','showroom',
    'cinema','portal','carousel','slab','diagonal',
    'pickup','magazine','circular','motion','mosaic',
    'clarity','marquee','velocity','heritage',
    'legacy'
  ));

ALTER TABLE public.dealership_locations
  DROP CONSTRAINT IF EXISTS dealership_locations_landing_template_check;

ALTER TABLE public.dealership_locations
  ADD CONSTRAINT dealership_locations_landing_template_check
  CHECK (landing_template IS NULL OR landing_template IN (
    'classic','bold','minimal','elegant','showroom',
    'cinema','portal','carousel','slab','diagonal',
    'pickup','magazine','circular','motion','mosaic',
    'clarity','marquee','velocity','heritage',
    'legacy'
  ));

NOTIFY pgrst, 'reload schema';
