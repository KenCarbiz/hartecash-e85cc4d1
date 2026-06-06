ALTER TABLE public.form_config
  ADD COLUMN IF NOT EXISTS widget_customer_signin boolean NOT NULL DEFAULT false;

NOTIFY pgrst, 'reload schema';
