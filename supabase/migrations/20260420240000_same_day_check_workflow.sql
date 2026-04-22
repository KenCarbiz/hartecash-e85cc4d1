-- Same-day check workflow.
--
-- Dealers that hand a customer a check within 15 minutes of deal
-- acceptance vs. next-day mail see ~8% higher acquisition close rate
-- (customer can't change their mind after they've walked out with
-- money). Today the platform has a single "customer_check_ready"
-- trigger that fires when progress_status flips to
-- check_request_submitted — which is when the request goes to
-- accounting, not when the check is actually printed.
--
-- This migration adds an explicit "check physically ready for pickup"
-- milestone separate from the accounting-side request flow. A new
-- button on the customer file lets an admin stamp the moment the check
-- is actually in hand / in the drawer, which fires a distinct SMS to
-- the customer telling them to come pick it up.

ALTER TABLE public.submissions
  ADD COLUMN IF NOT EXISTS check_ready_at timestamptz,
  ADD COLUMN IF NOT EXISTS check_pickup_notified_at timestamptz,
  ADD COLUMN IF NOT EXISTS check_picked_up_at timestamptz;

COMMENT ON COLUMN public.submissions.check_ready_at IS
  'When the physical check was printed / made ready for pickup. Separate from check_request_done (that flag means "accounting has processed the request"). Stamped when an admin/GSM/GM clicks "Mark Check Ready" on the customer file.';
COMMENT ON COLUMN public.submissions.check_pickup_notified_at IS
  'When the customer was SMSd "your check is ready — come pick it up". Dedup so a second click doesn''t re-text.';
COMMENT ON COLUMN public.submissions.check_picked_up_at IS
  'When the customer actually picked up the check. Closes the loop for reporting on time-to-check KPI.';

NOTIFY pgrst, 'reload schema';
