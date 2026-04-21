-- Add the Internet Manager role.
--
-- Internet Manager sits between BDC and Sales Manager. Typical duties:
--   - Owns the digital lead pipeline (web, text, 3rd-party)
--   - Routes high-intent leads to the right salesperson / BDC rep
--   - Monitors first-response time, contact rate, appointment-set rate
--   - Handles escalations from BDC when a lead needs coordination
--     across multiple sales people (trade + new-car purchase combo)
--
-- Permissions land in the middle tier: they see the full lead pipeline
-- + appointment calendar + per-rep performance for the internet team,
-- but they don't edit pricing / offer model (those stay gsm / gm /
-- admin). Where a store doesn't have an Internet Manager the role is
-- simply unused — BDC reports directly to the sales manager.

ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'internet_manager';

NOTIFY pgrst, 'reload schema';
