-- Appraiser-of-record notifications — Phase 1
--
-- Adds the schema and a DB trigger so that whenever a submission's
-- needs_appraisal flag flips false→true, an event lands in a queue
-- table that downstream code (Phase 3 cron worker) can pick up and
-- dispatch to the appraiser of record (and later, escalate up the
-- hierarchy).
--
-- Per CLAUDE.md every migration is idempotent (IF NOT EXISTS,
-- ON CONFLICT, DROP IF EXISTS) and ends with NOTIFY pgrst.

-- ── Schema: per-location AOR with dealer-level fallback ────────
-- Per-location is the source of truth; dealer-level is the
-- fallback used when a rooftop hasn't named its own appraiser.

ALTER TABLE public.site_config
  ADD COLUMN IF NOT EXISTS appraiser_of_record_user_id uuid
  REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE public.dealership_locations
  ADD COLUMN IF NOT EXISTS appraiser_of_record_user_id uuid
  REFERENCES auth.users(id) ON DELETE SET NULL;

-- ── Helper: resolve the AOR for a (dealership, location) tuple ─
-- Returns the location-specific AOR if set, else falls back to the
-- dealer-level AOR. Returns NULL if neither is configured (which
-- the dispatcher treats as "no notification configured for this
-- dealer" — the queue row still gets created so we have audit
-- trail, but the cron worker skips it).

CREATE OR REPLACE FUNCTION public.get_appraiser_of_record(
  _dealership_id text,
  _location_id uuid
)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    -- Per-location override, when both are set
    (SELECT appraiser_of_record_user_id
       FROM dealership_locations
      WHERE id = _location_id
        AND dealership_id = _dealership_id
        AND appraiser_of_record_user_id IS NOT NULL),
    -- Dealer-level fallback
    (SELECT appraiser_of_record_user_id
       FROM site_config
      WHERE dealership_id = _dealership_id
        AND appraiser_of_record_user_id IS NOT NULL)
  );
$$;

GRANT EXECUTE ON FUNCTION public.get_appraiser_of_record(text, uuid)
  TO authenticated, service_role;

-- ── Notification queue ─────────────────────────────────────────
-- Rows land here when needs_appraisal flips false→true. The Phase
-- 3 cron worker reads `status='pending'` rows and dispatches an
-- email; on dispatch it sets status='sent' (or 'escalated' when
-- bumping to the next tier). Phase 1 just records the row — the
-- worker comes later but the data is being captured from day one
-- so historical analysis is possible.

CREATE TABLE IF NOT EXISTS public.appraiser_notification_queue (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  submission_id   uuid NOT NULL REFERENCES public.submissions(id) ON DELETE CASCADE,
  dealership_id   text NOT NULL,
  location_id     uuid REFERENCES public.dealership_locations(id) ON DELETE SET NULL,
  -- The trigger that produced the row. Phase 1 populates only the
  -- `needs_appraisal_flip` value; Phases 2 + 3 add more values.
  trigger_kind    text NOT NULL CHECK (trigger_kind IN (
    'needs_appraisal_flip',     -- A: pending appraiser (any cause)
    'customer_offer_accepted',  -- B: customer accepted, awaiting ACV sign-off
    'stale_offer_review'        -- C: offer sent >1h, no acceptance
  )),
  -- Resolved at queue time; cron worker uses it as the initial
  -- recipient. NULL is allowed and means "no AOR configured" — the
  -- worker skips dispatching but the row stays for audit.
  initial_recipient_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  -- Escalation tier the next dispatch will fire at. 0 = AOR,
  -- 1 = UCM, 2 = GSM, 3 = GM. Phase 3 advances this on each
  -- escalation step.
  escalation_tier integer NOT NULL DEFAULT 0,
  status          text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'sent', 'escalated', 'resolved', 'no_recipient')),
  created_at      timestamptz NOT NULL DEFAULT now(),
  -- When the cron worker last took action (sent or escalated).
  -- Used for the 2h escalation timing.
  last_acted_at   timestamptz,
  resolved_at     timestamptz
);

CREATE INDEX IF NOT EXISTS appraiser_notif_queue_pending_idx
  ON public.appraiser_notification_queue (status, created_at)
  WHERE status = 'pending';

CREATE INDEX IF NOT EXISTS appraiser_notif_queue_submission_idx
  ON public.appraiser_notification_queue (submission_id);

ALTER TABLE public.appraiser_notification_queue ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Staff can read own-dealership appraiser queue"
  ON public.appraiser_notification_queue;
CREATE POLICY "Staff can read own-dealership appraiser queue"
  ON public.appraiser_notification_queue FOR SELECT
  TO authenticated
  USING (
    public.is_staff(auth.uid())
    AND dealership_id = public.get_user_dealership_id(auth.uid())
  );

DROP POLICY IF EXISTS "Service role full appraiser queue"
  ON public.appraiser_notification_queue;
CREATE POLICY "Service role full appraiser queue"
  ON public.appraiser_notification_queue FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- ── Trigger: enqueue on needs_appraisal flip ───────────────────
-- Fires when needs_appraisal flips false → true (or NULL → true).
-- Resolves the AOR at trigger time so the queue row carries the
-- recipient even if the AOR config changes later.

CREATE OR REPLACE FUNCTION public.tg_enqueue_appraiser_notification()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _aor_user_id uuid;
BEGIN
  -- Only on a true flip false→true (or NULL→true). If needs_appraisal
  -- was already true, this is a no-op so manager re-flagging the
  -- same row doesn't double-notify.
  IF (TG_OP = 'UPDATE')
     AND (NEW.needs_appraisal IS TRUE)
     AND (OLD.needs_appraisal IS DISTINCT FROM TRUE) THEN

    _aor_user_id := public.get_appraiser_of_record(
      NEW.dealership_id,
      NEW.store_location_id
    );

    INSERT INTO public.appraiser_notification_queue (
      submission_id,
      dealership_id,
      location_id,
      trigger_kind,
      initial_recipient_user_id,
      status
    ) VALUES (
      NEW.id,
      NEW.dealership_id,
      NEW.store_location_id,
      'needs_appraisal_flip',
      _aor_user_id,
      CASE WHEN _aor_user_id IS NULL THEN 'no_recipient' ELSE 'pending' END
    );
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS submissions_enqueue_appraiser_notification
  ON public.submissions;
CREATE TRIGGER submissions_enqueue_appraiser_notification
  AFTER UPDATE OF needs_appraisal ON public.submissions
  FOR EACH ROW
  EXECUTE FUNCTION public.tg_enqueue_appraiser_notification();

NOTIFY pgrst, 'reload schema';
