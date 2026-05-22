
-- ============================================================
-- Cross-tenant RLS hardening
-- ============================================================

-- activity_log: scope by submission's dealership
DROP POLICY IF EXISTS "Staff can read activity logs" ON public.activity_log;
DROP POLICY IF EXISTS "Staff can insert activity logs" ON public.activity_log;

CREATE POLICY "Staff can read own-tenant activity logs"
ON public.activity_log FOR SELECT
USING (
  is_platform_admin(auth.uid())
  OR (
    is_staff(auth.uid())
    AND submission_id IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM public.submissions s
      WHERE s.id = activity_log.submission_id
        AND s.dealership_id = get_user_dealership_id(auth.uid())
    )
  )
);

CREATE POLICY "Staff can insert own-tenant activity logs"
ON public.activity_log FOR INSERT
WITH CHECK (
  is_platform_admin(auth.uid())
  OR (
    is_staff(auth.uid())
    AND submission_id IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM public.submissions s
      WHERE s.id = activity_log.submission_id
        AND s.dealership_id = get_user_dealership_id(auth.uid())
    )
  )
);

-- conversation_events: drop admin escape hatch; require own-tenant for everyone except platform admin
DROP POLICY IF EXISTS "Staff read own-dealership conversation events" ON public.conversation_events;
DROP POLICY IF EXISTS "Staff insert own-dealership conversation events" ON public.conversation_events;

CREATE POLICY "Staff read own-dealership conversation events"
ON public.conversation_events FOR SELECT
USING (
  is_platform_admin(auth.uid())
  OR dealership_id = get_user_dealership_id(auth.uid())
);

CREATE POLICY "Staff insert own-dealership conversation events"
ON public.conversation_events FOR INSERT
WITH CHECK (
  is_platform_admin(auth.uid())
  OR dealership_id = get_user_dealership_id(auth.uid())
);

-- opt_outs SELECT: scope via submission
DROP POLICY IF EXISTS "Staff can read opt-outs" ON public.opt_outs;

CREATE POLICY "Staff can read own-tenant opt-outs"
ON public.opt_outs FOR SELECT
USING (
  is_platform_admin(auth.uid())
  OR (
    is_staff(auth.uid())
    AND submission_id IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM public.submissions s
      WHERE s.id = opt_outs.submission_id
        AND s.dealership_id = get_user_dealership_id(auth.uid())
    )
  )
);

-- mfa_enforcement_config: scope staff read by dealership
DROP POLICY IF EXISTS "Staff read mfa_enf_cfg" ON public.mfa_enforcement_config;
CREATE POLICY "Staff read own-tenant mfa_enf_cfg"
ON public.mfa_enforcement_config FOR SELECT
USING (
  is_platform_admin(auth.uid())
  OR (is_staff(auth.uid()) AND dealership_id = get_user_dealership_id(auth.uid()))
);

-- pii_retention_config: scope staff read by dealership
DROP POLICY IF EXISTS "Staff read pii_retention_config" ON public.pii_retention_config;
CREATE POLICY "Staff read own-tenant pii_retention_config"
ON public.pii_retention_config FOR SELECT
USING (
  is_platform_admin(auth.uid())
  OR (is_staff(auth.uid()) AND dealership_id = get_user_dealership_id(auth.uid()))
);

-- offer_approval_requests: drop admin-without-tenant escape
DROP POLICY IF EXISTS "Staff read own tenant offer approvals" ON public.offer_approval_requests;
DROP POLICY IF EXISTS "Staff insert own tenant offer approvals" ON public.offer_approval_requests;

CREATE POLICY "Staff read own tenant offer approvals"
ON public.offer_approval_requests FOR SELECT
USING (
  is_platform_admin(auth.uid())
  OR (is_staff(auth.uid()) AND dealership_id = get_user_dealership_id(auth.uid()))
);

CREATE POLICY "Staff insert own tenant offer approvals"
ON public.offer_approval_requests FOR INSERT
WITH CHECK (
  is_platform_admin(auth.uid())
  OR (is_staff(auth.uid()) AND dealership_id = get_user_dealership_id(auth.uid()))
);

