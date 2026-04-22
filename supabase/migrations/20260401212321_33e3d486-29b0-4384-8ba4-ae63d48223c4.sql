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
      AND role = 'admin'::app_role
      AND dealership_id = 'default'
  );
$$;

DROP POLICY IF EXISTS "Admins can manage tenants" ON public.tenants;
CREATE POLICY "Platform admins can manage tenants"
ON public.tenants
FOR ALL
TO authenticated
USING (public.is_platform_admin(auth.uid()))
WITH CHECK (public.is_platform_admin(auth.uid()));

DROP POLICY IF EXISTS "Admins can manage dealer accounts" ON public.dealer_accounts;
CREATE POLICY "Admins can manage tenant dealer accounts"
ON public.dealer_accounts
FOR ALL
TO authenticated
USING (
  public.is_platform_admin(auth.uid())
  OR (
    has_role(auth.uid(), 'admin'::app_role)
    AND dealership_id = public.get_user_dealership_id(auth.uid())
  )
)
WITH CHECK (
  public.is_platform_admin(auth.uid())
  OR (
    has_role(auth.uid(), 'admin'::app_role)
    AND dealership_id = public.get_user_dealership_id(auth.uid())
  )
);

DROP POLICY IF EXISTS "Admins can manage form config" ON public.form_config;
CREATE POLICY "Admins can manage tenant form config"
ON public.form_config
FOR ALL
TO authenticated
USING (
  public.is_platform_admin(auth.uid())
  OR (
    has_role(auth.uid(), 'admin'::app_role)
    AND dealership_id = public.get_user_dealership_id(auth.uid())
  )
)
WITH CHECK (
  public.is_platform_admin(auth.uid())
  OR (
    has_role(auth.uid(), 'admin'::app_role)
    AND dealership_id = public.get_user_dealership_id(auth.uid())
  )
);

DROP POLICY IF EXISTS "Admins can manage inspection config" ON public.inspection_config;
CREATE POLICY "Admins can manage tenant inspection config"
ON public.inspection_config
FOR ALL
TO authenticated
USING (
  public.is_platform_admin(auth.uid())
  OR (
    has_role(auth.uid(), 'admin'::app_role)
    AND dealership_id = public.get_user_dealership_id(auth.uid())
  )
)
WITH CHECK (
  public.is_platform_admin(auth.uid())
  OR (
    has_role(auth.uid(), 'admin'::app_role)
    AND dealership_id = public.get_user_dealership_id(auth.uid())
  )
);

DROP POLICY IF EXISTS "Admins can manage own tenant site config" ON public.site_config;
CREATE POLICY "Admins can manage tenant site config"
ON public.site_config
FOR ALL
TO authenticated
USING (
  public.is_platform_admin(auth.uid())
  OR (
    has_role(auth.uid(), 'admin'::app_role)
    AND dealership_id = public.get_user_dealership_id(auth.uid())
  )
)
WITH CHECK (
  public.is_platform_admin(auth.uid())
  OR (
    has_role(auth.uid(), 'admin'::app_role)
    AND dealership_id = public.get_user_dealership_id(auth.uid())
  )
);

DROP POLICY IF EXISTS "Admins can manage own tenant notification settings" ON public.notification_settings;
CREATE POLICY "Admins can manage tenant notification settings"
ON public.notification_settings
FOR ALL
TO authenticated
USING (
  public.is_platform_admin(auth.uid())
  OR (
    has_role(auth.uid(), 'admin'::app_role)
    AND dealership_id = public.get_user_dealership_id(auth.uid())
  )
)
WITH CHECK (
  public.is_platform_admin(auth.uid())
  OR (
    has_role(auth.uid(), 'admin'::app_role)
    AND dealership_id = public.get_user_dealership_id(auth.uid())
  )
);

DROP POLICY IF EXISTS "Admins can manage own tenant offer settings" ON public.offer_settings;
CREATE POLICY "Admins can manage tenant offer settings"
ON public.offer_settings
FOR ALL
TO authenticated
USING (
  public.is_platform_admin(auth.uid())
  OR (
    has_role(auth.uid(), 'admin'::app_role)
    AND dealership_id = public.get_user_dealership_id(auth.uid())
  )
)
WITH CHECK (
  public.is_platform_admin(auth.uid())
  OR (
    has_role(auth.uid(), 'admin'::app_role)
    AND dealership_id = public.get_user_dealership_id(auth.uid())
  )
);

DROP POLICY IF EXISTS "Admins can manage own tenant locations" ON public.dealership_locations;
CREATE POLICY "Admins can manage tenant locations"
ON public.dealership_locations
FOR ALL
TO authenticated
USING (
  public.is_platform_admin(auth.uid())
  OR (
    has_role(auth.uid(), 'admin'::app_role)
    AND dealership_id = public.get_user_dealership_id(auth.uid())
  )
)
WITH CHECK (
  public.is_platform_admin(auth.uid())
  OR (
    has_role(auth.uid(), 'admin'::app_role)
    AND dealership_id = public.get_user_dealership_id(auth.uid())
  )
);

DROP POLICY IF EXISTS "Admins can manage own tenant photo config" ON public.photo_config;
CREATE POLICY "Admins can manage tenant photo config"
ON public.photo_config
FOR ALL
TO authenticated
USING (
  public.is_platform_admin(auth.uid())
  OR (
    has_role(auth.uid(), 'admin'::app_role)
    AND dealership_id = public.get_user_dealership_id(auth.uid())
  )
)
WITH CHECK (
  public.is_platform_admin(auth.uid())
  OR (
    has_role(auth.uid(), 'admin'::app_role)
    AND dealership_id = public.get_user_dealership_id(auth.uid())
  )
);

