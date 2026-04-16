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
    // multi_location (3-5): ~15% off catalog → $1,699/mo | annual $1,399/mo
    multi_location: { monthly: 1699, annual: 16788 }, // 1399 * 12
    // dealer_group (6-10): ~20% off catalog → $1,599/mo | annual $1,349/mo
    dealer_group: { monthly: 1599, annual: 16188 }, // 1349 * 12
  },
  autolabels_base: {
    // Basic stays discounted but modest — typically free with AutoCurb anyway.
    multi_location: { monthly: 299, annual: 2988 },
    dealer_group: { monthly: 249, annual: 2388 },
  },
  autolabels_pro: {
    // Premium: multi ~17% off, dealer_group ~22% off catalog $899.
    multi_location: { monthly: 749, annual: 8988 }, // 749 * 12
    dealer_group: { monthly: 699, annual: 8388 }, // 699 * 12
  },
  autoframe_70: {
    multi_location: { monthly: 299, annual: 2988 },
    dealer_group: { monthly: 249, annual: 2988 }, // 249 * 12
  },
  autoframe_120: {
    multi_location: { monthly: 499, annual: 4988 },
    dealer_group: { monthly: 449, annual: 4788 },
  },
  autoframe_unlimited: {
    multi_location: { monthly: 699, annual: 6988 },
    dealer_group: { monthly: 599, annual: 5988 },
  },
  autofilm_full: {
    // multi ~15% off, dealer_group ~20% off catalog $999.
    multi_location: { monthly: 849, annual: 8988 }, // 749 * 12
    dealer_group: { monthly: 799, annual: 7788 }, // 649 * 12
  },
};

/**
 * Bundle-level overrides. Same shape.
 */
const BUNDLE_PRICE_OVERRIDES: Record<string, Partial<Record<Architecture, PriceOverride>>> = {
  all_apps_unlimited: {
    // multi_location (3-5): $3,649/mo | annual $3,249/mo
    multi_location: { monthly: 3649, annual: 38988 }, // 3249 * 12
    // dealer_group (6-10): $3,399/mo | annual $2,999/mo
    dealer_group: { monthly: 3399, annual: 35988 }, // 2999 * 12
  },
};

/**
 * Derive the pricing architecture tier from a rooftop count.
 * Used by the billing page rooftop stepper so that changing the
 * count automatically shifts pricing tiers:
 *   1-2  → single_store (catalog prices)
 *   3-5  → multi_location (~15% off)
 *   6-10 → dealer_group  (~20% off)
 *   11+  → enterprise    (custom / contact sales)
 */
export function architectureForRooftopCount(count: number): Architecture {
  if (count >= 11) return "enterprise";
  if (count >= 6) return "dealer_group";
  if (count >= 3) return "multi_location";
  if (count === 2) return "single_store_secondary";
  return "single_store";
}

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
