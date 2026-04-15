-- Heal any environment where the earlier pricing-model migrations
-- didn't land cleanly (saw this locally: the realtime migration was
-- failing and blocking the batch, so the table / policies / seed row
-- may all be missing even after the batch appears to apply).
--
-- Every statement here is idempotent — safe to re-run.

-- 1. Table — create if missing, no-op if already there.
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

-- 2. RLS — enable and (re)install the permissive policies. Drop-then-
-- create avoids "policy already exists" errors.
ALTER TABLE public.platform_pricing_model ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can read pricing model" ON public.platform_pricing_model;
DROP POLICY IF EXISTS "Anyone can update pricing model" ON public.platform_pricing_model;

CREATE POLICY "Anyone can read pricing model"
  ON public.platform_pricing_model
  FOR SELECT USING (true);

CREATE POLICY "Anyone can write pricing model"
  ON public.platform_pricing_model
  FOR ALL USING (true) WITH CHECK (true);

-- 3. Ensure the singleton row exists so upserts never hit a
-- constraint-violation race on first write.
INSERT INTO public.platform_pricing_model (id, annual_discount_pct)
VALUES ('global', 15)
ON CONFLICT (id) DO NOTHING;

-- 4. Realtime — wrapped so a broken publication can't block the batch.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    IF NOT EXISTS (
      SELECT 1 FROM pg_publication_tables
       WHERE pubname = 'supabase_realtime'
         AND schemaname = 'public'
         AND tablename = 'platform_pricing_model'
    ) THEN
      BEGIN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.platform_pricing_model;
      EXCEPTION WHEN OTHERS THEN
        RAISE NOTICE 'realtime add failed (non-fatal): %', SQLERRM;
      END;
    END IF;
  END IF;
END $$;

DO $$
BEGIN
  ALTER TABLE public.platform_pricing_model REPLICA IDENTITY FULL;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'replica identity set failed (non-fatal): %', SQLERRM;
END $$;

-- 5. Fix dealer_subscriptions.dealership_id type mismatch. The base
-- platform_multi_product migration declared it as `uuid`, but every
-- other dealership_id column in this codebase (tenants, dealer_accounts,
-- etc.) is `text` with values like 'default'. That mismatch was silently
-- failing onboarding's Billing & Plan auto-save with
--   invalid input syntax for type uuid: "default"
-- Convert to text so the picker's upsert works for every tenant.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_schema = 'public'
       AND table_name = 'dealer_subscriptions'
       AND column_name = 'dealership_id'
       AND data_type = 'uuid'
  ) THEN
    ALTER TABLE public.dealer_subscriptions
      ALTER COLUMN dealership_id TYPE text USING dealership_id::text;
  END IF;
END $$;

-- 6. Ask PostgREST to reload its schema cache so the REST API sees
-- the (possibly just-created) table immediately. Without this, the
-- first client upsert can 404 even though the table is there.
NOTIFY pgrst, 'reload schema';
