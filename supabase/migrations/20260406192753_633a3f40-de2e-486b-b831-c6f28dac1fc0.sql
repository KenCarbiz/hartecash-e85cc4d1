ALTER TABLE public.site_config ADD COLUMN about_image_urls text[] NOT NULL DEFAULT '{}';
ALTER TABLE public.dealership_locations ADD COLUMN about_image_urls text[] NOT NULL DEFAULT '{}';

-- Migrate existing single images into the new array column
UPDATE public.site_config SET about_image_urls = ARRAY[about_image_url] WHERE about_image_url IS NOT NULL AND about_image_url != '';
UPDATE public.dealership_locations SET about_image_urls = ARRAY[about_image_url] WHERE about_image_url IS NOT NULL AND about_image_url != '';