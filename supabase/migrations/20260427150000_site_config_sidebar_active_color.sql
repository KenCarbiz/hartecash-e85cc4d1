-- Sidebar active-item color (admin shell).
--
-- Adds a single hex string column to both the corporate site_config row
-- and the per-location override table. AppearanceSettings reads/writes
-- this and AdminSidebar inline-styles the active SidebarMenuButton with
-- it, so the highlighted left-nav item picks up the dealer's brand
-- color instead of the default accent.

ALTER TABLE public.site_config
  ADD COLUMN IF NOT EXISTS sidebar_active_color TEXT NULL;

ALTER TABLE public.dealership_locations
  ADD COLUMN IF NOT EXISTS sidebar_active_color TEXT NULL;
