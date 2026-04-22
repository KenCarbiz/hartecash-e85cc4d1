-- Appraiser Queue provisioning + auto-queue stale offers.
--
-- Part 1 — Provisions the needs_appraisal column so the "Send to Appraiser"
-- button on the customer file actually writes (it's been failing with a
-- "Queue not yet provisioned" toast until now).
--
-- Part 2 — Adds a cron-scheduled auto-queue: any submission with a
-- generated offer that hasn't been accepted within 3 hours is flagged
-- into the appraiser queue automatically. BDCs get a 3-hour grace
-- window; after that the offer goes to an appraiser for a live touch.

-- ─── 1. Column ─────────────────────────────────────────────────────────
ALTER TABLE public.submissions
  ADD COLUMN IF NOT EXISTS needs_appraisal boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.submissions.needs_appraisal IS
  'When true, the submission is in the Appraiser Queue. Flipped manually from the customer file ("Send to Appraiser") OR automatically by auto_queue_stale_offers() when a customer-generated offer sits untouched for 3+ hours.';

-- Partial index — most submissions are NOT in the queue, and the
-- Appraiser Queue page needs to find the few that are.
CREATE INDEX IF NOT EXISTS idx_submissions_needs_appraisal
  ON public.submissions(dealership_id, created_at DESC)
  WHERE needs_appraisal = true;

-- ─── 2. Auto-queue function ────────────────────────────────────────────
-- Runs via pg_cron every 15 minutes. Flips needs_appraisal = true for
-- any submission that:
--   • has a generated offer (estimated_offer_high IS NOT NULL) AND
--   • hasn't hit an accepted/locked status yet AND
--   • was created 3+ hours ago AND
--   • isn't already in the queue.
-- Writes an activity_log row for each flip so the audit trail is clean.

CREATE OR REPLACE FUNCTION public.auto_queue_stale_offers()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count integer;
BEGIN
  WITH flipped AS (
    UPDATE public.submissions
    SET needs_appraisal = true,
        updated_at = now()
    WHERE needs_appraisal = false
      AND estimated_offer_high IS NOT NULL
      AND estimated_offer_high > 0
      AND created_at < now() - interval '3 hours'
      AND (
        progress_status IS NULL
        OR progress_status NOT IN (
          'deal_finalized',
          'check_request_submitted',
          'purchase_complete',
          'dead_lead'
        )
      )
    RETURNING id, dealership_id
  )
  INSERT INTO public.activity_log (submission_id, action, old_value, new_value, performed_by)
  SELECT id, 'Auto-flagged for Appraiser Queue (3h no accept)', NULL, NULL, 'system'
  FROM flipped;

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

COMMENT ON FUNCTION public.auto_queue_stale_offers() IS
  'Finds submissions with a generated offer that have gone 3+ hours without reaching an accepted status, flags them needs_appraisal = true, and writes an activity_log row per flip. Scheduled via pg_cron.';

-- ─── 3. Schedule the cron ──────────────────────────────────────────────
-- Idempotent: drop any prior schedule first, then create the new one.
DO $$
BEGIN
  PERFORM cron.unschedule('auto-queue-stale-offers');
EXCEPTION
  WHEN undefined_function THEN NULL;
  WHEN OTHERS THEN NULL;
END
$$;

SELECT cron.schedule(
  'auto-queue-stale-offers',
  '*/15 * * * *', -- every 15 minutes
  $$SELECT public.auto_queue_stale_offers();$$
);

-- ─── 4. Backfill ───────────────────────────────────────────────────────
-- Catch existing submissions that already meet the criteria so the queue
-- is useful on first page load rather than waiting 15 minutes.
SELECT public.auto_queue_stale_offers();
