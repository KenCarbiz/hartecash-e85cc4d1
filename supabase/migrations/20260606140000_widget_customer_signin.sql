-- Trade widget: optional customer sign-in ("get back to your offer later").
--
-- Dealers who want returning customers to be able to re-open their offer
-- toggle this on in Admin · Trade Widget. When enabled, the embeddable
-- slide-out shows a "Sign In" entry that routes the customer to the
-- existing /my-submission lookup → customer portal.
--
-- Persisted as a boolean column on form_config (same row the rest of the
-- widget's dealer toggles read from). Idempotent + schema reload per the
-- repo migration rules so it's safe to re-run / apply out of order.

ALTER TABLE public.form_config
  ADD COLUMN IF NOT EXISTS widget_customer_signin boolean NOT NULL DEFAULT false;

NOTIFY pgrst, 'reload schema';
