
-- Tenants table: maps domains to dealership_ids
CREATE TABLE public.tenants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  dealership_id text NOT NULL UNIQUE,
  slug text NOT NULL UNIQUE,
  display_name text NOT NULL DEFAULT '',
  custom_domain text UNIQUE,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Seed the current default tenant
INSERT INTO public.tenants (dealership_id, slug, display_name, custom_domain, is_active)
VALUES ('default', 'harte', 'Harte Auto Group', NULL, true);

-- RLS
ALTER TABLE public.tenants ENABLE ROW LEVEL SECURITY;

-- Anyone can read active tenants (needed for domain lookup before auth)
CREATE POLICY "Anyone can read active tenants" ON public.tenants
  FOR SELECT TO public USING (is_active = true);

-- Only admins can manage tenants
CREATE POLICY "Admins can manage tenants" ON public.tenants
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Fast lookup function
CREATE OR REPLACE FUNCTION public.get_tenant_by_domain(_domain text)
RETURNS TABLE(dealership_id text, slug text, display_name text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT t.dealership_id, t.slug, t.display_name
  FROM public.tenants t
  WHERE (t.custom_domain = _domain OR t.slug = _domain)
    AND t.is_active = true
  LIMIT 1;
$$;
