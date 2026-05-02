-- Demo mode — Black Book sandbox kill switch.
--
-- Black Book's sandbox credentials lapsed and a renewal is in
-- flight. While we wait, demo_mode lets the public sell-flow
-- short-circuit the upstream BB call and serve a synthetic
-- vehicle + a flat customer-facing offer ($23,599 default) so
-- prospects, demos, and acceptance-tests can keep running end
-- to end (cadence engine, TCPA consent capture, voice AI, etc).
--
-- Per-tenant on site_config so each dealership can flip
-- independently. Defaults OFF so existing live tenants are
-- unaffected.
--
-- Idempotent — ADD COLUMN IF NOT EXISTS / DEFAULT.

ALTER TABLE public.site_config
  ADD COLUMN IF NOT EXISTS demo_mode boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS demo_offer_amount integer NOT NULL DEFAULT 23599;

COMMENT ON COLUMN public.site_config.demo_mode IS
  'When true, the public sell-flow bypasses Black Book and serves a synthetic vehicle + the demo_offer_amount as the customer-facing offer. Used while BB credentials are renegotiated. Cadence engine still fires normally so end-to-end demos exercise the full pipeline.';

COMMENT ON COLUMN public.site_config.demo_offer_amount IS
  'Flat customer-facing offer amount served when demo_mode = true. Default 23599. Set to whatever value the demo audience expects to see.';

NOTIFY pgrst, 'reload schema';
