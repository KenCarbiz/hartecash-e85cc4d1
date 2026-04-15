-- Enable Supabase realtime replication on the pricing-model row so
-- admin saves propagate live to every open pricing picker
-- (DealerOnboarding, PricingPlanPicker in Billing & Plan).
--
-- Wrapped in DO blocks so every step is idempotent and survives
-- environments where (a) the `supabase_realtime` publication doesn't
-- exist yet, or (b) the table has already been added to it by an
-- earlier attempt. A blind `ALTER PUBLICATION … ADD TABLE` would
-- crash the whole migration batch in either case and block all
-- subsequent saves — we saw this in the hartecash environment.

DO $$
BEGIN
  -- Only touch the publication if it exists.
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    -- Skip if the table is already a member.
    IF NOT EXISTS (
      SELECT 1 FROM pg_publication_tables
       WHERE pubname = 'supabase_realtime'
         AND schemaname = 'public'
         AND tablename = 'platform_pricing_model'
    ) THEN
      BEGIN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.platform_pricing_model;
      EXCEPTION WHEN OTHERS THEN
        -- Never fail the migration on realtime setup — the app
        -- degrades gracefully (picker refetches on mount instead of
        -- receiving push updates).
        RAISE NOTICE 'Could not add platform_pricing_model to supabase_realtime: %', SQLERRM;
      END;
    END IF;
  END IF;
END $$;

-- REPLICA IDENTITY FULL ships the complete row on UPDATE so the
-- client can apply `.new` directly. Safe to run multiple times.
DO $$
BEGIN
  ALTER TABLE public.platform_pricing_model REPLICA IDENTITY FULL;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Could not set REPLICA IDENTITY FULL: %', SQLERRM;
END $$;
