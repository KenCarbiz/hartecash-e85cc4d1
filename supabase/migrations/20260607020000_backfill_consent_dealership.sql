-- Backfill consent_log.dealership_id from the linked submission.
--
-- Consent logging never stamped the tenant, so every consent row landed
-- as the global 'default'. That mis-attributes the consent AND makes the
-- tenant-scoped data-rights export/purge miss it (export omits consent
-- proof; purge leaves consent PII behind after a right-to-delete). The
-- app now stamps dealership_id on new rows; this repairs existing ones by
-- joining on the submission_token.
--
-- Idempotent: only rows still at 'default' with a matching submission are
-- touched, so it is safe to re-run.

UPDATE public.consent_log c
SET dealership_id = s.dealership_id::text
FROM public.submissions s
WHERE c.submission_token IS NOT NULL
  AND c.submission_token = s.token
  AND c.dealership_id = 'default'
  AND s.dealership_id IS NOT NULL
  AND s.dealership_id::text <> 'default';

NOTIFY pgrst, 'reload schema';
