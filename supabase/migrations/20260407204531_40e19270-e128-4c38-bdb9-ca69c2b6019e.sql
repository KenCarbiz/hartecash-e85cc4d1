ALTER TABLE public.offer_settings ADD COLUMN IF NOT EXISTS retail_search_zip text DEFAULT NULL;
ALTER TABLE public.pricing_models ADD COLUMN IF NOT EXISTS retail_search_zip text DEFAULT NULL;