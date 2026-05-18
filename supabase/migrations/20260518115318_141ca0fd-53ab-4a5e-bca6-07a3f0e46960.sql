-- Migration 2: processed_webhook_calls
CREATE TABLE IF NOT EXISTS public.processed_webhook_calls (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider text NOT NULL,
  provider_call_id text NOT NULL,
  payload_hash text NOT NULL,
  processed_at timestamptz NOT NULL DEFAULT now(),
  call_log_id uuid NULL,
  CONSTRAINT processed_webhook_calls_unique
    UNIQUE (provider, provider_call_id, payload_hash)
);

CREATE INDEX IF NOT EXISTS processed_webhook_calls_processed_at_idx
  ON public.processed_webhook_calls (processed_at);

COMMENT ON TABLE public.processed_webhook_calls IS
  'Dedupe ledger for inbound provider webhooks (Bland, Twilio). Handlers attempt INSERT with (provider, provider_call_id, payload_hash); ON CONFLICT they short-circuit and return 200. Prevents replay-induced double-counts, double-SMS, and resurrected opt-outs.';

ALTER TABLE public.processed_webhook_calls ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS processed_webhook_calls_service_only ON public.processed_webhook_calls;
CREATE POLICY processed_webhook_calls_service_only
  ON public.processed_webhook_calls
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Migration 3: staff_action_log
CREATE TABLE IF NOT EXISTS public.staff_action_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  dealership_id text,
  user_id uuid,
  user_email text,
  action text NOT NULL,
  target_type text,
  target_id text,
  before jsonb,
  after jsonb,
  notes text,
  ip_address inet,
  user_agent text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS staff_action_log_dealership_created_idx
  ON public.staff_action_log (dealership_id, created_at DESC);
CREATE INDEX IF NOT EXISTS staff_action_log_user_created_idx
  ON public.staff_action_log (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS staff_action_log_action_idx
  ON public.staff_action_log (action, created_at DESC);
CREATE INDEX IF NOT EXISTS staff_action_log_target_idx
  ON public.staff_action_log (target_type, target_id);

ALTER TABLE public.staff_action_log ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'staff_action_log'
      AND policyname = 'staff_action_log_authenticated_insert'
  ) THEN
    CREATE POLICY staff_action_log_authenticated_insert
      ON public.staff_action_log
      FOR INSERT
      TO authenticated
      WITH CHECK (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'staff_action_log'
      AND policyname = 'staff_action_log_admin_read'
  ) THEN
    CREATE POLICY staff_action_log_admin_read
      ON public.staff_action_log
      FOR SELECT
      TO authenticated
      USING (
        EXISTS (
          SELECT 1 FROM public.user_roles ur
          WHERE ur.user_id = auth.uid()
            AND (ur.is_platform_admin = true OR ur.role = 'admin')
        )
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'staff_action_log'
      AND policyname = 'staff_action_log_service_all'
  ) THEN
    CREATE POLICY staff_action_log_service_all
      ON public.staff_action_log
      FOR ALL
      TO service_role
      USING (true)
      WITH CHECK (true);
  END IF;
END$$;

COMMENT ON TABLE public.staff_action_log IS
  'Audit trail for high-risk staff actions outside the per-submission activity_log: role changes, rooftop merges/detaches, voice-quality manipulations, admin RPC invocations. Append-only; reads gated to platform admins.';

NOTIFY pgrst, 'reload schema';