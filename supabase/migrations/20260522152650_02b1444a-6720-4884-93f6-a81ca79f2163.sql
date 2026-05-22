ALTER TABLE public.site_config
  DROP CONSTRAINT IF EXISTS site_config_landing_template_check;

ALTER TABLE public.site_config
  ADD CONSTRAINT site_config_landing_template_check
  CHECK (
    landing_template IS NULL
    OR landing_template IN (
      'classic','bold','minimal','elegant','showroom',
      'cinema','portal','carousel','slab','diagonal',
      'pickup','magazine','circular','motion','mosaic',
      'clarity','marquee','velocity','heritage',
      'moto','moto_detailed',
      'legacy'
    )
  );

ALTER TABLE public.dealership_locations
  DROP CONSTRAINT IF EXISTS dealership_locations_landing_template_check;

ALTER TABLE public.dealership_locations
  ADD CONSTRAINT dealership_locations_landing_template_check
  CHECK (
    landing_template IS NULL
    OR landing_template IN (
      'classic','bold','minimal','elegant','showroom',
      'cinema','portal','carousel','slab','diagonal',
      'pickup','magazine','circular','motion','mosaic',
      'clarity','marquee','velocity','heritage',
      'moto','moto_detailed',
      'legacy'
    )
  );

NOTIFY pgrst, 'reload schema';