ALTER TABLE public.dealership_locations 
  ADD COLUMN all_brands boolean NOT NULL DEFAULT true,
  ADD COLUMN excluded_oem_brands text[] NOT NULL DEFAULT '{}'::text[];