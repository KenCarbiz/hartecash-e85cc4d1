-- Legal entity name + dealer license number for the customer agreements
-- and legal/footer pages. Both are collected in onboarding (Dealership
-- Identity) and cascade into site_config.
--
-- legal_entity_name: the legal/DBA business name used on the Terms of
--   Service contract, distinct from the marketing dealership_name.
-- dealer_license_number: state DMV dealer license #, surfaced where
--   required on legal/footer pages.
--
-- Idempotent (IF NOT EXISTS) per CLAUDE.md authoring rule.

ALTER TABLE public.site_config
  ADD COLUMN IF NOT EXISTS legal_entity_name text NOT NULL DEFAULT '';

ALTER TABLE public.site_config
  ADD COLUMN IF NOT EXISTS dealer_license_number text NOT NULL DEFAULT '';

NOTIFY pgrst, 'reload schema';
