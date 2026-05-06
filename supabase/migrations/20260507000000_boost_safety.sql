-- Boost safety hardening — addresses two real-money risks the
-- agent review flagged:
--
--   1. offer_bumps was deletable by the dealer via the FOR ALL
--      RLS policy. An audit table that the audited party can wipe
--      isn't an audit table. Split into SELECT-only for dealers,
--      no INSERT/UPDATE/DELETE policies (service-role bypasses
--      RLS, so the edge function can still write).
--
--   2. boost-evaluate was doing two separate writes — UPDATE
--      submissions.offered_price + INSERT offer_bumps — outside a
--      transaction. A transient DB hiccup between them leaves a
--      mutated price with no audit row. Wrapped in a SECURITY
--      DEFINER function so both succeed or neither does.
--
-- Idempotent per CLAUDE.md repo convention.

-- ── 1. Tighten offer_bumps RLS ─────────────────────────────────────
DROP POLICY IF EXISTS "offer_bumps_dealer_rw"     ON offer_bumps;
DROP POLICY IF EXISTS "offer_bumps_service_write" ON offer_bumps;
DROP POLICY IF EXISTS "offer_bumps_dealer_read"   ON offer_bumps;

-- Dealers can READ rows for their rooftop. Period. No INSERT,
-- UPDATE, or DELETE policy means those operations are denied
-- to authenticated users — only the service role (used by the
-- edge function) can write or modify, since service role
-- bypasses RLS by default.
CREATE POLICY "offer_bumps_dealer_read" ON offer_bumps
  FOR SELECT
  USING (
    dealership_id IN (
      SELECT dealership_id FROM dealership_users WHERE user_id = auth.uid()
    )
  );

-- ── 2. Atomic apply function ──────────────────────────────────────
-- One transaction wraps:
--   (a) row-level lock on submissions for this token
--   (b) UPDATE offered_price + offer_made_at + updated_at
--   (c) INSERT into offer_bumps audit
-- If any step fails, the whole thing rolls back.
--
-- SECURITY DEFINER + the explicit search_path lock keep this safe
-- when called from edge functions via service role. No direct
-- public callers — boost-evaluate / boost-apply-offer invoke
-- this via supabase.rpc("apply_boost_bump", ...).

CREATE OR REPLACE FUNCTION apply_boost_bump(
  _token TEXT,
  _previous_offer NUMERIC,
  _new_offer NUMERIC,
  _bump_amount NUMERIC,
  _line_items JSONB,
  _source TEXT
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _submission_id UUID;
  _dealership_id UUID;
  _bump_id UUID;
BEGIN
  -- Lock the submission for the duration of this transaction so
  -- a concurrent boost can't read a stale price + race the write.
  SELECT id, dealership_id INTO _submission_id, _dealership_id
    FROM submissions
   WHERE token = _token
   FOR UPDATE;

  IF _submission_id IS NULL THEN
    RAISE EXCEPTION 'submission_not_found' USING ERRCODE = 'P0002';
  END IF;

  -- Stamp offer_made_at the first time offered_price flips
  -- positive — keeps the boost path consistent with the existing
  -- BEFORE INSERT/UPDATE triggers without depending on them.
  UPDATE submissions
     SET offered_price = _new_offer,
         offer_made_at = COALESCE(offer_made_at, NOW()),
         updated_at    = NOW()
   WHERE id = _submission_id;

  -- Audit row — same transaction, so a constraint violation here
  -- rolls back the price update too.
  INSERT INTO offer_bumps (
    submission_id,
    dealership_id,
    previous_offer,
    new_offer,
    bump_amount,
    line_items,
    source
  ) VALUES (
    _submission_id,
    _dealership_id,
    _previous_offer,
    _new_offer,
    _bump_amount,
    COALESCE(_line_items, '[]'::jsonb),
    COALESCE(_source, 'boost_evaluate')
  )
  RETURNING id INTO _bump_id;

  RETURN _bump_id;
END;
$$;

REVOKE ALL ON FUNCTION apply_boost_bump(TEXT, NUMERIC, NUMERIC, NUMERIC, JSONB, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION apply_boost_bump(TEXT, NUMERIC, NUMERIC, NUMERIC, JSONB, TEXT) TO service_role;

-- ── 3. Recent-bump lookup for idempotency guards ──────────────────
-- boost-evaluate uses this to short-circuit re-submits. Returns
-- the most recent offer_bumps row for a submission within the
-- last N seconds, or NULL if none. Prevents bump-stacking when
-- a customer double-taps Submit or a flaky network retries.

CREATE OR REPLACE FUNCTION recent_boost_bump(
  _token TEXT,
  _within_seconds INTEGER DEFAULT 60
)
RETURNS TABLE (
  id UUID,
  previous_offer NUMERIC,
  new_offer NUMERIC,
  bump_amount NUMERIC,
  line_items JSONB,
  created_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT b.id, b.previous_offer, b.new_offer, b.bump_amount, b.line_items, b.created_at
    FROM offer_bumps b
    JOIN submissions s ON s.id = b.submission_id
   WHERE s.token = _token
     AND b.created_at >= NOW() - (_within_seconds || ' seconds')::INTERVAL
   ORDER BY b.created_at DESC
   LIMIT 1;
END;
$$;

REVOKE ALL ON FUNCTION recent_boost_bump(TEXT, INTEGER) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION recent_boost_bump(TEXT, INTEGER) TO service_role;

NOTIFY pgrst, 'reload schema';
