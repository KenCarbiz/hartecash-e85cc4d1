ALTER TABLE public.site_config
  ADD COLUMN IF NOT EXISTS enable_dl_ocr boolean NOT NULL DEFAULT false;