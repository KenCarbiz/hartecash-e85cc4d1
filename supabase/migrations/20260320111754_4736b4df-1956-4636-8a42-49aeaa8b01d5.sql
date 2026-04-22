CREATE TABLE public.site_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  dealership_id text NOT NULL DEFAULT 'default',
  dealership_name text NOT NULL DEFAULT 'Harte Auto Group',
  tagline text NOT NULL DEFAULT 'Sell Your Car The Easy Way',
  phone text DEFAULT '',
  email text DEFAULT '',
  address text DEFAULT '',
  website_url text DEFAULT '',
  logo_url text DEFAULT '',
  logo_white_url text DEFAULT '',
  favicon_url text DEFAULT '',
  primary_color text NOT NULL DEFAULT '213 80% 20%',
  accent_color text NOT NULL DEFAULT '0 80% 50%',
  success_color text NOT NULL DEFAULT '142 71% 45%',
  hero_headline text NOT NULL DEFAULT 'Sell Your Car The Easy Way',
  hero_subtext text NOT NULL DEFAULT 'Get a top-dollar cash offer in 2 minutes. No haggling, no stress.',
  price_guarantee_days integer NOT NULL DEFAULT 8,
  stats_cars_purchased text DEFAULT '14,721+',
  stats_years_in_business text DEFAULT '78 yrs',
  stats_rating text DEFAULT '4.9',
  stats_reviews_count text DEFAULT '2,400+',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(dealership_id)
);

ALTER TABLE public.site_config ENABLE ROW LEVEL SECURITY;

-- Anyone can read site config (needed for public pages)
CREATE POLICY "Anyone can read site config"
ON public.site_config FOR SELECT
TO public
USING (true);

-- Only admins can manage site config
CREATE POLICY "Admins can manage site config"
ON public.site_config FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Insert default row
INSERT INTO public.site_config (dealership_id) VALUES ('default');