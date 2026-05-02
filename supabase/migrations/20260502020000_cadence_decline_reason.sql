-- Cadence engine — decline-reason capture.
--
-- The post-offer cadence branches on WHY the customer didn't accept:
--   - "price_too_low" → manager-bump reveal earlier (D3 instead of D5)
--   - "shopping_around" → competitor-quote SMS + match-or-beat
--   - "not_ready" → straight to monthly market-update drip
--   - "sold_elsewhere" → drop from active cadence, move to monthly
--
-- The day-1 follow-up email surfaces 4 buttons; each links to the
-- track-decline-reason edge function which writes here.
--
-- Idempotent — uses ADD COLUMN IF NOT EXISTS so safe to re-apply.

ALTER TABLE public.submissions
  ADD COLUMN IF NOT EXISTS decline_reason text,
  ADD COLUMN IF NOT EXISTS decline_reason_at timestamptz,
  ADD COLUMN IF NOT EXISTS decline_reason_source text;

COMMENT ON COLUMN public.submissions.decline_reason IS
  'Why the customer didn''t accept the offer. One of: price_too_low, shopping_around, not_ready, sold_elsewhere, other. Drives cadence branching.';
COMMENT ON COLUMN public.submissions.decline_reason_at IS
  'When the customer clicked the reason button (or rep typed it).';
COMMENT ON COLUMN public.submissions.decline_reason_source IS
  'How the reason was captured: email_button, rep_input, voice_call, sms_reply.';

-- Constrain values via CHECK so we catch typos at write-time.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.constraint_column_usage
     WHERE table_name = 'submissions' AND constraint_name = 'submissions_decline_reason_chk'
  ) THEN
    ALTER TABLE public.submissions
      ADD CONSTRAINT submissions_decline_reason_chk
      CHECK (decline_reason IS NULL OR decline_reason IN (
        'price_too_low', 'shopping_around', 'not_ready', 'sold_elsewhere', 'other'
      ));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_submissions_decline_reason
  ON public.submissions (decline_reason)
  WHERE decline_reason IS NOT NULL;

NOTIFY pgrst, 'reload schema';
