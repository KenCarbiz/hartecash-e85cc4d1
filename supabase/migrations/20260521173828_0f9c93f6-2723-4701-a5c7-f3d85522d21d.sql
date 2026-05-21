ALTER TABLE public.site_config
  ADD COLUMN IF NOT EXISTS customer_journey_template TEXT NOT NULL DEFAULT 'moto',
  ADD COLUMN IF NOT EXISTS moto_detailed_preset TEXT NOT NULL DEFAULT 'moto_detailed',
  ADD COLUMN IF NOT EXISTS moto_detailed_offer_display_mode TEXT NOT NULL DEFAULT 'after_contact_info',
  ADD COLUMN IF NOT EXISTS moto_detailed_custom_config JSONB;

NOTIFY pgrst, 'reload schema';