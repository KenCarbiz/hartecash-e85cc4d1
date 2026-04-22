
-- Add missing columns to dealer_subscriptions
ALTER TABLE public.dealer_subscriptions
  ADD COLUMN IF NOT EXISTS tier_ids text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS rooftop_count integer NOT NULL DEFAULT 1;

-- Add missing columns to platform_products
ALTER TABLE public.platform_products
  ADD COLUMN IF NOT EXISTS is_available_for_new_subs boolean NOT NULL DEFAULT true;

-- Add missing columns to platform_bundles
ALTER TABLE public.platform_bundles
  ADD COLUMN IF NOT EXISTS is_enterprise boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS is_available_for_new_subs boolean NOT NULL DEFAULT true;

-- Create platform_product_tiers table
CREATE TABLE IF NOT EXISTS public.platform_product_tiers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES public.platform_products(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  monthly_price numeric NOT NULL DEFAULT 0,
  annual_price numeric,
  features text[] NOT NULL DEFAULT '{}',
  inventory_limit integer,
  included_with_product_ids text[] NOT NULL DEFAULT '{}',
  is_introductory boolean NOT NULL DEFAULT false,
  is_active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  allow_overage boolean NOT NULL DEFAULT false,
  overage_price_per_unit numeric,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.platform_product_tiers ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Anyone can read product tiers"
  ON public.platform_product_tiers FOR SELECT USING (true);

CREATE POLICY "Platform admins can manage product tiers"
  ON public.platform_product_tiers FOR ALL
  TO authenticated
  USING (is_platform_admin(auth.uid()))
  WITH CHECK (is_platform_admin(auth.uid()));

-- Reload schema cache
NOTIFY pgrst, 'reload schema';
