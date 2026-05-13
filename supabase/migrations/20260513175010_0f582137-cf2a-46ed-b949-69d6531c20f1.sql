
CREATE TABLE IF NOT EXISTS public.tenant_edit_log (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id       uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    dealership_id   text,
    field           text NOT NULL,
    old_value       text,
    new_value       text,
    performed_by_email  text,
    performed_by_user_id uuid,
    created_at      timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT tenant_edit_log_field_check CHECK (
        field IN ('slug', 'custom_domain', 'subdomain_label', 'parent_domain')
    )
);

CREATE INDEX IF NOT EXISTS tenant_edit_log_tenant_id_idx
    ON public.tenant_edit_log (tenant_id, created_at DESC);

CREATE INDEX IF NOT EXISTS tenant_edit_log_dealership_id_idx
    ON public.tenant_edit_log (dealership_id, created_at DESC);

ALTER TABLE public.tenant_edit_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_edit_log_admin_read ON public.tenant_edit_log;
DROP POLICY IF EXISTS tenant_edit_log_admin_write ON public.tenant_edit_log;

CREATE POLICY tenant_edit_log_admin_read
    ON public.tenant_edit_log
    FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.user_roles
            WHERE user_id = auth.uid()
              AND (is_platform_admin = true OR role = 'admin')
        )
    );

CREATE POLICY tenant_edit_log_admin_write
    ON public.tenant_edit_log
    FOR INSERT
    TO authenticated
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.user_roles
            WHERE user_id = auth.uid()
              AND (is_platform_admin = true OR role = 'admin')
        )
    );

NOTIFY pgrst, 'reload schema';
