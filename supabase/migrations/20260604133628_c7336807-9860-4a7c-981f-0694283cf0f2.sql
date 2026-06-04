ALTER TABLE public.vehicle_image_cache
  ADD COLUMN IF NOT EXISTS image_source text;

NOTIFY pgrst, 'reload schema';
