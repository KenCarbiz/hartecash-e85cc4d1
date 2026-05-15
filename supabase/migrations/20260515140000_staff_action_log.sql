-- staff_action_log: audit trail for high-risk staff actions that don't
-- fit the existing per-submission activity_log.
--
-- Today we already audit:
--   * activity_log         — per-submission state changes
--   * tenant_edit_log      — slug / domain edits on tenants
--   * mfa_audit_log        — MFA enroll / verify / disable
--   * customer_data_access_log — staff reads of customer PII
--   * audit_log            — billing / Stripe (suite contract, hash-chained)
--
-- The gap: staff actions that are NEITHER per-submission NOR billing,
-- e.g. role changes, rooftop merges/detaches, voice-quality manipulations
-- (marking calls golden, retiring variants), and admin RPC invocations.
-- These currently leave no trail — making postmortems hard and weakening
-- our SOC2 / state-AG posture.
--
-- Design choices:
--   * Free-form `action` text (we want low friction to add new audit
--     points; we'll standardize on snake_case verbs like
--     'staff_role_updated', 'rooftop_merged', 'voice_call_pinned_golden').
--   * before / after stored as jsonb so the diff is structured.
--   * dealership_id nullable for true platform-admin actions.
--   * IP + UA are best-effort (clients populate from headers when set).
--   * Append-only via RLS: authenticated staff insert; only platform
--     admins read (parallel to tenant_edit_log).
--
-- Idempotent.

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

-- Insert: any authenticated staff can write a row about an action they
-- performed. We rely on the application to set user_id / user_email
-- accurately; this is audit telemetry, not enforcement.
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

  -- Read: platform admins only. Per-dealer access can be added later
  -- if a customer demands it; until then the audit set is platform-only.
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

  -- Service role full access for edge functions that audit on the user's behalf.
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
