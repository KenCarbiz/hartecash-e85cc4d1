-- Multi-location branding foundation
--
-- Each tenant (`dealership_id`) can have one tenant-default `site_config` row
-- (with `location_id IS NULL`) plus zero-or-more per-location override rows
-- (one per `dealer_locations.id`). Resolution at read time: try the location
-- row first, fall back to the tenant default, fall back to the system
-- defaults baked into `useSiteConfig`.
--
-- Tenant types (already captured in the onboarding wizard) drive UI
-- affordances elsewhere (location selector visibility, "Apply to all"
-- button, etc.) but no schema change is required here — `tenants.architecture`
-- already holds the type.

-- 1. Add the per-location override key.
ALTER TABLE public.site_config
  ADD COLUMN IF NOT EXISTS location_id text NULL;

-- 2. Replace the unique-on-dealership constraint with a composite one that
--    treats NULL location_id as the tenant default. Postgres treats NULLs as
--    distinct in unique indexes by default, so we coalesce to a sentinel
--    string to enforce one tenant-default row per tenant.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'site_config_dealership_id_key'
      AND conrelid = 'public.site_config'::regclass
  ) THEN
    ALTER TABLE public.site_config DROP CONSTRAINT site_config_dealership_id_key;
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS site_config_tenant_location_unique_idx
  ON public.site_config (dealership_id, COALESCE(location_id, '__tenant__'));

-- 3. Helpful index for the fallback lookup pattern (location row first,
--    tenant default second).
CREATE INDEX IF NOT EXISTS site_config_dealership_id_idx
  ON public.site_config (dealership_id);
