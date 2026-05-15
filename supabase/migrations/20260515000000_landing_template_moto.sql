-- Whitelist the new "moto" (Instant Offer) landing template on the
-- site_config and dealership_locations CHECK constraints. Without
-- this, attempting to save the MotoAcquire-style template selection
-- from /admin → Branding → Landing fails with a CHECK violation.
--
-- Pairs with the new src/components/landing/templates/MotoTemplate.tsx
-- frontend component (a thin wrapper that renders the /sell
-- MotoShell flow on the dealer's root /).
--
-- Idempotent and safe to re-run regardless of which prior landing-
-- template migrations have or have not landed.

ALTER TABLE public.site_config
  DROP CONSTRAINT IF EXISTS site_config_landing_template_check;

ALTER TABLE public.site_config
  ADD CONSTRAINT site_config_landing_template_check
  CHECK (landing_template IN (
    'classic','bold','minimal','elegant','showroom',
    'cinema','portal','carousel','slab','diagonal',
    'pickup','magazine','circular','motion','mosaic',
    'clarity','marquee','velocity','heritage',
    'moto',
    'legacy'
  ));

ALTER TABLE public.dealership_locations
  DROP CONSTRAINT IF EXISTS dealership_locations_landing_template_check;

ALTER TABLE public.dealership_locations
  ADD CONSTRAINT dealership_locations_landing_template_check
  CHECK (landing_template IS NULL OR landing_template IN (
    'classic','bold','minimal','elegant','showroom',
    'cinema','portal','carousel','slab','diagonal',
    'pickup','magazine','circular','motion','mosaic',
    'clarity','marquee','velocity','heritage',
    'moto',
    'legacy'
  ));

NOTIFY pgrst, 'reload schema';
