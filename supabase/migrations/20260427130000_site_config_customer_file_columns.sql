-- Add customer-file branding columns to site_config (tenant defaults).
--
-- PR #36 added these to dealership_locations for per-location overrides
-- but missed the corresponding tenant-default columns on site_config,
-- which made the Tweaks panel's "tenant default" writes silently fail.

ALTER TABLE public.site_config
  ADD COLUMN IF NOT EXISTS customer_file_header_layout TEXT NULL
    CHECK (customer_file_header_layout IS NULL OR customer_file_header_layout IN ('a', 'b', 'c'));

ALTER TABLE public.site_config
  ADD COLUMN IF NOT EXISTS customer_file_messaging TEXT NULL
    CHECK (customer_file_messaging IS NULL OR customer_file_messaging IN ('tabs', 'unified'));
