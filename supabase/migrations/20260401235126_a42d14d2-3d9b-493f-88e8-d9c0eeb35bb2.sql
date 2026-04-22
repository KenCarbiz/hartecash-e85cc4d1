
ALTER TABLE public.pricing_models
ADD COLUMN condition_equipment_map jsonb NOT NULL DEFAULT '{"excellent": true, "very_good": true, "good": true, "fair": true}'::jsonb;

ALTER TABLE public.offer_settings
ADD COLUMN condition_equipment_map jsonb NOT NULL DEFAULT '{"excellent": true, "very_good": true, "good": true, "fair": true}'::jsonb;
