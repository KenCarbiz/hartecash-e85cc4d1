-- Heal migration: ensure customer_file_header_layout + accent columns
-- exist on site_config and dealership_locations, and force PostgREST
-- to reload its schema cache.
--
-- The original adds (20260427120000_site_config_per_location.sql,
-- 20260427130000_site_config_customer_file_columns.sql) are idempotent
-- but environments where they were partially applied or where the
-- PostgREST cache went stale produce errors like:
--
--   Could not find the 'customer_file_header_layout' column of
--   'site_config' in the schema cache
--
-- Re-applying with IF NOT EXISTS is a no-op on healthy DBs; on broken
-- ones it heals. The NOTIFY at the end forces PostgREST to drop its
-- cache so the next REST call sees the columns immediately.

ALTER TABLE public.site_config
  ADD COLUMN IF NOT EXISTS customer_file_header_layout text NULL
    CHECK (customer_file_header_layout IS NULL OR customer_file_header_layout IN ('a', 'b', 'c')),
  ADD COLUMN IF NOT EXISTS customer_file_accent text NULL,
  ADD COLUMN IF NOT EXISTS customer_file_accent_2 text NULL,
  ADD COLUMN IF NOT EXISTS sidebar_active_color text NULL;

ALTER TABLE public.dealership_locations
  ADD COLUMN IF NOT EXISTS customer_file_header_layout text NULL
    CHECK (customer_file_header_layout IS NULL OR customer_file_header_layout IN ('a', 'b', 'c')),
  ADD COLUMN IF NOT EXISTS customer_file_accent text NULL,
  ADD COLUMN IF NOT EXISTS customer_file_accent_2 text NULL,
  ADD COLUMN IF NOT EXISTS sidebar_active_color text NULL;

-- Force PostgREST to reload its schema cache so the columns become
-- visible to REST clients without restarting the service. PostgREST
-- listens for this signal on the `pgrst` channel.
NOTIFY pgrst, 'reload schema';
