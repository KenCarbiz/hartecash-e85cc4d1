ALTER TABLE public.offer_settings
  ADD COLUMN IF NOT EXISTS pack_warranty numeric NOT NULL DEFAULT 0;

NOTIFY pgrst, 'reload schema';