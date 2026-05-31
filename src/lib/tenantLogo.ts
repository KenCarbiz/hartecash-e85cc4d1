// Single source of truth for the AutoCurb brand logo + tenant-logo
// resolution, shared by the customer portal and the customer journey so
// the same logo shows in every location.

/** Vector autoCURB wordmark, served from /public. */
export const AUTOCURB_LOGO = "/brand/autocurb/autocurb-logo.svg";

interface BrandConfig {
  logo_url?: string;
  dealership_name?: string;
}

/**
 * Resolve the brand logo src for a tenant:
 *   1. the tenant's own uploaded logo (config.logo_url) — white-label;
 *   2. else the AutoCurb wordmark for the AutoCurb tenant;
 *   3. else "" so the caller falls back to rendering the tenant name.
 */
export function tenantLogoSrc(config: BrandConfig, fallbackName = ""): string {
  const raw = config.logo_url;
  if (raw) {
    return raw.includes("supabase.co/storage/")
      ? `${raw}?width=280&resize=contain&quality=80&format=origin`
      : raw;
  }
  const norm = (config.dealership_name || fallbackName || "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
  return norm.includes("autocurb") ? AUTOCURB_LOGO : "";
}
