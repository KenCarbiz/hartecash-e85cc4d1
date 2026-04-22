ALTER TABLE public.site_config
  ADD COLUMN IF NOT EXISTS business_hours jsonb DEFAULT '[{"days":"Mon–Fri","hours":"9 AM – 7 PM"},{"days":"Sat","hours":"9 AM – 6 PM"},{"days":"Sun","hours":"Closed"}]'::jsonb,
  ADD COLUMN IF NOT EXISTS facebook_url text DEFAULT '',
  ADD COLUMN IF NOT EXISTS instagram_url text DEFAULT '',
  ADD COLUMN IF NOT EXISTS google_review_url text DEFAULT '',
  ADD COLUMN IF NOT EXISTS tiktok_url text DEFAULT '',
  ADD COLUMN IF NOT EXISTS youtube_url text DEFAULT '';