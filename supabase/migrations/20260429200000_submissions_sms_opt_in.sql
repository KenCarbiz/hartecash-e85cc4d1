-- submissions.sms_opt_in — explicit customer consent to receive SMS
-- comms (offer updates, appointment reminders, follow-up sequences).
--
-- Captured at offer-acceptance time via a checkbox in the contact-gate
-- dialog. Default true since the customer is mid-flow on a transactional
-- offer; they can untick if they don't want it.
--
-- Downstream consumers (send-notification, run-voice-campaign,
-- send-follow-up) should respect this AND the existing opt_outs table
-- AND the consent_log entries — defense in depth.

ALTER TABLE public.submissions
  ADD COLUMN IF NOT EXISTS sms_opt_in boolean NOT NULL DEFAULT true;

COMMENT ON COLUMN public.submissions.sms_opt_in IS
  'Customer consent to receive SMS (transactional + marketing). Captured at offer-acceptance time. Default true; explicit opt-out via opt_outs table or this flag = false suppresses outbound SMS to this customer.';

NOTIFY pgrst, 'reload schema';
