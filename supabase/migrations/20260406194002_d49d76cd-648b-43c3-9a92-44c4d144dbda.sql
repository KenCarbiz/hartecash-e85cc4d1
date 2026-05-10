
ALTER TABLE public.site_config ADD COLUMN IF NOT EXISTS established_year integer;
ALTER TABLE public.dealership_locations ADD COLUMN IF NOT EXISTS established_year integer;
ALTER TABLE public.dealership_locations ADD COLUMN IF NOT EXISTS use_corporate_established_year boolean NOT NULL DEFAULT true;
