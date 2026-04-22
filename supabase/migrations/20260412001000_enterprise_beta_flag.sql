-- Enterprise Beta Feature Flag
--
-- Hides four enterprise-tier admin panels from the dealer sidebar
-- unless the dealer has explicitly been enrolled in the Enterprise
-- Beta program:
--   - API Access Panel
--   - vAuto Push Integration
--   - White Label Settings
--   - Wholesale Marketplace
--
-- Before this flag existed, these four panels appeared in every
-- admin sidebar with "In Development" banners that undermined the
-- premium positioning. With the flag off (default), the entire
-- Enterprise sidebar group is suppressed for that dealer. With the
-- flag on, the panels render with premium Beta Enablement copy
-- instead of amber warning banners.
--
-- Flipping this flag for a specific dealer is a Super Admin action
-- via Tenants management — not a self-service toggle, because the
-- features behind it genuinely need Success Manager enablement.

ALTER TABLE public.site_config
  ADD COLUMN IF NOT EXISTS enterprise_beta_enabled boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.site_config.enterprise_beta_enabled IS
  'When true, exposes the Enterprise sidebar group (API Access, vAuto, White Label, Wholesale Marketplace) to this dealership. Default false so these enterprise-tier features do not appear in every dealer sidebar with "In Development" badges that undermine premium positioning. Flipped on per-dealer via Super Admin Tenants management as part of Success Manager enablement.';
