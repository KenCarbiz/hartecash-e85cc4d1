-- Powered-by attribution: three-way tenant toggle + super-admin force override
--
-- Previously the "Powered by" credit in SiteFooter was a single boolean
-- (site_config.white_label_settings.hide_branding) that only controlled
-- whether the credit was shown at all. This migration adds:
--
-- 1. A three-way dealer-controlled mode inside white_label_settings:
--      'autocurb' — show "Powered by Autocurb.ai" (default)
--      'dealer'   — show "Powered by {dealership_name}"
--      'hidden'   — show nothing
--    Dealers change this via the existing WhiteLabelSettings page.
--
-- 2. A platform-level force override on site_config that the Super Admin
--    uses via TenantManagement to enforce Autocurb attribution regardless
--    of the dealer's own setting. Critical for contract enforcement —
--    dealers on the Standard tier don't get to hide attribution.
--
-- The old hide_branding boolean is preserved for backward compatibility.
-- Read path: if force_autocurb_attribution is true, always show Autocurb.
-- Otherwise use white_label_settings.powered_by_mode, falling back to
-- hide_branding for pre-migration records.

ALTER TABLE public.site_config
  ADD COLUMN IF NOT EXISTS force_autocurb_attribution boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.site_config.force_autocurb_attribution IS
  'Super-admin controlled. When true, the "Powered by Autocurb.ai" credit is always rendered on the customer-facing site footer regardless of the dealer''s white_label_settings.powered_by_mode. Used to enforce attribution for dealers on tiers that do not include white-label rights. Dealers cannot edit this field themselves; only platform admins can toggle it via Tenants management.';
