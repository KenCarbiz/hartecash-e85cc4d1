ALTER TABLE public.site_config
  ADD COLUMN IF NOT EXISTS tracker_vehicle_image_url text,
  ADD COLUMN IF NOT EXISTS tracker_vehicle_label text,
  ADD COLUMN IF NOT EXISTS tracker_vehicle_options jsonb NOT NULL DEFAULT '{}'::jsonb;

NOTIFY pgrst, 'reload schema';