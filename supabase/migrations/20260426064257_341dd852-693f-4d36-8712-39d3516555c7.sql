CREATE OR REPLACE FUNCTION public.is_platform_admin(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = 'admin'::public.app_role
      AND dealership_id = 'default'
  );
$$;

CREATE TABLE IF NOT EXISTS public.tenant_view_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  super_admin_user_id uuid NOT NULL,
  super_admin_email text NOT NULL,
  target_dealership_id text NOT NULL,
  target_display_name text NOT NULL,
  reason text NOT NULL,
  user_agent text,
  started_at timestamptz NOT NULL DEFAULT now(),
  ended_at timestamptz,
  ended_reason text
);

ALTER TABLE public.tenant_view_log ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_tenant_view_log_super_admin_user_id
  ON public.tenant_view_log(super_admin_user_id);

CREATE INDEX IF NOT EXISTS idx_tenant_view_log_target_dealership_id
  ON public.tenant_view_log(target_dealership_id);

CREATE INDEX IF NOT EXISTS idx_tenant_view_log_started_at
  ON public.tenant_view_log(started_at DESC);

DROP POLICY IF EXISTS "Platform admins can view tenant view logs" ON public.tenant_view_log;
CREATE POLICY "Platform admins can view tenant view logs"
ON public.tenant_view_log
FOR SELECT
TO authenticated
USING (public.is_platform_admin(auth.uid()));

DROP POLICY IF EXISTS "Platform admins can create tenant view logs" ON public.tenant_view_log;
CREATE POLICY "Platform admins can create tenant view logs"
ON public.tenant_view_log
FOR INSERT
TO authenticated
WITH CHECK (
  public.is_platform_admin(auth.uid())
  AND super_admin_user_id = auth.uid()
  AND length(trim(reason)) >= 10
);

DROP POLICY IF EXISTS "Platform admins can close tenant view logs" ON public.tenant_view_log;
CREATE POLICY "Platform admins can close tenant view logs"
ON public.tenant_view_log
FOR UPDATE
TO authenticated
USING (
  public.is_platform_admin(auth.uid())
  AND super_admin_user_id = auth.uid()
)
WITH CHECK (
  public.is_platform_admin(auth.uid())
  AND super_admin_user_id = auth.uid()
);