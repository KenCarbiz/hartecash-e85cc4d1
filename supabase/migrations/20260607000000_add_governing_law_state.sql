-- Per-tenant governing-law state for the customer agreements.
--
-- TermsOfService and OfferDisclosure already read
-- site_config.governing_law_state, but the column never existed, so the
-- pages silently fell back to "Connecticut" for EVERY tenant — an
-- unenforceable forum clause for any non-CT dealer. This adds the column
-- and the onboarding cascade writes to it.
--
-- Idempotent (IF NOT EXISTS) per CLAUDE.md authoring rule. Default keeps
-- the historical Connecticut behavior for existing rows; non-CT dealers
-- set their state in onboarding / Site Configuration.

ALTER TABLE public.site_config
  ADD COLUMN IF NOT EXISTS governing_law_state text NOT NULL DEFAULT 'Connecticut';

NOTIFY pgrst, 'reload schema';
