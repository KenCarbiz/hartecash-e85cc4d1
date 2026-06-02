// Single source of truth for the AutoCurb brand logo + tenant-logo
// resolution, shared by the landing header, the customer journey, and
// the customer portal so the same logo shows in every location.

/** Vector autoCURB wordmark, served from /public. */
export const AUTOCURB_LOGO = "/brand/autocurb/autocurb-logo.svg";

interface BrandConfig {
  logo_url?: string;
  dealership_name?: string;
}

/** True when the tenant is AutoCurb — matched against BOTH the site
 *  config name and a fallback name (e.g. the portal's customer.dealer),
 *  since the portal resolves the tenant from the submission and leaves
 *  config.dealership_name as the "Our Dealership" placeholder. */
export function isAutoCurbTenant(config: BrandConfig, fallbackName = ""): boolean {
  return [config.dealership_name, fallbackName].some((candidate) => {
    const norm = (candidate || "").toLowerCase().replace(/[^a-z0-9]/g, "");
    return norm !== "" && norm !== "ourdealership" && norm.includes("autocurb");
  });
}

/**
 * Resolve the brand logo src for a tenant (raw URL — callers apply any
 * image-resize transform):
 *   1. the autoCURB wordmark for the AutoCurb tenant — forced, so a
 *      stale/old logo uploaded to site_config can't override the brand;
 *   2. else the tenant's own uploaded logo (config.logo_url) — white-label;
 *   3. else "" so the caller falls back to rendering the tenant name.
 */
export function tenantLogoSrc(config: BrandConfig, fallbackName = ""): string {
  if (isAutoCurbTenant(config, fallbackName)) return AUTOCURB_LOGO;
  return config.logo_url || "";
}
