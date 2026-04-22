
-- 1. Add location_id to tenants
ALTER TABLE public.tenants
  ADD COLUMN IF NOT EXISTS location_id uuid REFERENCES public.dealership_locations(id) ON DELETE SET NULL;

-- 2. Add override fields to dealership_locations
ALTER TABLE public.dealership_locations
  ADD COLUMN IF NOT EXISTS phone text DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS email text DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS website_url text DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS logo_url text DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS logo_white_url text DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS favicon_url text DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS primary_color text DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS accent_color text DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS success_color text DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS tagline text DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS hero_headline text DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS hero_subtext text DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS hero_layout text DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS service_hero_headline text DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS service_hero_subtext text DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS trade_hero_headline text DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS trade_hero_subtext text DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS business_hours jsonb DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS facebook_url text DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS instagram_url text DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS google_review_url text DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS tiktok_url text DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS youtube_url text DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS stats_cars_purchased text DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS stats_years_in_business text DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS stats_rating text DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS stats_reviews_count text DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS price_guarantee_days integer DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS dealership_name text DEFAULT NULL;

-- 3. Drop old function (return type changed)
DROP FUNCTION IF EXISTS public.get_tenant_by_domain(text);

-- 4. Recreate with location_id
CREATE FUNCTION public.get_tenant_by_domain(_domain text)
 RETURNS TABLE(dealership_id text, slug text, display_name text, location_id uuid)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $$
  SELECT t.dealership_id, t.slug, t.display_name, t.location_id
  FROM public.tenants t
  WHERE (t.custom_domain = _domain OR t.slug = _domain)
    AND t.is_active = true
  LIMIT 1;
$$;
