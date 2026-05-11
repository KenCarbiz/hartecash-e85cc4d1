ALTER TABLE public.site_config
  ADD COLUMN IF NOT EXISTS ai_auto_bump_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS ai_auto_bump_max_pct integer NOT NULL DEFAULT 15,
  ADD COLUMN IF NOT EXISTS ai_auto_bump_max_dollars integer NOT NULL DEFAULT 2000,
  ADD COLUMN IF NOT EXISTS ai_auto_bump_daily_cap integer NOT NULL DEFAULT 10000,
  ADD COLUMN IF NOT EXISTS ai_auto_bump_confidence_floor integer NOT NULL DEFAULT 70;

NOTIFY pgrst, 'reload schema';