-- Add the dealer-controlled "free at-home pickup" toggle. When false,
-- the customer-facing landing page swaps the HowItWorks step 3 copy
-- and the default competitor-comparison wedge row to in-person
-- drop-off messaging. Defaults to true to preserve historical
-- hartecash.com behavior.
--
-- Idempotent + safe to re-run.

ALTER TABLE public.site_config
  ADD COLUMN IF NOT EXISTS pickup_offered boolean NOT NULL DEFAULT true;

COMMENT ON COLUMN public.site_config.pickup_offered IS
  'Whether this dealer offers free at-home pickup of the customer''s car. Drives landing-page HowItWorks step 3 + the default Why-X-Wins wedge row. False switches the copy to in-person drop-off.';

-- Reload the PostgREST schema cache so the new column shows up in
-- the admin without needing a Supabase restart.
NOTIFY pgrst, 'reload schema';
