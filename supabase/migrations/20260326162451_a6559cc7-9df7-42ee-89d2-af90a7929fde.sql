-- Store assignment config toggles
ALTER TABLE public.site_config
  ADD COLUMN assign_customer_picks boolean NOT NULL DEFAULT false,
  ADD COLUMN assign_auto_zip boolean NOT NULL DEFAULT true,
  ADD COLUMN assign_oem_brand_match boolean NOT NULL DEFAULT false,
  ADD COLUMN assign_buying_center boolean NOT NULL DEFAULT false,
  ADD COLUMN buying_center_location_id uuid REFERENCES public.dealership_locations(id) ON DELETE SET NULL;

-- OEM brand mapping for dealership locations
ALTER TABLE public.dealership_locations
  ADD COLUMN oem_brands text[] NOT NULL DEFAULT '{}';

-- Salesperson name for trade-in submissions
ALTER TABLE public.submissions
  ADD COLUMN salesperson_name text;