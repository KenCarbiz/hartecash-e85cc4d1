ALTER TABLE submissions
  ADD COLUMN IF NOT EXISTS bb_market_days_supply numeric;

COMMENT ON COLUMN submissions.bb_market_days_supply IS
  'Cached Black Book / live-retail market days supply at time of appraisal. Refreshed by AppraisalTool when retail stats load. Null when the appraisal has not run or the stats lookup failed.';

NOTIFY pgrst, 'reload schema';

ALTER TABLE tenants
  ADD COLUMN IF NOT EXISTS subdomain_label text,
  ADD COLUMN IF NOT EXISTS parent_domain text;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'tenants_subdomain_label_check'
  ) THEN
    ALTER TABLE tenants
      ADD CONSTRAINT tenants_subdomain_label_check
      CHECK (subdomain_label IS NULL OR subdomain_label ~ '^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$');
  END IF;
END$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'tenants_parent_domain_label_unique'
  ) THEN
    ALTER TABLE tenants
      ADD CONSTRAINT tenants_parent_domain_label_unique
      UNIQUE (parent_domain, subdomain_label);
  END IF;
END$$;

CREATE INDEX IF NOT EXISTS tenants_parent_domain_subdomain_idx
  ON tenants (parent_domain, subdomain_label)
  WHERE parent_domain IS NOT NULL AND subdomain_label IS NOT NULL;

COMMENT ON COLUMN tenants.subdomain_label IS
  'DNS-safe first segment (e.g. "toyota") for sister-store subdomain routing under parent_domain. Null when this tenant does not participate in subdomain routing.';
COMMENT ON COLUMN tenants.parent_domain IS
  'Dealer-group host (e.g. "smithauto.com") this tenant lives beneath. Combined with subdomain_label to resolve <label>.<parent_domain> requests.';

NOTIFY pgrst, 'reload schema';