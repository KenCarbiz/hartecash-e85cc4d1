ALTER TABLE public.site_config ADD COLUMN IF NOT EXISTS about_image_url text DEFAULT NULL;
ALTER TABLE public.dealership_locations ADD COLUMN IF NOT EXISTS about_image_url text DEFAULT NULL;