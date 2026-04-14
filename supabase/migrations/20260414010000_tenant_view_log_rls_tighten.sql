-- Tighten RLS on tenant_view_log so a compromised admin session cannot
-- enumerate every other platform admin's viewing history. Admins should
-- only be able to read their own trail through the regular client.
--
-- Cross-admin compliance access is expected to go through the service
-- role (bypasses RLS) via server-side exports / dashboards, not through
-- ad-hoc queries from an authenticated admin session. If a dedicated
-- `compliance_admin` role is introduced later, add an additional
-- permissive policy scoped to that role instead of relaxing this one.

DROP POLICY IF EXISTS "tenant_view_log_select_platform_admin" ON public.tenant_view_log;

DROP POLICY IF EXISTS "tenant_view_log_select_own" ON public.tenant_view_log;
CREATE POLICY "tenant_view_log_select_own"
  ON public.tenant_view_log
  FOR SELECT
  TO authenticated
  USING (
    super_admin_user_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.user_id = auth.uid()
        AND ur.role = 'admin'
    )
  );

-- UPDATE was already owner-scoped; no change needed.
