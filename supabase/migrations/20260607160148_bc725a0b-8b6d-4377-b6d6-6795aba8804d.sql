-- Housekeeping: reconcile migration ledger + pin search_path on flagged functions.
-- Idempotent: re-running is a no-op.

-- 1) Record the four 20260607 migrations as applied without re-executing their bodies.
INSERT INTO supabase_migrations.schema_migrations (version, name, statements)
VALUES
  ('20260607000000', 'add_governing_law_state', ARRAY[]::text[]),
  ('20260607010000', 'add_legal_entity_and_license', ARRAY[]::text[]),
  ('20260607020000', 'backfill_consent_dealership', ARRAY[]::text[]),
  ('20260607030000', 'per_dealership_opt_outs', ARRAY[]::text[])
ON CONFLICT (version) DO NOTHING;

-- 2) Pin search_path on every public function flagged by the linter.
-- These are ALTERs only — function bodies are untouched.
ALTER FUNCTION public.auto_flag_subject_to_inspection()                          SET search_path = public;
ALTER FUNCTION public.data_egress_log_set_updated_at()                           SET search_path = public;
ALTER FUNCTION public.dealer_groups_set_updated_at()                             SET search_path = public;
ALTER FUNCTION public.delete_email(queue_name text, message_id bigint)           SET search_path = public;
ALTER FUNCTION public.enqueue_email(queue_name text, payload jsonb)              SET search_path = public;
ALTER FUNCTION public.licensed_states_valid(_states text[])                      SET search_path = public;
ALTER FUNCTION public.move_to_dlq(source_queue text, dlq_name text, message_id bigint, payload jsonb) SET search_path = public;
ALTER FUNCTION public.read_email_batch(queue_name text, batch_size integer, vt integer) SET search_path = public;
ALTER FUNCTION public.rooftop_activations_set_updated_at()                       SET search_path = public;
ALTER FUNCTION public.set_appointment_reschedule_token()                         SET search_path = public;
ALTER FUNCTION public.validate_dealer_account()                                  SET search_path = public;

NOTIFY pgrst, 'reload schema';