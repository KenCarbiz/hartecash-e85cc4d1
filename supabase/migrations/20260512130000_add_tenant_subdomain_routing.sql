-- Dealer-group parent domain + sister-store subdomain routing.
--
-- When a dealer group registers a single domain (smithauto.com), each
-- sister store can be reached at <label>.<parent_domain> — e.g.
-- toyota.smithauto.com, honda.smithauto.com — without the admin
-- having to map a separate custom_domain per rooftop.
--
-- subdomain_label is the DNS-safe first segment (e.g. "toyota").
-- parent_domain is the dealer-group host the subdomain lives under,
-- mirrored here so the routing path doesn't need a join.
--
-- Unique constraint scopes the subdomain to its parent: toyota.smithauto.com
-- and toyota.jonesauto.com coexist because parent_domain differs.
--
-- Idempotent per CLAUDE.md — safe to re-run, safe to apply out of order.

ALTER TABLE tenants
  ADD COLUMN IF NOT EXISTS subdomain_label text,
  ADD COLUMN IF NOT EXISTS parent_domain text;

-- Normalize to lowercase before storing; the routing path lowercases the
-- request hostname before lookup so the comparison is case-insensitive.
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

-- Lookup index for the routing hot-path. Query shape:
--   SELECT ... FROM tenants WHERE parent_domain = $1 AND subdomain_label = $2
CREATE INDEX IF NOT EXISTS tenants_parent_domain_subdomain_idx
  ON tenants (parent_domain, subdomain_label)
  WHERE parent_domain IS NOT NULL AND subdomain_label IS NOT NULL;

COMMENT ON COLUMN tenants.subdomain_label IS
  'DNS-safe first segment (e.g. "toyota") for sister-store subdomain routing under parent_domain. Null when this tenant does not participate in subdomain routing.';
COMMENT ON COLUMN tenants.parent_domain IS
  'Dealer-group host (e.g. "smithauto.com") this tenant lives beneath. Combined with subdomain_label to resolve <label>.<parent_domain> requests.';

NOTIFY pgrst, 'reload schema';
