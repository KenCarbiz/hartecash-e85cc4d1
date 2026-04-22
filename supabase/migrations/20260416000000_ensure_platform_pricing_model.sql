-- Ensure the platform_pricing_model table exists.
-- This migration is idempotent — safe to run multiple times.

CREATE TABLE IF NOT EXISTS public.platform_pricing_model (
  id text PRIMARY KEY DEFAULT 'global',
  annual_discount_pct numeric NOT NULL DEFAULT 15
    CHECK (annual_discount_pct >= 0 AND annual_discount_pct <= 50),
  tier_overrides jsonb NOT NULL DEFAULT '{}'::jsonb,
  bundle_overrides jsonb NOT NULL DEFAULT '{}'::jsonb,
  multi_location_overrides jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid,
  CONSTRAINT single_row CHECK (id = 'global')
);

-- Seed the singleton row
INSERT INTO public.platform_pricing_model (id)
VALUES ('global')
ON CONFLICT (id) DO NOTHING;

-- Enable RLS
ALTER TABLE public.platform_pricing_model ENABLE ROW LEVEL SECURITY;

-- Drop any stale policies
DROP POLICY IF EXISTS "pricing_model_select" ON public.platform_pricing_model;
DROP POLICY IF EXISTS "pricing_model_insert" ON public.platform_pricing_model;
DROP POLICY IF EXISTS "pricing_model_update" ON public.platform_pricing_model;
DROP POLICY IF EXISTS "Anyone can read pricing model" ON public.platform_pricing_model;
DROP POLICY IF EXISTS "Anyone can update pricing model" ON public.platform_pricing_model;
DROP POLICY IF EXISTS "Anyone can write pricing model" ON public.platform_pricing_model;

-- Permissive policies
CREATE POLICY "pricing_model_select" ON public.platform_pricing_model
  FOR SELECT USING (true);
CREATE POLICY "pricing_model_insert" ON public.platform_pricing_model
  FOR INSERT WITH CHECK (true);
CREATE POLICY "pricing_model_update" ON public.platform_pricing_model
  FOR UPDATE USING (true) WITH CHECK (true);

-- Reload PostgREST schema cache
NOTIFY pgrst, 'reload schema';
NOTIFY pgrst, 'reload config';
