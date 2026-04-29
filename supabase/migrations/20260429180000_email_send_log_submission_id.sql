-- Add submission_id to email_send_log so the inbound-email-webhook
-- can match an inbound In-Reply-To header back to the right
-- submission without extra lookups.
--
-- The 28c2285 inbound webhook was already querying this column on
-- the fallback path; the column simply didn't exist (the original
-- email_send_log schema only stored message_id + template_name +
-- recipient_email + status). Without it the In-Reply-To path
-- silently fails — only the +tag routing works.
--
-- send-notification (and other writers) will populate this when
-- they enqueue an outbound email so the reply path stays accurate
-- even when the dealer's outbound provider can't set Reply-To.

ALTER TABLE public.email_send_log
  ADD COLUMN IF NOT EXISTS submission_id uuid REFERENCES public.submissions(id) ON DELETE SET NULL;

COMMENT ON COLUMN public.email_send_log.submission_id IS
  'Optional FK to the submission this email relates to. Populated by send-notification + send-transactional-email at enqueue time so the inbound-email-webhook can route customer replies (via In-Reply-To header) back to the correct customer file.';

CREATE INDEX IF NOT EXISTS email_send_log_submission_idx
  ON public.email_send_log (submission_id)
  WHERE submission_id IS NOT NULL;

-- Inbound webhook also looks up by message_id; an index on that
-- column was missing too. The lookup runs once per inbound email so
-- the index pays for itself even on small tables.
CREATE INDEX IF NOT EXISTS email_send_log_message_id_idx
  ON public.email_send_log (message_id)
  WHERE message_id IS NOT NULL;

NOTIFY pgrst, 'reload schema';
