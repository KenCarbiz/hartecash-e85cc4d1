-- Force PostgREST to reload its schema cache. The `rooftop_count` /
-- `tier_ids` / `product_ids` columns were added to dealer_subscriptions
-- back in 20260414030000_platform_pricing_v2.sql, but we saw Billing &
-- Plan autosave failing on hartecash.com with:
--   Could not find the 'rooftop_count' column of 'dealer_subscriptions'
--   in the schema cache
-- That's PostgREST serving stale metadata. Re-assert the columns as
-- IF NOT EXISTS (no-op when already there) and fire every flavour of
-- schema-reload NOTIFY we have.

ALTER TABLE public.dealer_subscriptions
  ADD COLUMN IF NOT EXISTS tier_ids text[] NOT NULL DEFAULT '{}';

ALTER TABLE public.dealer_subscriptions
  ADD COLUMN IF NOT EXISTS rooftop_count integer NOT NULL DEFAULT 1;

ALTER TABLE public.dealer_subscriptions
  ADD COLUMN IF NOT EXISTS product_ids text[] NOT NULL DEFAULT '{}';

-- Belt + suspenders — ensure platform_pricing_model is there too.
ALTER TABLE public.platform_pricing_model
  ADD COLUMN IF NOT EXISTS tier_overrides jsonb NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE public.platform_pricing_model
  ADD COLUMN IF NOT EXISTS bundle_overrides jsonb NOT NULL DEFAULT '{}'::jsonb;

-- PostgREST listens on the `pgrst` channel. Firing both the generic
-- reload and the config-targeted payload covers both Supabase hosted
-- and self-hosted permutations.
NOTIFY pgrst, 'reload schema';
NOTIFY pgrst, 'reload config';
