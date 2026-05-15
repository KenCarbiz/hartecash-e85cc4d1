-- Idempotent: extend landing_template check constraints to whitelist 'moto'
-- Safe to re-run. Drops by name and recreates.

-- site_config table
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
      'moto',
      'legacy'
    )
  );

-- dealership_locations table
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
      'moto',
      'legacy'
    )
  );

NOTIFY pgrst, 'reload schema';