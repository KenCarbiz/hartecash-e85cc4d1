-- condition_card_style — dealer toggle for the customer-facing
-- overall-condition picker on SellFlowSimple's Step 2.
--   "basic" (default) — short hint per option
--   "kbb"             — Kelley Blue Book–style description on each
--                       card + a "View full KBB definitions" dialog
--                       (the original Hartecash treatment).
-- Idempotent per CLAUDE.md: safe to re-run, safe to merge across
-- branches, safe to apply out of order with hot-fixes.

ALTER TABLE site_config
  ADD COLUMN IF NOT EXISTS condition_card_style TEXT
    NOT NULL DEFAULT 'basic';

-- Constrain to the two valid values. Drop+recreate so the constraint
-- stays consistent if a previous run installed it with a different
-- definition (e.g. an admin tightened the spec).
ALTER TABLE site_config
  DROP CONSTRAINT IF EXISTS site_config_condition_card_style_check;

ALTER TABLE site_config
  ADD CONSTRAINT site_config_condition_card_style_check
    CHECK (condition_card_style IN ('basic', 'kbb'));

-- Reload PostgREST schema cache so the column is queryable from the
-- admin without a service restart.
NOTIFY pgrst, 'reload schema';
