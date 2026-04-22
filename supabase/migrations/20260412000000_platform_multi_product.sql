-- Multi-product platform infrastructure for the Autocurb ecosystem
-- Products: Autocurb, Clear Deal, AutoFrame, Video MPI

-- Product catalog
CREATE TABLE IF NOT EXISTS public.platform_products (
  id text PRIMARY KEY, -- 'autocurb', 'cleardeal', 'autoframe', 'video_mpi'
  name text NOT NULL,
  description text,
  icon_name text, -- lucide icon name
  base_url text, -- e.g., 'https://autocurb.io', 'https://cleardeal.autocurb.io'
  is_active boolean DEFAULT true,
  sort_order int DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Seed the 4 products
INSERT INTO public.platform_products (id, name, description, icon_name, base_url, sort_order) VALUES
  ('autocurb', 'Autocurb', 'Off-street vehicle acquisition — instant offers, inspections, appraisals', 'Car', 'https://autocurb.io', 1),
  ('cleardeal', 'Clear Deal', 'Window stickers & FTC-compliant addendum signing platform', 'FileCheck', 'https://cleardeal.autocurb.io', 2),
  ('autoframe', 'AutoFrame', 'AI-powered vehicle photography — background removal, consistent lighting', 'Camera', 'https://autoframe.autocurb.io', 3),
  ('video_mpi', 'Video MPI', 'Customer video walkarounds & multi-point inspection for service', 'Video', 'https://video.autocurb.io', 4)
ON CONFLICT (id) DO NOTHING;

-- Bundle/pricing catalog
CREATE TABLE IF NOT EXISTS public.platform_bundles (
  id text PRIMARY KEY,
  name text NOT NULL,
  description text,
  monthly_price numeric NOT NULL,
  annual_price numeric, -- discount for annual
  product_ids text[] NOT NULL, -- array of product IDs included
  is_featured boolean DEFAULT false,
  sort_order int DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Seed bundles
INSERT INTO public.platform_bundles (id, name, description, monthly_price, annual_price, product_ids, is_featured, sort_order) VALUES
  ('starter', 'Starter', 'Autocurb acquisition + Clear Deal Stickers (free with Autocurb)', 1495, 14950, ARRAY['autocurb', 'cleardeal'], false, 1),
  ('growth', 'Growth', 'Full acquisition stack + AutoFrame photography', 1695, 16950, ARRAY['autocurb', 'cleardeal', 'autoframe'], true, 2),
  ('enterprise', 'Enterprise', 'All 4 products + DMS integration + priority support', 1995, 19950, ARRAY['autocurb', 'cleardeal', 'autoframe', 'video_mpi'], false, 3)
ON CONFLICT (id) DO NOTHING;

-- Dealer product subscriptions (which dealer has which products)
CREATE TABLE IF NOT EXISTS public.dealer_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  dealership_id uuid NOT NULL,
  bundle_id text REFERENCES public.platform_bundles(id),
  product_ids text[] NOT NULL DEFAULT '{}', -- actual active products (may differ from bundle if custom)
  status text NOT NULL DEFAULT 'active', -- active, trial, suspended, cancelled
  trial_ends_at timestamptz,
  billing_cycle text DEFAULT 'monthly', -- monthly, annual
  monthly_amount numeric,
  started_at timestamptz NOT NULL DEFAULT now(),
  cancelled_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(dealership_id)
);

CREATE INDEX idx_dealer_subscriptions_dealership ON public.dealer_subscriptions(dealership_id);

-- RLS
ALTER TABLE public.platform_products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.platform_bundles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dealer_subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read products" ON public.platform_products FOR SELECT USING (true);
CREATE POLICY "Anyone can read bundles" ON public.platform_bundles FOR SELECT USING (true);
CREATE POLICY "Staff can read subscriptions" ON public.dealer_subscriptions FOR SELECT USING (true);
CREATE POLICY "Admin can manage subscriptions" ON public.dealer_subscriptions FOR ALL USING (true);
