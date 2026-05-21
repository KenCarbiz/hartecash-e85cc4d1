ALTER TABLE public.site_config
  ADD COLUMN IF NOT EXISTS enabled_payout_methods JSONB NOT NULL DEFAULT
    '{"paper_check":true,"ach":false,"eft":false,"instant_debit":false,"wire_transfer":false}'::jsonb;

NOTIFY pgrst, 'reload schema';