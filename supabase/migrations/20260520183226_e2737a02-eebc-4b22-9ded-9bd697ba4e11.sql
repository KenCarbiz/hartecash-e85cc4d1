ALTER TABLE public.site_config
  ADD COLUMN IF NOT EXISTS tracker_vehicle_specs text;

NOTIFY pgrst, 'reload schema';