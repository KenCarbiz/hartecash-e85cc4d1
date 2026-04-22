-- Rename the four non-default landing templates to match their new visual
-- identities. The Classic default (with hero_layout left/center/right) is
-- unchanged. Old names → new names:
--   video     → bold
--   inventory → minimal
--   trust     → elegant
--   editorial → showroom
--
-- Data migration is forward-only and preserves every dealer's prior choice.

-- ─── site_config ───────────────────────────────────────────────────────
ALTER TABLE public.site_config
  DROP CONSTRAINT IF EXISTS site_config_landing_template_check;

UPDATE public.site_config
SET landing_template = CASE landing_template
  WHEN 'video'     THEN 'bold'
  WHEN 'inventory' THEN 'minimal'
  WHEN 'trust'     THEN 'elegant'
  WHEN 'editorial' THEN 'showroom'
  ELSE landing_template
END
WHERE landing_template IN ('video','inventory','trust','editorial');

ALTER TABLE public.site_config
  ADD CONSTRAINT site_config_landing_template_check
  CHECK (landing_template IN ('classic','bold','minimal','elegant','showroom'));

-- ─── dealership_locations (per-rooftop overrides) ─────────────────────
ALTER TABLE public.dealership_locations
  DROP CONSTRAINT IF EXISTS dealership_locations_landing_template_check;

UPDATE public.dealership_locations
SET landing_template = CASE landing_template
  WHEN 'video'     THEN 'bold'
  WHEN 'inventory' THEN 'minimal'
  WHEN 'trust'     THEN 'elegant'
  WHEN 'editorial' THEN 'showroom'
  ELSE landing_template
END
WHERE landing_template IN ('video','inventory','trust','editorial');

ALTER TABLE public.dealership_locations
  ADD CONSTRAINT dealership_locations_landing_template_check
  CHECK (landing_template IS NULL OR landing_template IN ('classic','bold','minimal','elegant','showroom'));
