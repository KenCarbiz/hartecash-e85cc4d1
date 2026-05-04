ALTER TABLE public.site_config
  ADD COLUMN IF NOT EXISTS value_props jsonb;

COMMENT ON COLUMN public.site_config.value_props IS
  'Array of up to 6 value-prop cards shown in the "Why Sell to X?" section. Shape: [{title, body, icon, highlight}]. NULL or empty array falls back to the component default.';

NOTIFY pgrst, 'reload schema';
NOTIFY pgrst, 'reload config';