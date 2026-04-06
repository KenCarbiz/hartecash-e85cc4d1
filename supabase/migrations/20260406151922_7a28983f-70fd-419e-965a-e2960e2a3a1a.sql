ALTER TABLE public.dealership_locations
ADD COLUMN secondary_logo_url text DEFAULT NULL,
ADD COLUMN secondary_logo_dark_url text DEFAULT NULL;