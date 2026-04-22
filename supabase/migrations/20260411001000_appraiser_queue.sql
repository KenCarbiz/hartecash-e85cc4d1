-- Appraiser Queue + per-user Appraiser credential + AI auto-route toggle
--
-- Three related features that land together:
--
-- 1. submissions.needs_appraisal (manual queue flag)
--    Managers tap "Send to Appraiser" on a customer file. The row shows
--    up in the Appraiser Queue until someone sets acv_value.
--
-- 2. submissions.offer_subject_to_inspection (disclosure flag)
--    Set to true any time a staff member manually overrides an offer
--    above the algorithmic baseline, any time the AI auto-increases
--    an offer in the future, or any time the customer's offered_price
--    is greater than estimated_offer_high. The customer-facing offer
--    acceptance screen + email + print layout show a "Subject to
--    physical inspection" disclosure when this flag is true so the
--    dealer is protected if the car arrives in worse condition than
--    the customer claimed.
--
-- 3. site_config.auto_route_appraiser_queue (per-dealer AI toggle)
--    When false (default), the Appraiser Queue shows only
--    manager-flagged submissions. When true, the queue ALSO
--    automatically includes offer_declined + walk-in + service-drive
--    + manual-entry submissions that don't have an ACV yet.
--
-- 4. user_roles.is_appraiser (additive credential)
--    Any role (admin/gsm_gm/used_car_manager/sales_bdc/etc.) can be
--    granted the Appraiser credential. It does not replace their base
--    role — it adds sidebar visibility to the Appraiser Queue.

-- ── Submissions ─────────────────────────────────────────────────────
ALTER TABLE public.submissions
  ADD COLUMN IF NOT EXISTS needs_appraisal boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS offer_subject_to_inspection boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.submissions.needs_appraisal IS
  'Manager-set flag that puts a submission in the Appraiser Queue until an ACV is recorded.';

COMMENT ON COLUMN public.submissions.offer_subject_to_inspection IS
  'True when offered_price was manually overridden above the algorithmic estimate OR auto-increased by the AI. Surfaces a disclosure on the customer-facing acceptance page + email + print that the offer is conditional on the physical inspection matching the self-reported condition.';

-- Partial index — Appraiser Queue only cares about rows where the flag
-- is set, so a partial index keeps it tiny.
CREATE INDEX IF NOT EXISTS idx_submissions_needs_appraisal
  ON public.submissions (needs_appraisal, created_at DESC)
  WHERE needs_appraisal = true;

-- Auto-flag: whenever offered_price rises above estimated_offer_high
-- (i.e. a manager manually bumped the number or a future AI re-val
-- increased it), automatically mark the offer subject to inspection.
-- This runs on both INSERT and UPDATE so no code path can forget.
CREATE OR REPLACE FUNCTION public.auto_flag_subject_to_inspection()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.offered_price IS NOT NULL
     AND NEW.estimated_offer_high IS NOT NULL
     AND NEW.offered_price > NEW.estimated_offer_high
  THEN
    NEW.offer_subject_to_inspection := true;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_submissions_subject_to_inspection ON public.submissions;
CREATE TRIGGER trg_submissions_subject_to_inspection
  BEFORE INSERT OR UPDATE OF offered_price, estimated_offer_high
  ON public.submissions
  FOR EACH ROW EXECUTE FUNCTION public.auto_flag_subject_to_inspection();

-- ── Site config ─────────────────────────────────────────────────────
ALTER TABLE public.site_config
  ADD COLUMN IF NOT EXISTS auto_route_appraiser_queue boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.site_config.auto_route_appraiser_queue IS
  'When true, the Appraiser Queue automatically includes declined offers + walk-in + service-drive + manual-entry leads that have no ACV. When false (default), only manager-flagged submissions appear in the queue.';

-- ── User roles ──────────────────────────────────────────────────────
ALTER TABLE public.user_roles
  ADD COLUMN IF NOT EXISTS is_appraiser boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.user_roles.is_appraiser IS
  'Additive credential. Any role can be granted Appraiser access to see the Appraiser Queue in addition to their base role permissions.';
