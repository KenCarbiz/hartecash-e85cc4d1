-- Super Admin "View as Tenant" audit log (Pattern A)
--
-- When a platform admin uses the View As Tenant control in the Super
-- Admin dashboard, their session stays authenticated as themselves
-- but the TenantContext is overridden so every query + mutation runs
-- against the target tenant's data. Every entry and exit of that
-- view mode writes a row here so the full audit trail is
-- reconstructible — who viewed which tenant, when, for how long, and
-- why.
--
-- Not to be confused with Pattern B (user-level impersonation via
-- session minting). This table tracks TENANT viewing, not identity
-- assumption. The super admin remains authenticated as themselves
-- throughout, so auth.uid() is always their user id and every
-- activity_log entry still says their email in performed_by.

CREATE TABLE IF NOT EXISTS public.tenant_view_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Initiator (the platform admin)
  super_admin_user_id uuid NOT NULL,
  super_admin_email text NOT NULL,

  -- Target tenant being viewed
  target_dealership_id text NOT NULL,
  target_display_name text NOT NULL,

  -- Context — required at entry time so every view is justified
  reason text NOT NULL,
  client_ip text,
  user_agent text,

  -- Lifecycle
  started_at timestamptz NOT NULL DEFAULT now(),
  ended_at timestamptz,
  ended_reason text, -- 'manual' | 'expired' | 'navigation_away'
  session_duration_seconds integer GENERATED ALWAYS AS (
    CASE
      WHEN ended_at IS NOT NULL THEN EXTRACT(EPOCH FROM (ended_at - started_at))::integer
      ELSE NULL
    END
  ) STORED
);

CREATE INDEX IF NOT EXISTS idx_tenant_view_log_super_admin
  ON public.tenant_view_log (super_admin_user_id, started_at DESC);

CREATE INDEX IF NOT EXISTS idx_tenant_view_log_target
  ON public.tenant_view_log (target_dealership_id, started_at DESC);

-- Open views (no ended_at) — used by the banner to detect if a view
-- is already in progress on another tab for the same user
CREATE INDEX IF NOT EXISTS idx_tenant_view_log_active
  ON public.tenant_view_log (super_admin_user_id, started_at DESC)
  WHERE ended_at IS NULL;

ALTER TABLE public.tenant_view_log ENABLE ROW LEVEL SECURITY;

-- Only platform admins can read the view audit trail
DROP POLICY IF EXISTS "tenant_view_log_select_platform_admin" ON public.tenant_view_log;
CREATE POLICY "tenant_view_log_select_platform_admin"
  ON public.tenant_view_log
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.user_id = auth.uid()
        AND ur.role = 'admin'
    )
  );

-- Platform admins write their own view entries directly. No service
-- role intermediation needed because the super admin's auth context
-- is preserved throughout the view session — this is NOT identity
-- assumption, so the regular client can write the log.
DROP POLICY IF EXISTS "tenant_view_log_insert_self" ON public.tenant_view_log;
CREATE POLICY "tenant_view_log_insert_self"
  ON public.tenant_view_log
  FOR INSERT
  TO authenticated
  WITH CHECK (
    super_admin_user_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.user_id = auth.uid()
        AND ur.role = 'admin'
    )
  );

DROP POLICY IF EXISTS "tenant_view_log_update_self" ON public.tenant_view_log;
CREATE POLICY "tenant_view_log_update_self"
  ON public.tenant_view_log
  FOR UPDATE
  TO authenticated
  USING (super_admin_user_id = auth.uid());
