-- Live-inspection transparency triggers.
--
-- Customers sitting in the showroom while their car is inspected get
-- anxious — they imagine the inspector finding problems that'll drop
-- their offer. Sending them short reassurance SMS at milestones
-- ("We're starting your inspection", "Tires and brakes look great",
-- "Final number coming shortly") measurably reduces the bait-and-switch
-- feeling and the post-inspection walk-away rate.
--
-- This migration adds the tracking columns so each milestone fires
-- exactly once per submission. Fire sites live in MobileInspection +
-- InspectionSheet + the appraisal-finalize flow.

ALTER TABLE public.submissions
  ADD COLUMN IF NOT EXISTS inspection_started_notified_at timestamptz,
  ADD COLUMN IF NOT EXISTS inspection_progress_notified_at timestamptz;

COMMENT ON COLUMN public.submissions.inspection_started_notified_at IS
  'Timestamp of the "we are starting your inspection" SMS. Fires on first inspector-side load of the inspection sheet for this submission. Dedup so re-opening the sheet never re-texts.';
COMMENT ON COLUMN public.submissions.inspection_progress_notified_at IS
  'Timestamp of the mid-inspection progress SMS. Fires after the inspector saves tire/brake measurements for the first time.';

NOTIFY pgrst, 'reload schema';
