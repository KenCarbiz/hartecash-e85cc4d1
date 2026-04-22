ALTER TABLE public.dealership_locations
  ADD COLUMN corporate_logo_url text DEFAULT null,
  ADD COLUMN oem_logo_urls text[] NOT NULL DEFAULT '{}',
  ADD COLUMN logo_layout text NOT NULL DEFAULT 'side_by_side',
  ADD COLUMN show_corporate_logo boolean NOT NULL DEFAULT false,
  ADD COLUMN show_corporate_on_landing_only boolean NOT NULL DEFAULT false;