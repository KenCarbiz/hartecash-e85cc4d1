-- Two-way SMS slot booking — stash outstanding proposals on the
-- submission so the next inbound SMS can match the customer's "1" /
-- "2" / "3" reply against the slots we offered.
--
-- Stored as JSONB (not a separate table) because it's per-submission,
-- short-lived (~48h), and never queried in aggregate. The shape is
-- exactly what cadence-tick generated:
--
--   {
--     "expires_at": "2026-05-04T18:00:00Z",
--     "slots": [
--       { "id": "...", "iso": "...", "human": "Mon May 5, 10:00 AM",
--         "location": "..." },
--       { ... },
--       { ... }
--     ]
--   }
--
-- The cadence step that fires customer_schedule_slot_proposal also
-- sets pending_slot_proposals on the submission. The sms-webhook
-- reads it on inbound, matches against the digit reply, books via
-- bland-appointment-webhook semantics, and clears the column.

ALTER TABLE public.submissions
  ADD COLUMN IF NOT EXISTS pending_slot_proposals jsonb;

COMMENT ON COLUMN public.submissions.pending_slot_proposals IS
  'Outstanding SMS slot proposals — set when we send a "reply 1/2/3" message, cleared when matched or expired (48h). Shape: {expires_at, slots:[{id,iso,human,location}]}.';

CREATE INDEX IF NOT EXISTS idx_submissions_pending_slots
  ON public.submissions ((pending_slot_proposals IS NOT NULL))
  WHERE pending_slot_proposals IS NOT NULL;

NOTIFY pgrst, 'reload schema';
