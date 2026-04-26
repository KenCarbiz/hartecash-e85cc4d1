import { useSiteConfig } from "./useSiteConfig";

/**
 * Per-tenant kill switch for the refreshed admin UI.
 *
 * Reads `site_config.ui_refresh_enabled` (added in
 * supabase/migrations/20260425120000_ui_refresh_flag.sql) and returns a
 * single boolean that refreshed components consult at the top of their
 * render to decide whether to delegate to the legacy implementation.
 *
 * Defaults to false: dealers opt in. Toggled by platform admins from
 * System Settings while tenant-overriding into the dealer.
 *
 * The cast to `any` is intentional — the SiteConfig interface in
 * useSiteConfig.ts predates this column and we don't want to widen the
 * shared type from inside a feature-flag hook. The DEFAULTS object in
 * useSiteConfig.ts also doesn't seed this key, so an undefined value
 * (legacy tenants whose row pre-dates the migration) coerces to false
 * via Boolean(...), which matches the migration's DEFAULT false.
 */
export const useUIRefresh = (): boolean => {
  const { config } = useSiteConfig();
  return Boolean((config as any).ui_refresh_enabled);
};
