ALTER TABLE public.dealership_locations 
  ADD COLUMN center_zip text DEFAULT '',
  ADD COLUMN coverage_radius_miles integer DEFAULT 0;