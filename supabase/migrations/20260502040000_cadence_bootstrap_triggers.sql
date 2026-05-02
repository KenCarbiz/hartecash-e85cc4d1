-- Cadence engine bootstrap triggers — auto-enroll submissions into the
-- right cadence on the right state transitions. Without this, the
-- orchestrator has nothing to run.
--
-- Transitions:
--
--   offer issued (offered_price set, no acceptance) -> enroll in
--     'declined' cadence with cadence_started_at = now,
--     cadence_next_due_at = now + 24h (D1 first touch).
--
--   offer accepted (progress_status = 'accepted', no appointment yet)
--     -> enroll in 'stall' cadence with cadence_next_due_at = now + 5min.
--
--   appointment scheduled -> exit cadence (set state = 'completed').
--
--   deal closed (purchase_complete) -> exit cadence (state = 'completed').
--
--   customer opt-out via opt_outs insert -> set cadence_paused_until
--     to far-future (10 years).
--
-- These triggers are idempotent — they only ENROLL when state is null,
-- and only EXIT when state is in_flight. So a re-fire is a no-op.
--
-- Idempotent migration — DROP TRIGGER IF EXISTS / CREATE OR REPLACE.

CREATE OR REPLACE FUNCTION public.cadence_bootstrap_on_submission_change()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  cadence_settings notification_settings%ROWTYPE;
BEGIN
  -- Look up tenant's cadence_enabled flag — bail if disabled.
  SELECT * INTO cadence_settings
    FROM public.notification_settings
   WHERE dealership_id = NEW.dealership_id
   LIMIT 1;
  IF FOUND AND cadence_settings.cadence_enabled = false THEN
    RETURN NEW;
  END IF;

  -- ── Enroll into 'declined' when an offer first goes out ──
  -- Triggered when offered_price gets set (or estimated_offer_high
  -- if estimate-only) and the customer hasn't accepted yet. We start
  -- the 24-hour clock from this moment.
  IF NEW.cadence_state IS NULL
     AND NEW.progress_status NOT IN ('accepted', 'inspection_scheduled', 'appointment_scheduled', 'inspection_completed', 'check_request_submitted', 'purchase_complete', 'declined')
     AND COALESCE(NEW.offered_price, NEW.estimated_offer_high) IS NOT NULL
     AND (TG_OP = 'INSERT' OR
          (OLD.offered_price IS NULL AND NEW.offered_price IS NOT NULL) OR
          (OLD.estimated_offer_high IS NULL AND NEW.estimated_offer_high IS NOT NULL))
  THEN
    NEW.cadence_state := 'declined';
    NEW.cadence_step := 0;
    NEW.cadence_started_at := now();
    NEW.cadence_next_due_at := now() + interval '24 hours';
  END IF;

  -- ── Promote 'declined' → 'stall' on acceptance ──
  -- Customer accepted but hasn't scheduled. Reset the cadence clock so
  -- D+5min stall touches are computed off acceptance, not off the
  -- original offer.
  IF NEW.progress_status = 'accepted'
     AND (TG_OP = 'INSERT' OR OLD.progress_status IS DISTINCT FROM 'accepted')
     AND NEW.cadence_state IS DISTINCT FROM 'completed'
  THEN
    NEW.cadence_state := 'stall';
    NEW.cadence_step := 0;
    NEW.cadence_started_at := now();
    NEW.cadence_next_due_at := now() + interval '5 minutes';
  END IF;

  -- ── Exit on scheduling / completion ──
  -- Once the appointment is locked or the deal closes, we stop
  -- chasing. Staff can still send manual messages but the engine
  -- backs off.
  IF (TG_OP = 'UPDATE' AND OLD.progress_status IS DISTINCT FROM NEW.progress_status)
     AND NEW.progress_status IN ('inspection_scheduled', 'appointment_scheduled', 'inspection_completed', 'check_request_submitted', 'purchase_complete')
  THEN
    NEW.cadence_state := 'completed';
    NEW.cadence_next_due_at := NULL;
  END IF;

  -- ── Hard exit on declined progress_status ──
  -- Customer explicitly told us no — pause the engine.
  IF NEW.progress_status = 'declined'
     AND (TG_OP = 'INSERT' OR OLD.progress_status IS DISTINCT FROM 'declined')
  THEN
    -- Drop into reengage instead of completed — most "declined"
    -- customers come back per KBB ICO data (89% close post-expiry).
    -- But pause for a week first so we're not pestering.
    NEW.cadence_state := 'reengage';
    NEW.cadence_step := 0;
    NEW.cadence_started_at := now();
    NEW.cadence_next_due_at := now() + interval '7 days';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS submissions_cadence_bootstrap_trg ON public.submissions;
CREATE TRIGGER submissions_cadence_bootstrap_trg
  BEFORE INSERT OR UPDATE OF progress_status, offered_price, estimated_offer_high
  ON public.submissions
  FOR EACH ROW
  EXECUTE FUNCTION public.cadence_bootstrap_on_submission_change();

-- ── Pause cadence on opt-out ─────────────────────────────────────────
-- When a customer opts out via opt_outs insert, mute the cadence
-- engine for 10 years (effectively forever — they can still get
-- transactional emails like check-ready confirmations, but not the
-- nurture drip).
CREATE OR REPLACE FUNCTION public.cadence_pause_on_optout()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  -- Match by phone OR email — opt_outs may have either.
  UPDATE public.submissions
     SET cadence_paused_until = now() + interval '10 years'
   WHERE (NEW.phone IS NOT NULL AND phone = NEW.phone)
      OR (NEW.email IS NOT NULL AND email = NEW.email);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS opt_outs_cadence_pause_trg ON public.opt_outs;
CREATE TRIGGER opt_outs_cadence_pause_trg
  AFTER INSERT ON public.opt_outs
  FOR EACH ROW
  EXECUTE FUNCTION public.cadence_pause_on_optout();

-- ── Backfill existing in-flight submissions ──────────────────────────
-- One-shot: enroll currently-active submissions so the engine has
-- something to work with on day 1 of deployment.
UPDATE public.submissions
   SET cadence_state = 'declined',
       cadence_step = 0,
       cadence_started_at = COALESCE(status_updated_at, created_at),
       cadence_next_due_at = COALESCE(status_updated_at, created_at) + interval '24 hours'
 WHERE cadence_state IS NULL
   AND progress_status NOT IN ('accepted', 'inspection_scheduled', 'appointment_scheduled', 'inspection_completed', 'check_request_submitted', 'purchase_complete', 'declined')
   AND COALESCE(offered_price, estimated_offer_high) IS NOT NULL
   AND COALESCE(status_updated_at, created_at) > now() - interval '90 days';

UPDATE public.submissions
   SET cadence_state = 'stall',
       cadence_step = 0,
       cadence_started_at = COALESCE(status_updated_at, created_at),
       cadence_next_due_at = COALESCE(status_updated_at, created_at) + interval '5 minutes'
 WHERE cadence_state IS NULL
   AND progress_status = 'accepted'
   AND COALESCE(status_updated_at, created_at) > now() - interval '90 days';

NOTIFY pgrst, 'reload schema';
