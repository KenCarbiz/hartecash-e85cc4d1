ALTER TABLE public.dealership_locations 
ADD COLUMN location_type text NOT NULL DEFAULT 'primary';

COMMENT ON COLUMN public.dealership_locations.location_type IS 'Type of location: primary, used_car, buying_center, sister_store';