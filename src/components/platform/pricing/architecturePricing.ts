/**
 * Architecture-aware per-store price overrides.
 *
 * Single-rooftop dealers pay the catalog "base" prices. Multi-rooftop
 * dealers get volume discounts per store — the more stores, the less
 * each one pays per month. Catalog prices stay untouched; this module
 * layers the overrides at render time in PricingPlanPicker's merge step.
 *
 * All numbers are per-store/month. The `annual` field is the full
 * 12-month upfront amount (so the UI can divide by 12 for the
 * per-month-equivalent label and show the total upfront caption if it
 * ever comes back).
 *
 * Authoritative source of truth for the multi_location numbers is the
 * user direction dated 2026-04-15.
 */

export type Architecture =
  | "single_store"
  | "single_store_secondary"
  | "multi_location"
  | "dealer_group"
  | "enterprise";

interface PriceOverride {
  monthly: number;
  annual: number | null;
}

/**
 * Tier-level overrides. Keyed as `tier_id -> architecture -> prices`.
 * A missing entry means "use the catalog price unchanged."
 */
const TIER_PRICE_OVERRIDES: Record<string, Partial<Record<Architecture, PriceOverride>>> = {
  autocurb_standard: {
    // multi_location: $1,699/mo per store  |  $1,399/mo annual prepaid
    multi_location: { monthly: 1699, annual: 16788 }, // 1399 * 12
  },
  autolabels_base: {
    // Basic stays at $299/mo per store — no multi-location discount.
    multi_location: { monthly: 299, annual: 2988 },
  },
  autolabels_pro: {
    // Premium: $749/mo per store. Annual not specified by user — use
    // proportional 10% discount precedent seen on AutoCurb.
    multi_location: { monthly: 749, annual: 8988 }, // 749 * 12
  },
  autoframe_70: {
    multi_location: { monthly: 299, annual: 2988 },
  },
  autoframe_120: {
    multi_location: { monthly: 499, annual: 4988 },
  },
  autoframe_unlimited: {
    multi_location: { monthly: 699, annual: 6988 },
  },
  autofilm_full: {
    // $849/mo per store monthly  |  $749/mo per store annual prepaid
    multi_location: { monthly: 849, annual: 8988 }, // 749 * 12
  },
};

/**
 * Bundle-level overrides. Same shape.
 */
const BUNDLE_PRICE_OVERRIDES: Record<string, Partial<Record<Architecture, PriceOverride>>> = {
  all_apps_unlimited: {
    // $3,649/mo per store monthly  |  $3,249/mo per store annual prepaid
    multi_location: { monthly: 3649, annual: 38988 }, // 3249 * 12
  },
};

/** Lookup helper — returns the override or null if none applies. */
export function tierPriceOverride(
  tierId: string,
  architecture: Architecture | string | undefined,
): PriceOverride | null {
  if (!architecture) return null;
  const entry = TIER_PRICE_OVERRIDES[tierId];
  if (!entry) return null;
  return entry[architecture as Architecture] ?? null;
}

export function bundlePriceOverride(
  bundleId: string,
  architecture: Architecture | string | undefined,
): PriceOverride | null {
  if (!architecture) return null;
  const entry = BUNDLE_PRICE_OVERRIDES[bundleId];
  if (!entry) return null;
  return entry[architecture as Architecture] ?? null;
}

/**
 * Default rooftop count implied by each architecture. The picker
 * uses this as the initial rooftop count so totals multiply
 * correctly without the dealer having to type a number.
 */
export function rooftopCountForArchitecture(
  architecture: Architecture | string | undefined,
): number {
  switch (architecture) {
    case "single_store":
      return 1;
    case "single_store_secondary":
      return 2;
    case "multi_location":
      return 3;
    case "dealer_group":
      return 6;
    case "enterprise":
      return 11;
    default:
      return 1;
  }
}
