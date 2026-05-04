-- Dealer-editable "Why Sell to {dealer}?" cards on the public landing.
-- Six configurable cards with title + body + icon + highlight flag,
-- stored as a JSONB array. Replaces the hardcoded 5 cards in
-- src/components/ValueProps.tsx.
--
-- Idempotent + safe to re-run.

ALTER TABLE public.site_config
  ADD COLUMN IF NOT EXISTS value_props jsonb;

COMMENT ON COLUMN public.site_config.value_props IS
  'Array of up to 6 value-prop cards shown in the "Why Sell to X?" section. Shape: [{title, body, icon, highlight}]. NULL or empty array falls back to the component default.';

NOTIFY pgrst, 'reload schema';
