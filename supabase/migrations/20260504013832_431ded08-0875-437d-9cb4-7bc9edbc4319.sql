-- Landing template heal + four 2026 prestige templates (idempotent)

ALTER TABLE public.site_config
  ADD COLUMN IF NOT EXISTS landing_template text NOT NULL DEFAULT 'classic';

ALTER TABLE public.site_config
  DROP CONSTRAINT IF EXISTS site_config_landing_template_check;

ALTER TABLE public.site_config
  ADD CONSTRAINT site_config_landing_template_check
  CHECK (landing_template IN (
    'classic','bold','minimal','elegant','showroom',
    'cinema','portal','carousel','slab','diagonal',
    'pickup','magazine','circular','motion','mosaic',
    'clarity','marquee','velocity','heritage'
  ));

UPDATE public.site_config
SET landing_template = CASE landing_template
  WHEN 'video'     THEN 'bold'
  WHEN 'inventory' THEN 'minimal'
  WHEN 'trust'     THEN 'elegant'
  WHEN 'editorial' THEN 'showroom'
  ELSE landing_template
END
WHERE landing_template IN ('video','inventory','trust','editorial');

ALTER TABLE public.dealership_locations
  ADD COLUMN IF NOT EXISTS landing_template text;

ALTER TABLE public.dealership_locations
  DROP CONSTRAINT IF EXISTS dealership_locations_landing_template_check;

ALTER TABLE public.dealership_locations
  ADD CONSTRAINT dealership_locations_landing_template_check
  CHECK (landing_template IS NULL OR landing_template IN (
    'classic','bold','minimal','elegant','showroom',
    'cinema','portal','carousel','slab','diagonal',
    'pickup','magazine','circular','motion','mosaic',
    'clarity','marquee','velocity','heritage'
  ));

UPDATE public.dealership_locations
SET landing_template = CASE landing_template
  WHEN 'video'     THEN 'bold'
  WHEN 'inventory' THEN 'minimal'
  WHEN 'trust'     THEN 'elegant'
  WHEN 'editorial' THEN 'showroom'
  ELSE landing_template
END
WHERE landing_template IN ('video','inventory','trust','editorial');

ALTER TABLE public.offer_settings
  ADD COLUMN IF NOT EXISTS pricing_reveal_mode text NOT NULL DEFAULT 'price_first',
  ADD COLUMN IF NOT EXISTS show_range_before_final boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS range_low_source text NOT NULL DEFAULT 'wholesale_avg',
  ADD COLUMN IF NOT EXISTS range_high_mode text NOT NULL DEFAULT 'percent_above_low',
  ADD COLUMN IF NOT EXISTS range_high_source text,
  ADD COLUMN IF NOT EXISTS range_high_percent numeric(5,2) DEFAULT 8.0,
  ADD COLUMN IF NOT EXISTS payment_selection_timing text NOT NULL DEFAULT 'with_final_offer';

ALTER TABLE public.offer_settings
  DROP CONSTRAINT IF EXISTS offer_settings_pricing_reveal_mode_check;
ALTER TABLE public.offer_settings
  ADD CONSTRAINT offer_settings_pricing_reveal_mode_check
  CHECK (pricing_reveal_mode IN ('price_first','range_then_price','contact_first'));

ALTER TABLE public.offer_settings
  DROP CONSTRAINT IF EXISTS offer_settings_range_high_mode_check;
ALTER TABLE public.offer_settings
  ADD CONSTRAINT offer_settings_range_high_mode_check
  CHECK (range_high_mode IN ('bb_value','percent_above_low'));

ALTER TABLE public.offer_settings
  DROP CONSTRAINT IF EXISTS offer_settings_range_low_source_check;
ALTER TABLE public.offer_settings
  ADD CONSTRAINT offer_settings_range_low_source_check
  CHECK (range_low_source IN (
    'wholesale_xclean','wholesale_clean','wholesale_avg','wholesale_rough',
    'tradein_clean','tradein_avg','tradein_rough',
    'retail_xclean','retail_clean','retail_avg','retail_rough'
  ));

ALTER TABLE public.offer_settings
  DROP CONSTRAINT IF EXISTS offer_settings_range_high_source_check;
ALTER TABLE public.offer_settings
  ADD CONSTRAINT offer_settings_range_high_source_check
  CHECK (range_high_source IS NULL OR range_high_source IN (
    'wholesale_xclean','wholesale_clean','wholesale_avg','wholesale_rough',
    'tradein_clean','tradein_avg','tradein_rough',
    'retail_xclean','retail_clean','retail_avg','retail_rough'
  ));

ALTER TABLE public.offer_settings
  DROP CONSTRAINT IF EXISTS offer_settings_payment_selection_timing_check;
ALTER TABLE public.offer_settings
  ADD CONSTRAINT offer_settings_payment_selection_timing_check
  CHECK (payment_selection_timing IN ('before_final_offer','with_final_offer','none_before_final_offer'));

NOTIFY pgrst, 'reload schema';