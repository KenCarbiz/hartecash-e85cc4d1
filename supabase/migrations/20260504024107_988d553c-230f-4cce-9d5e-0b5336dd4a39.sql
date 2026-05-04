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

ALTER TABLE public.site_config
  ADD COLUMN IF NOT EXISTS pickup_offered boolean NOT NULL DEFAULT true;

COMMENT ON COLUMN public.site_config.pickup_offered IS
  'Whether this dealer offers free at-home pickup of the customer''s car. Drives landing-page HowItWorks step 3 + the default Why-X-Wins wedge row. False switches the copy to in-person drop-off.';

NOTIFY pgrst, 'reload schema';