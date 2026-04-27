-- Multi-location branding foundation
--
-- The per-location override pattern already exists: `useSiteConfig` reads the
-- corporate row from `site_config`, then merges any non-null fields from the
-- matching `dealership_locations` row. This migration extends that override
-- surface with the customer-file and Tweaks-panel branding fields that were
-- added after the initial multi-location work, so each location can carry its
-- own customer-file layout / theme / top-bar look.
--
-- Tenant types (single_store / single_store_secondary / multi_location /
-- dealer_group / enterprise) are already captured during onboarding via
-- `tenants.architecture` — no schema change needed there. UI affordances
-- (location selector visibility, "Apply to all" button, bulk-apply across
-- rooftops) read that field at render time.

-- Customer-file branding overrides (per location)
ALTER TABLE public.dealership_locations
  ADD COLUMN IF NOT EXISTS file_layout TEXT NULL
    CHECK (file_layout IS NULL OR file_layout IN ('classic', 'conversation'));

ALTER TABLE public.dealership_locations
  ADD COLUMN IF NOT EXISTS customer_file_header_layout TEXT NULL
    CHECK (customer_file_header_layout IS NULL OR customer_file_header_layout IN ('a', 'b', 'c'));

ALTER TABLE public.dealership_locations
  ADD COLUMN IF NOT EXISTS customer_file_accent TEXT NULL;

ALTER TABLE public.dealership_locations
  ADD COLUMN IF NOT EXISTS customer_file_accent_2 TEXT NULL;

ALTER TABLE public.dealership_locations
  ADD COLUMN IF NOT EXISTS customer_file_messaging TEXT NULL
    CHECK (customer_file_messaging IS NULL OR customer_file_messaging IN ('tabs', 'unified'));

-- Top-bar / shell branding overrides (per location)
ALTER TABLE public.dealership_locations
  ADD COLUMN IF NOT EXISTS top_bar_style TEXT NULL
    CHECK (top_bar_style IS NULL OR top_bar_style IN ('solid', 'gradient', 'gradient-diagonal', 'gradient-3stop'));

ALTER TABLE public.dealership_locations
  ADD COLUMN IF NOT EXISTS top_bar_bg TEXT NULL;

ALTER TABLE public.dealership_locations
  ADD COLUMN IF NOT EXISTS top_bar_bg_2 TEXT NULL;

ALTER TABLE public.dealership_locations
  ADD COLUMN IF NOT EXISTS top_bar_text TEXT NULL;

ALTER TABLE public.dealership_locations
  ADD COLUMN IF NOT EXISTS top_bar_height INTEGER NULL;

ALTER TABLE public.dealership_locations
  ADD COLUMN IF NOT EXISTS top_bar_shimmer BOOLEAN NULL;

ALTER TABLE public.dealership_locations
  ADD COLUMN IF NOT EXISTS top_bar_shimmer_style TEXT NULL;

ALTER TABLE public.dealership_locations
  ADD COLUMN IF NOT EXISTS top_bar_shimmer_speed NUMERIC NULL;

-- UI / text / content scale overrides (per location)
ALTER TABLE public.dealership_locations
  ADD COLUMN IF NOT EXISTS ui_scale INTEGER NULL;

ALTER TABLE public.dealership_locations
  ADD COLUMN IF NOT EXISTS text_scale INTEGER NULL;

ALTER TABLE public.dealership_locations
  ADD COLUMN IF NOT EXISTS main_content_scale INTEGER NULL;
