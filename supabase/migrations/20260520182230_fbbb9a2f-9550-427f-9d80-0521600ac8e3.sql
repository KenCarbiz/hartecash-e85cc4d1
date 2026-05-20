ALTER TABLE public.site_config
  ADD COLUMN IF NOT EXISTS tracker_vehicle_mode  text NOT NULL DEFAULT 'oem',
  ADD COLUMN IF NOT EXISTS tracker_vehicle_year  integer,
  ADD COLUMN IF NOT EXISTS tracker_vehicle_make  text,
  ADD COLUMN IF NOT EXISTS tracker_vehicle_model text,
  ADD COLUMN IF NOT EXISTS tracker_vehicle_style text;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'site_config_tracker_vehicle_mode_chk'
  ) THEN
    ALTER TABLE public.site_config
      ADD CONSTRAINT site_config_tracker_vehicle_mode_chk
      CHECK (tracker_vehicle_mode IN ('oem','popular','custom'));
  END IF;
END $$;

NOTIFY pgrst, 'reload schema';