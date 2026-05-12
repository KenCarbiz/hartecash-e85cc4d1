-- Cache Black Book Market Days Supply on the submission row so the
-- customer-file slide-out and pipeline table can show velocity without
-- a live retail-listings fetch on every render.
--
-- The appraisal tool writes this value after it computes the live MDS;
-- everything downstream just reads it off the submission.
--
-- Idempotent per CLAUDE.md: safe to re-run, safe to apply out of order.

ALTER TABLE submissions
  ADD COLUMN IF NOT EXISTS bb_market_days_supply numeric;

COMMENT ON COLUMN submissions.bb_market_days_supply IS
  'Cached Black Book / live-retail market days supply at time of appraisal. Refreshed by AppraisalTool when retail stats load. Null when the appraisal has not run or the stats lookup failed.';

NOTIFY pgrst, 'reload schema';
