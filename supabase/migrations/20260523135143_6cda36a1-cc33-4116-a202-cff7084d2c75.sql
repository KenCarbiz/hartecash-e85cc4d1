-- Add three-state handoff configuration to site_config.
ALTER TABLE public.site_config
ADD COLUMN IF NOT EXISTS handoff_type text NOT NULL DEFAULT 'both'
CHECK (handoff_type IN ('pickup', 'dropoff', 'both'));

-- Migrate existing data from pickup_offered
UPDATE public.site_config
SET handoff_type = CASE
  WHEN pickup_offered = true THEN 'both'
  WHEN pickup_offered = false THEN 'dropoff'
  ELSE 'both'
END
WHERE handoff_type = 'both'
  AND pickup_offered IS NOT NULL;

-- Add to dealership_locations for per-location override
ALTER TABLE public.dealership_locations
ADD COLUMN IF NOT EXISTS handoff_type text
CHECK (handoff_type IS NULL OR handoff_type IN ('pickup', 'dropoff', 'both'));

NOTIFY pgrst, 'reload schema';