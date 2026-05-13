-- Audit trail for inline tenant edits (slug, custom_domain, subdomain_label,
-- parent_domain) from the Dealer Tenants admin page. Mirrors the structure
-- of tenant_view_log so the UnifiedAuditLog component can render both
-- streams side-by-side.
--
-- We log the field name, the before/after values, and who did it. Old values
-- are nullable because creates have no prior state.
--
-- Idempotent per CLAUDE.md.

CREATE TABLE IF NOT EXISTS tenant_edit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  dealership_id text NOT NULL,
  field text NOT NULL CHECK (field IN ('slug', 'custom_domain', 'subdomain_label', 'parent_domain')),
  old_value text,
  new_value text,
  performed_by_email text,
  performed_by_user_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS tenant_edit_log_tenant_id_idx ON tenant_edit_log (tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS tenant_edit_log_dealership_id_idx ON tenant_edit_log (dealership_id, created_at DESC);

ALTER TABLE tenant_edit_log ENABLE ROW LEVEL SECURITY;

-- Read access: platform admins only. Per project convention, the
-- "platform super admin" is either user_roles.is_platform_admin = true
-- OR user_roles.role = 'admin' on dealership_id = 'default'. There is
-- no 'super_admin' value in the app_role enum.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'tenant_edit_log' AND policyname = 'tenant_edit_log_admin_read'
  ) THEN
    CREATE POLICY tenant_edit_log_admin_read ON tenant_edit_log
      FOR SELECT
      TO authenticated
      USING (
        EXISTS (
          SELECT 1 FROM user_roles ur
          WHERE ur.user_id = auth.uid()
            AND (ur.is_platform_admin = true OR ur.role = 'admin')
        )
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'tenant_edit_log' AND policyname = 'tenant_edit_log_admin_write'
  ) THEN
    CREATE POLICY tenant_edit_log_admin_write ON tenant_edit_log
      FOR INSERT
      TO authenticated
      WITH CHECK (
        EXISTS (
          SELECT 1 FROM user_roles ur
          WHERE ur.user_id = auth.uid()
            AND (ur.is_platform_admin = true OR ur.role = 'admin')
        )
      );
  END IF;
END$$;

COMMENT ON TABLE tenant_edit_log IS
  'Audit trail for inline edits to tenants.slug, tenants.custom_domain, tenants.subdomain_label, and tenants.parent_domain made from the Dealer Tenants admin page. Surfaced by UnifiedAuditLog.';

NOTIFY pgrst, 'reload schema';
