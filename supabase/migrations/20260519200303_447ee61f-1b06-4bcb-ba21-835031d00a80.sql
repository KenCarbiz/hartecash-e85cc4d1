ALTER TABLE public.error_log
  ADD COLUMN IF NOT EXISTS page_url text,
  ADD COLUMN IF NOT EXISTS user_agent text;

ALTER TABLE public.dealership_locations
  ADD COLUMN IF NOT EXISTS center_lat double precision,
  ADD COLUMN IF NOT EXISTS center_lng double precision;

NOTIFY pgrst, 'reload schema';
