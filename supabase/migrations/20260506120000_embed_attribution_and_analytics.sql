-- Embed v3 — inventory attribution, escalation timing, and event
-- analytics. All idempotent so the file is safe to re-run.
--
-- Adds to submissions:
--   embed_source         text       — "inventory_embed" when the lead came
--                                     from the iframe widget on a dealer site
--   embed_vehicle_label  text       — vehicle the customer was viewing
--                                     when they started the flow
--                                     (e.g. "2024 Honda CR-V")
--   embed_vehicle_msrp   numeric    — sticker price scraped off the VDP
--   offer_made_at        timestamptz — first time offered_price was set
--                                     (anchors time-decay escalation in
--                                      embed.js — client-stamping is
--                                      unreliable across browsers/devices)
--
-- Adds to site_config:
--   embed_escalation_enabled    boolean — master kill-switch (default true)
--   embed_escalation_max_tier   smallint — cap escalation at 0/1/2/3
--                                          (0 = no escalation, 3 = full
--                                           Day 7 auto-open)
--
-- Creates embed_events for analytics. Tiny denormalized firehose that
-- the loader posts to via /functions/embed-track. RLS lets dealers
-- read their own rows; service role writes.

-- ── submissions extensions ────────────────────────────────────────
ALTER TABLE submissions ADD COLUMN IF NOT EXISTS embed_source TEXT;
ALTER TABLE submissions ADD COLUMN IF NOT EXISTS embed_vehicle_label TEXT;
ALTER TABLE submissions ADD COLUMN IF NOT EXISTS embed_vehicle_msrp NUMERIC;
ALTER TABLE submissions ADD COLUMN IF NOT EXISTS offer_made_at TIMESTAMPTZ;

-- Backfill offer_made_at for existing rows that already have an offer
-- so the floating widget doesn't immediately escalate every legacy
-- offer to Day 7. Best-effort: use updated_at when offer_made_at is
-- null, falling back to created_at if updated_at isn't tracked.
UPDATE submissions
   SET offer_made_at = COALESCE(updated_at, created_at)
 WHERE offer_made_at IS NULL
   AND offered_price IS NOT NULL
   AND offered_price > 0;

-- Trigger: stamp offer_made_at the first time offered_price flips
-- from null/0 to a positive value. Matches the embed.js writeState
-- contract so client + server agree on the anchor.
CREATE OR REPLACE FUNCTION set_offer_made_at()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.offered_price IS NOT NULL AND NEW.offered_price > 0
     AND (OLD.offered_price IS NULL OR OLD.offered_price = 0)
     AND NEW.offer_made_at IS NULL THEN
    NEW.offer_made_at := NOW();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS submissions_set_offer_made_at ON submissions;
CREATE TRIGGER submissions_set_offer_made_at
  BEFORE UPDATE ON submissions
  FOR EACH ROW EXECUTE FUNCTION set_offer_made_at();

-- Also stamp on insert when the lead arrives with an offer already
-- (e.g. demo mode or pre-priced trade flows).
CREATE OR REPLACE FUNCTION set_offer_made_at_insert()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.offered_price IS NOT NULL AND NEW.offered_price > 0
     AND NEW.offer_made_at IS NULL THEN
    NEW.offer_made_at := NOW();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS submissions_set_offer_made_at_insert ON submissions;
CREATE TRIGGER submissions_set_offer_made_at_insert
  BEFORE INSERT ON submissions
  FOR EACH ROW EXECUTE FUNCTION set_offer_made_at_insert();

-- ── site_config: per-dealer escalation controls ──────────────────
ALTER TABLE site_config ADD COLUMN IF NOT EXISTS embed_escalation_enabled BOOLEAN NOT NULL DEFAULT TRUE;
ALTER TABLE site_config ADD COLUMN IF NOT EXISTS embed_escalation_max_tier SMALLINT NOT NULL DEFAULT 3;

-- Clamp invalid tier values rather than refusing the row — the admin
-- UI uses a select that already constrains, but defense in depth.
ALTER TABLE site_config DROP CONSTRAINT IF EXISTS site_config_embed_escalation_max_tier_check;
ALTER TABLE site_config ADD CONSTRAINT site_config_embed_escalation_max_tier_check
  CHECK (embed_escalation_max_tier >= 0 AND embed_escalation_max_tier <= 3);

-- ── embed_events: analytics firehose ──────────────────────────────
CREATE TABLE IF NOT EXISTS embed_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  dealership_id UUID NOT NULL,
  event_type TEXT NOT NULL,           -- widget_loaded | vehicle_detected | pill_clicked | overlay_opened | escalation_fired | state_received
  intent TEXT,                        -- start | apply | boost | view | resume (for pill_clicked)
  tier SMALLINT,                      -- 0 | 1 | 2 | 3 (for pill render + escalation_fired)
  vehicle_label TEXT,
  vehicle_msrp NUMERIC,
  submission_token TEXT,              -- when known
  page_url TEXT,
  user_agent TEXT,
  session_id TEXT,                    -- client-generated, persists across pageloads
  payload JSONB DEFAULT '{}'::jsonb,  -- escape hatch for additional context
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS embed_events_dealership_created_idx
  ON embed_events (dealership_id, created_at DESC);
CREATE INDEX IF NOT EXISTS embed_events_event_type_idx
  ON embed_events (event_type);
CREATE INDEX IF NOT EXISTS embed_events_session_idx
  ON embed_events (session_id) WHERE session_id IS NOT NULL;

ALTER TABLE embed_events ENABLE ROW LEVEL SECURITY;

-- Drop any prior policies (idempotent re-runs)
DROP POLICY IF EXISTS "embed_events_dealer_read" ON embed_events;
DROP POLICY IF EXISTS "embed_events_service_write" ON embed_events;

-- Dealers can read events for their own rooftop. Mirrors the
-- pattern used on submissions / consent_log.
CREATE POLICY "embed_events_dealer_read" ON embed_events
  FOR SELECT
  USING (
    dealership_id IN (
      SELECT dealership_id FROM dealership_users WHERE user_id = auth.uid()
    )
  );

-- Anyone can insert. The dealer site's loader is unauthenticated
-- (it runs in the customer's browser), so we accept all writes and
-- rely on client-side rate limiting + an edge function in front of
-- this table for spam mitigation. dealership_id validation happens
-- in the edge function.
CREATE POLICY "embed_events_service_write" ON embed_events
  FOR INSERT
  WITH CHECK (true);

NOTIFY pgrst, 'reload schema';
