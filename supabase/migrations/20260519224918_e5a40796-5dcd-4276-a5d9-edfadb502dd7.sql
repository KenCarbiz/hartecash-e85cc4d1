
ALTER TABLE public.form_config
ADD COLUMN IF NOT EXISTS require_phone_verification boolean NOT NULL DEFAULT true;

NOTIFY pgrst, 'reload schema';