-- staff_action_log: tenant admins limited to own dealership
DROP POLICY IF EXISTS "staff_action_log_admin_read" ON public.staff_action_log;
CREATE POLICY "staff_action_log_admin_read"
ON public.staff_action_log FOR SELECT
USING (
  is_platform_admin(auth.uid())
  OR (
    has_role(auth.uid(), 'admin'::app_role)
    AND dealership_id IS NOT NULL
    AND dealership_id = get_user_dealership_id(auth.uid())
  )
);

-- staff_permission_assignments: admins scoped to users in their dealership
DROP POLICY IF EXISTS "Admins can manage assignments" ON public.staff_permission_assignments;
DROP POLICY IF EXISTS "Admins can read all assignments" ON public.staff_permission_assignments;

CREATE POLICY "Admins manage own-tenant assignments"
ON public.staff_permission_assignments FOR ALL
USING (
  is_platform_admin(auth.uid())
  OR (
    has_role(auth.uid(), 'admin'::app_role)
    AND EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.user_id = staff_permission_assignments.user_id
        AND ur.dealership_id = get_user_dealership_id(auth.uid())
    )
  )
)
WITH CHECK (
  is_platform_admin(auth.uid())
  OR (
    has_role(auth.uid(), 'admin'::app_role)
    AND EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.user_id = staff_permission_assignments.user_id
        AND ur.dealership_id = get_user_dealership_id(auth.uid())
    )
  )
);

CREATE POLICY "Admins read own-tenant assignments"
ON public.staff_permission_assignments FOR SELECT
USING (
  is_platform_admin(auth.uid())
  OR (
    has_role(auth.uid(), 'admin'::app_role)
    AND EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.user_id = staff_permission_assignments.user_id
        AND ur.dealership_id = get_user_dealership_id(auth.uid())
    )
  )
);

-- submission_notes: scope via submission
DROP POLICY IF EXISTS "Staff can read submission notes" ON public.submission_notes;
DROP POLICY IF EXISTS "Staff can insert submission notes" ON public.submission_notes;
DROP POLICY IF EXISTS "Staff can delete their own submission notes" ON public.submission_notes;

CREATE POLICY "Staff can read own-tenant submission notes"
ON public.submission_notes FOR SELECT
USING (
  is_platform_admin(auth.uid())
  OR (
    is_staff(auth.uid())
    AND EXISTS (
      SELECT 1 FROM public.submissions s
      WHERE s.id = submission_notes.submission_id
        AND s.dealership_id = get_user_dealership_id(auth.uid())
    )
  )
);

CREATE POLICY "Staff can insert own-tenant submission notes"
ON public.submission_notes FOR INSERT
WITH CHECK (
  is_platform_admin(auth.uid())
  OR (
    is_staff(auth.uid())
    AND EXISTS (
      SELECT 1 FROM public.submissions s
      WHERE s.id = submission_notes.submission_id
        AND s.dealership_id = get_user_dealership_id(auth.uid())
    )
  )
);

CREATE POLICY "Staff can delete own-tenant submission notes"
ON public.submission_notes FOR DELETE
USING (
  is_platform_admin(auth.uid())
  OR (
    is_staff(auth.uid())
    AND EXISTS (
      SELECT 1 FROM public.submissions s
      WHERE s.id = submission_notes.submission_id
        AND s.dealership_id = get_user_dealership_id(auth.uid())
    )
  )
);

-- tenant_edit_log
DROP POLICY IF EXISTS "tenant_edit_log_admin_read" ON public.tenant_edit_log;
DROP POLICY IF EXISTS "tenant_edit_log_admin_write" ON public.tenant_edit_log;

CREATE POLICY "tenant_edit_log_admin_read"
ON public.tenant_edit_log FOR SELECT
USING (
  is_platform_admin(auth.uid())
  OR (
    has_role(auth.uid(), 'admin'::app_role)
    AND dealership_id = get_user_dealership_id(auth.uid())
  )
);

