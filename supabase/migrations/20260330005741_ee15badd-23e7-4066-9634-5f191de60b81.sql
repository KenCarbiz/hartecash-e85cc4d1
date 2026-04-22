-- Add dealership_id to dealership_locations for tenant scoping
ALTER TABLE public.dealership_locations 
  ADD COLUMN IF NOT EXISTS dealership_id text NOT NULL DEFAULT 'default';

CREATE INDEX IF NOT EXISTS idx_dealership_locations_dealership_id 
  ON public.dealership_locations(dealership_id);