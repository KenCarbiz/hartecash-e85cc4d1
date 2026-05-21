DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'site_config' AND column_name = 'landing_form_density'
  ) THEN
    ALTER TABLE public.site_config DROP CONSTRAINT IF EXISTS site_config_landing_form_density_check;
    ALTER TABLE public.site_config
      ADD CONSTRAINT site_config_landing_form_density_check
      CHECK (landing_form_density IN ('simple','standard','detailed','dealer_configured'));
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'dealership_locations' AND column_name = 'landing_form_density'
  ) THEN
    ALTER TABLE public.dealership_locations DROP CONSTRAINT IF EXISTS dealership_locations_landing_form_density_check;
    ALTER TABLE public.dealership_locations
      ADD CONSTRAINT dealership_locations_landing_form_density_check
      CHECK (landing_form_density IS NULL OR landing_form_density IN ('simple','standard','detailed','dealer_configured'));
  END IF;
END $$;

NOTIFY pgrst, 'reload schema';