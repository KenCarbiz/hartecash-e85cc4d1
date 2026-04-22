-- Add condition_basis_map to pricing_models
ALTER TABLE public.pricing_models
ADD COLUMN condition_basis_map jsonb NOT NULL DEFAULT '{
  "excellent": "retail_xclean",
  "very_good": "tradein_clean",
  "good": "tradein_avg",
  "fair": "wholesale_rough"
}'::jsonb;

-- Add condition_basis_map to offer_settings
ALTER TABLE public.offer_settings
ADD COLUMN condition_basis_map jsonb NOT NULL DEFAULT '{
  "excellent": "retail_xclean",
  "very_good": "tradein_clean",
  "good": "tradein_avg",
  "fair": "wholesale_rough"
}'::jsonb;