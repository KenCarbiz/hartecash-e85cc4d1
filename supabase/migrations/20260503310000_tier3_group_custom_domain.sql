-- Sprint D — Custom domain per dealer_group.
--
-- Tekion-benchmark feature from the May-2026 industry research:
-- "A 30-rooftop group like Group 1 Automotive should be able to host
-- their dealer-facing pages under group1.com, not under
-- *.autocurb.io". This adds a custom_domain column to dealer_groups
-- that mirrors the existing tenants.custom_domain pattern.
--
-- TenantContext resolution order, after this migration is applied:
--   1. Hostname matches tenants.custom_domain → that tenant
--   2. Hostname matches dealer_groups.custom_domain → the group's
--      first active dealership (or a group-landing if we ever add one)
--   3. Fall back to subdomain / path resolution
--
-- The DNS / SSL cert work happens outside this migration; this is
-- the data-layer slot that the runtime can read.
--
-- IDEMPOTENT — ADD COLUMN IF NOT EXISTS.

ALTER TABLE public.dealer_groups
  ADD COLUMN IF NOT EXISTS custom_domain text;

CREATE UNIQUE INDEX IF NOT EXISTS dealer_groups_custom_domain_uniq
  ON public.dealer_groups (custom_domain)
  WHERE custom_domain IS NOT NULL;

COMMENT ON COLUMN public.dealer_groups.custom_domain IS
  'Optional custom hostname for the group (e.g. autocurb.group1.com). When set, requests to that hostname resolve into the group context — the TenantContext picks the group''s primary rooftop or surfaces a group-landing page. DNS + SSL cert is provisioned out-of-band.';

NOTIFY pgrst, 'reload schema';