CREATE POLICY "tenant_edit_log_admin_write"
ON public.tenant_edit_log FOR INSERT
WITH CHECK (
  is_platform_admin(auth.uid())
  OR (
    has_role(auth.uid(), 'admin'::app_role)
    AND dealership_id = get_user_dealership_id(auth.uid())
  )
);

-- pending_admin_requests: scope by target user's dealership
DROP POLICY IF EXISTS "Admins can read all requests" ON public.pending_admin_requests;
DROP POLICY IF EXISTS "Admins can update requests" ON public.pending_admin_requests;

CREATE POLICY "Admins read own-tenant pending admin requests"
ON public.pending_admin_requests FOR SELECT
USING (
  is_platform_admin(auth.uid())
  OR (
    has_role(auth.uid(), 'admin'::app_role)
    AND EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.user_id = pending_admin_requests.user_id
        AND ur.dealership_id = get_user_dealership_id(auth.uid())
    )
  )
);

CREATE POLICY "Admins update own-tenant pending admin requests"
ON public.pending_admin_requests FOR UPDATE
USING (
  is_platform_admin(auth.uid())
  OR (
    has_role(auth.uid(), 'admin'::app_role)
    AND EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.user_id = pending_admin_requests.user_id
        AND ur.dealership_id = get_user_dealership_id(auth.uid())
    )
  )
);

-- permission_access_requests: same pattern
DROP POLICY IF EXISTS "Admins can read all requests" ON public.permission_access_requests;
DROP POLICY IF EXISTS "Admins can update requests" ON public.permission_access_requests;

CREATE POLICY "Admins read own-tenant permission requests"
ON public.permission_access_requests FOR SELECT
USING (
  is_platform_admin(auth.uid())
  OR (
    has_role(auth.uid(), 'admin'::app_role)
    AND EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.user_id = permission_access_requests.user_id
        AND ur.dealership_id = get_user_dealership_id(auth.uid())
    )
  )
);

CREATE POLICY "Admins update own-tenant permission requests"
ON public.permission_access_requests FOR UPDATE
USING (
  is_platform_admin(auth.uid())
  OR (
    has_role(auth.uid(), 'admin'::app_role)
    AND EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.user_id = permission_access_requests.user_id
        AND ur.dealership_id = get_user_dealership_id(auth.uid())
    )
  )
);

-- storage.objects: scope submission-photos & customer-documents to caller's dealership via token
DROP POLICY IF EXISTS "Staff can view all storage" ON storage.objects;
DROP POLICY IF EXISTS "Admins can delete customer documents" ON storage.objects;
DROP POLICY IF EXISTS "Admins can delete submission photos" ON storage.objects;

CREATE POLICY "Staff can view own-tenant storage"
ON storage.objects FOR SELECT
USING (
  bucket_id = ANY (ARRAY['submission-photos'::text, 'customer-documents'::text])
  AND (
    is_platform_admin(auth.uid())
    OR (
      is_staff(auth.uid())
      AND EXISTS (
        SELECT 1 FROM public.submissions s
        WHERE s.token = (storage.foldername(name))[1]
          AND s.dealership_id = get_user_dealership_id(auth.uid())
      )
    )
  )
);

CREATE POLICY "Admins can delete own-tenant customer documents"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'customer-documents'::text
  AND (
    is_platform_admin(auth.uid())
    OR (
      has_role(auth.uid(), 'admin'::app_role)
      AND EXISTS (
        SELECT 1 FROM public.submissions s
        WHERE s.token = (storage.foldername(name))[1]
          AND s.dealership_id = get_user_dealership_id(auth.uid())
      )
    )
  )
);

CREATE POLICY "Admins can delete own-tenant submission photos"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'submission-photos'::text
  AND (
    is_platform_admin(auth.uid())
    OR (
      has_role(auth.uid(), 'admin'::app_role)
      AND EXISTS (
        SELECT 1 FROM public.submissions s
        WHERE s.token = (storage.foldername(name))[1]
          AND s.dealership_id = get_user_dealership_id(auth.uid())
      )
    )
  )
);

NOTIFY pgrst, 'reload schema';