DROP POLICY IF EXISTS "Admins can manage own tenant depth policies" ON public.depth_policies;
CREATE POLICY "Admins can manage tenant depth policies"
ON public.depth_policies
FOR ALL
TO authenticated
USING (
  public.is_platform_admin(auth.uid())
  OR (
    has_role(auth.uid(), 'admin'::app_role)
    AND dealership_id = public.get_user_dealership_id(auth.uid())
  )
)
WITH CHECK (
  public.is_platform_admin(auth.uid())
  OR (
    has_role(auth.uid(), 'admin'::app_role)
    AND dealership_id = public.get_user_dealership_id(auth.uid())
  )
);

DROP POLICY IF EXISTS "Admins can manage own tenant notification templates" ON public.notification_templates;
CREATE POLICY "Admins can manage tenant notification templates"
ON public.notification_templates
FOR ALL
TO authenticated
USING (
  public.is_platform_admin(auth.uid())
  OR (
    has_role(auth.uid(), 'admin'::app_role)
    AND dealership_id = public.get_user_dealership_id(auth.uid())
  )
)
WITH CHECK (
  public.is_platform_admin(auth.uid())
  OR (
    has_role(auth.uid(), 'admin'::app_role)
    AND dealership_id = public.get_user_dealership_id(auth.uid())
  )
);

DROP POLICY IF EXISTS "Admins can manage own tenant offer rules" ON public.offer_rules;
CREATE POLICY "Admins can manage tenant offer rules"
ON public.offer_rules
FOR ALL
TO authenticated
USING (
  public.is_platform_admin(auth.uid())
  OR (
    has_role(auth.uid(), 'admin'::app_role)
    AND dealership_id = public.get_user_dealership_id(auth.uid())
  )
)
WITH CHECK (
  public.is_platform_admin(auth.uid())
  OR (
    has_role(auth.uid(), 'admin'::app_role)
    AND dealership_id = public.get_user_dealership_id(auth.uid())
  )
);

DROP POLICY IF EXISTS "Admins can manage testimonials" ON public.testimonials;
CREATE POLICY "Admins can manage tenant testimonials"
ON public.testimonials
FOR ALL
TO authenticated
USING (
  public.is_platform_admin(auth.uid())
  OR (
    has_role(auth.uid(), 'admin'::app_role)
    AND dealership_id = public.get_user_dealership_id(auth.uid())
  )
)
WITH CHECK (
  public.is_platform_admin(auth.uid())
  OR (
    has_role(auth.uid(), 'admin'::app_role)
    AND dealership_id = public.get_user_dealership_id(auth.uid())
  )
);

DROP POLICY IF EXISTS "Admins can manage changelog entries" ON public.changelog_entries;
CREATE POLICY "Admins can manage tenant changelog entries"
ON public.changelog_entries
FOR ALL
TO authenticated
USING (
  public.is_platform_admin(auth.uid())
  OR (
    has_role(auth.uid(), 'admin'::app_role)
    AND dealership_id = public.get_user_dealership_id(auth.uid())
  )
)
WITH CHECK (
  public.is_platform_admin(auth.uid())
  OR (
    has_role(auth.uid(), 'admin'::app_role)
    AND dealership_id = public.get_user_dealership_id(auth.uid())
  )
);

INSERT INTO public.site_config (dealership_id, dealership_name)
SELECT t.dealership_id, t.display_name
FROM public.tenants t
WHERE NOT EXISTS (
  SELECT 1
  FROM public.site_config sc
  WHERE sc.dealership_id = t.dealership_id
);

UPDATE public.site_config sc
SET dealership_name = t.display_name,
    updated_at = now()
FROM public.tenants t
WHERE sc.dealership_id = t.dealership_id
  AND (sc.dealership_name IS NULL OR btrim(sc.dealership_name) = '');

INSERT INTO public.form_config (dealership_id)
SELECT t.dealership_id
FROM public.tenants t
WHERE NOT EXISTS (
  SELECT 1
  FROM public.form_config fc
  WHERE fc.dealership_id = t.dealership_id
);

INSERT INTO public.offer_settings (dealership_id)
SELECT t.dealership_id
FROM public.tenants t
WHERE NOT EXISTS (
  SELECT 1
  FROM public.offer_settings os
  WHERE os.dealership_id = t.dealership_id
);

INSERT INTO public.inspection_config (dealership_id)
SELECT t.dealership_id
FROM public.tenants t
WHERE NOT EXISTS (
  SELECT 1
  FROM public.inspection_config ic
  WHERE ic.dealership_id = t.dealership_id
);

INSERT INTO public.notification_settings (dealership_id)
SELECT t.dealership_id
FROM public.tenants t
WHERE NOT EXISTS (
  SELECT 1
  FROM public.notification_settings ns
  WHERE ns.dealership_id = t.dealership_id
);

INSERT INTO public.dealer_accounts (dealership_id)
SELECT t.dealership_id
FROM public.tenants t
WHERE NOT EXISTS (
  SELECT 1
  FROM public.dealer_accounts da
  WHERE da.dealership_id = t.dealership_id
);

INSERT INTO public.photo_config (
  dealership_id,
  shot_id,
  label,
  description,
  orientation,
  is_enabled,
  is_required,
  sort_order
)
SELECT
  t.dealership_id,
  pc.shot_id,
  pc.label,
  pc.description,
  pc.orientation,
  pc.is_enabled,
  pc.is_required,
  pc.sort_order
FROM public.tenants t
CROSS JOIN LATERAL (
  SELECT shot_id, label, description, orientation, is_enabled, is_required, sort_order
  FROM public.photo_config
  WHERE dealership_id = 'default'
) pc
WHERE t.dealership_id <> 'default'
  AND NOT EXISTS (
    SELECT 1
    FROM public.photo_config existing
    WHERE existing.dealership_id = t.dealership_id
  );