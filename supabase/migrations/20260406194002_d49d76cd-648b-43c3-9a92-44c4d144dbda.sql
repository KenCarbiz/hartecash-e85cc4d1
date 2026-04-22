
ALTER TABLE public.site_config ADD COLUMN established_year integer;
ALTER TABLE public.dealership_locations ADD COLUMN established_year integer;
ALTER TABLE public.dealership_locations ADD COLUMN use_corporate_established_year boolean NOT NULL DEFAULT true;
