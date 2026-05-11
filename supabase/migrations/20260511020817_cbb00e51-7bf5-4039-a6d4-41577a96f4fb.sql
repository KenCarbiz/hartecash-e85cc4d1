
ALTER TABLE public.submissions ADD COLUMN IF NOT EXISTS plate_state TEXT;
ALTER TABLE public.dealer_accounts ADD COLUMN IF NOT EXISTS voice_ai_call_start TIME;
ALTER TABLE public.dealer_accounts ADD COLUMN IF NOT EXISTS voice_ai_call_end TIME;
ALTER TABLE public.site_config ADD COLUMN IF NOT EXISTS contact_phone TEXT;
NOTIFY pgrst, 'reload schema';
