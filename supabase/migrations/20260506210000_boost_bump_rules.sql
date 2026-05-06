-- boost_bump_rules — per-dealer overrides for the 10 AI signal
-- categories that drive offer bumps on the boost-offer page.
-- The boost-evaluate edge function reads this table by
-- dealership_id at the start of each run; signals without a row
-- fall back to baked-in defaults so dealers who haven't tuned
-- anything still get the recommended values.
--
-- Idempotent (CLAUDE.md repo convention).

CREATE TABLE IF NOT EXISTS boost_bump_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  dealership_id UUID NOT NULL,
  signal_key TEXT NOT NULL,
  bump_amount NUMERIC NOT NULL DEFAULT 0,
  enabled BOOLEAN NOT NULL DEFAULT TRUE,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (dealership_id, signal_key)
);

-- Lookup index — boost-evaluate hits this once per submission run
-- so the dealership_id-keyed read needs to be O(1).
CREATE INDEX IF NOT EXISTS boost_bump_rules_dealership_idx
  ON boost_bump_rules (dealership_id);

-- Constraint: bump amounts are dollars, can't be negative, can't
-- be absurd (cap matches boost-evaluate's MAX_BUMP_TOTAL ceiling
-- so a single signal can't blow the whole budget by itself).
ALTER TABLE boost_bump_rules DROP CONSTRAINT IF EXISTS boost_bump_rules_amount_range_check;
ALTER TABLE boost_bump_rules ADD CONSTRAINT boost_bump_rules_amount_range_check
  CHECK (bump_amount >= 0 AND bump_amount <= 2500);

ALTER TABLE boost_bump_rules ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "boost_bump_rules_dealer_rw" ON boost_bump_rules;

-- Dealers manage their own rooftop's rules. Mirrors the consent_log /
-- embed_events / offer_bumps pattern. Same policy covers SELECT,
-- INSERT, UPDATE, DELETE.
CREATE POLICY "boost_bump_rules_dealer_rw" ON boost_bump_rules
  FOR ALL
  USING (
    dealership_id IN (
      SELECT dealership_id FROM dealership_users WHERE user_id = auth.uid()
    )
  )
  WITH CHECK (
    dealership_id IN (
      SELECT dealership_id FROM dealership_users WHERE user_id = auth.uid())
  );

-- Touch updated_at on every change for the admin UI's "last
-- changed" indicator.
CREATE OR REPLACE FUNCTION touch_boost_bump_rules_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS boost_bump_rules_touch_updated_at ON boost_bump_rules;
CREATE TRIGGER boost_bump_rules_touch_updated_at
  BEFORE UPDATE ON boost_bump_rules
  FOR EACH ROW EXECUTE FUNCTION touch_boost_bump_rules_updated_at();

NOTIFY pgrst, 'reload schema';
