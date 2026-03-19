ALTER TABLE public.submissions
  ADD COLUMN IF NOT EXISTS bb_tradein_avg numeric DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS bb_wholesale_avg numeric DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS estimated_offer_low numeric DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS estimated_offer_high numeric DEFAULT NULL;