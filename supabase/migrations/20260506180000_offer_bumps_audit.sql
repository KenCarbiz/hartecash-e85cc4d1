-- offer_bumps — audit trail for boost-evaluate price changes.
-- Lets the dealer's file detail view show WHY the offer moved
-- (which line items the AI / customer photo set surfaced) so an
-- appraiser can review the AI's reasoning before final-inspection
-- pricing. Idempotent per CLAUDE.md repo convention.

CREATE TABLE IF NOT EXISTS offer_bumps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  submission_id UUID NOT NULL,
  dealership_id UUID NOT NULL,
  previous_offer NUMERIC NOT NULL,
  new_offer NUMERIC NOT NULL,
  bump_amount NUMERIC NOT NULL,
  line_items JSONB DEFAULT '[]'::jsonb,
  source TEXT NOT NULL DEFAULT 'boost_offer',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS offer_bumps_submission_idx
  ON offer_bumps (submission_id, created_at DESC);
CREATE INDEX IF NOT EXISTS offer_bumps_dealership_idx
  ON offer_bumps (dealership_id, created_at DESC);

ALTER TABLE offer_bumps ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "offer_bumps_dealer_read" ON offer_bumps;
DROP POLICY IF EXISTS "offer_bumps_service_write" ON offer_bumps;

-- Dealers see their rooftop's bumps. Mirrors the consent_log /
-- embed_events pattern.
CREATE POLICY "offer_bumps_dealer_read" ON offer_bumps
  FOR SELECT
  USING (
    dealership_id IN (
      SELECT dealership_id FROM dealership_users WHERE user_id = auth.uid()
    )
  );

-- The boost-apply-offer edge function writes via service role; no
-- public writes. (Edge function auth handles the customer's token.)
CREATE POLICY "offer_bumps_service_write" ON offer_bumps
  FOR INSERT
  WITH CHECK (false);

NOTIFY pgrst, 'reload schema';
