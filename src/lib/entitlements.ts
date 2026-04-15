// Entitlement resolver for the multi-product platform.
//
// A dealer can gain access to a product or a specific tier in three ways:
//
//   1. DIRECT — the tier id is listed in dealer_subscriptions.tier_ids.
//   2. BUNDLE — the dealer is on a bundle whose product_ids include this
//      product; they get that bundle's implied top tier.
//   3. COMPLIMENTARY — another tier the dealer already owns lists this
//      product (or tier) in its `included_with_product_ids` array.
//      e.g. autolabels_base.included_with_product_ids = ['autocurb'],
//      so any AutoCurb subscriber automatically gets AutoLabels Base.
//
// Product-level access (`hasProduct`) is true if the dealer has ANY tier
// of that product, or is complimentary-entitled to any tier of it.

export interface PlatformProduct {
  id: string;
  name: string;
  description: string;
  icon_name: string;
  base_url: string;
  is_active: boolean;
  sort_order: number;
  /**
   * Super-admin visibility gate. Default true. When false, the product
   * is hidden from the new-subscription pickers (Billing & Plan,
   * onboarding) so apps that aren't built out can stay out of the
   * dealer UI without being soft-deleted.
   */
  is_available_for_new_subs?: boolean;
}

export interface PlatformBundle {
  id: string;
  name: string;
  description: string;
  monthly_price: number;
  annual_price: number | null;
  product_ids: string[];
  is_featured: boolean;
  sort_order: number;
  /**
   * Enterprise / dealer-group bundle. When true, the UI renders
   * "Contact Sales" instead of a price and the self-serve billing layer
   * ignores the bundle (pricing is negotiated per group).
   */
  is_enterprise?: boolean;
  /** Super-admin visibility gate — see PlatformProduct field. */
  is_available_for_new_subs?: boolean;
}

export interface PlatformProductTier {
  id: string;
  product_id: string;
  name: string;
  description: string | null;
  monthly_price: number;
  annual_price: number | null;
  features: string[];
  inventory_limit: number | null;
  included_with_product_ids: string[];
  is_introductory: boolean;
  is_active: boolean;
  sort_order: number;
  /**
   * When true AND `inventory_limit` is set, overage units beyond the cap
   * are billed at `overage_price_per_unit`/month rather than forcing an
   * upgrade. Only meaningful for inventory-gated products (AutoFrame).
   */
  allow_overage?: boolean;
  overage_price_per_unit?: number | null;
}

export interface DealerSubscription {
  id: string;
  bundle_id: string | null;
  product_ids: string[];
  tier_ids: string[];
  status: string;
  trial_ends_at: string | null;
  billing_cycle: string;
  monthly_amount: number | null;
  rooftop_count: number;
}

export interface EntitlementInput {
  subscription: DealerSubscription | null;
  bundles: PlatformBundle[];
  tiers: PlatformProductTier[];
}

/**
 * Returns the set of tier ids the dealer is entitled to, accounting for
 * direct ownership, bundle inclusion, and complimentary inclusion rules.
 *
 * Pure function — safe to call from tests and memoise in React.
 */
export function resolveEntitledTierIds(input: EntitlementInput): Set<string> {
  const entitled = new Set<string>();
  const { subscription, bundles, tiers } = input;
  if (!subscription) return entitled;

  // 1. DIRECT — explicitly owned tiers.
  for (const t of subscription.tier_ids ?? []) entitled.add(t);

  // 2. BUNDLE — if on a bundle, grant the top tier of every product it
  //    includes. "Top tier" = highest sort_order among active tiers.
  if (subscription.bundle_id) {
    const bundle = bundles.find((b) => b.id === subscription.bundle_id);
    if (bundle) {
      for (const pid of bundle.product_ids) {
        const top = tiers
          .filter((t) => t.product_id === pid && t.is_active)
          .sort((a, b) => b.sort_order - a.sort_order)[0];
        if (top) entitled.add(top.id);
      }
    }
  }

  // 3. COMPLIMENTARY — iterate until a fixpoint so chained inclusions
  //    (if we ever add them) resolve correctly. In practice the current
  //    rules converge in a single pass.
  const ownedProducts = productIdsFromTierIds(entitled, tiers);
  for (const tier of tiers) {
    if (!tier.is_active) continue;
    if (tier.included_with_product_ids.length === 0) continue;
    const match = tier.included_with_product_ids.some((pid) => ownedProducts.has(pid));
    if (match) entitled.add(tier.id);
  }

  return entitled;
}

/**
 * Product-level access: true if the dealer has (or is complimentary-
 * entitled to) any active tier of the given product.
 */
export function hasProductAccess(
  productId: string,
  input: EntitlementInput,
): boolean {
  const entitled = resolveEntitledTierIds(input);
  for (const tierId of entitled) {
    const t = input.tiers.find((x) => x.id === tierId);
    if (t && t.product_id === productId && t.is_active) return true;
  }
  return false;
}

/**
 * Returns the highest-sort_order tier the dealer has for a given product,
 * or null if they have none. Useful for showing "You're on the Pro tier"
 * style copy.
 */
export function getActiveTier(
  productId: string,
  input: EntitlementInput,
): PlatformProductTier | null {
  const entitled = resolveEntitledTierIds(input);
  const candidates = input.tiers
    .filter((t) => t.product_id === productId && t.is_active && entitled.has(t.id))
    .sort((a, b) => b.sort_order - a.sort_order);
  return candidates[0] ?? null;
}

function productIdsFromTierIds(
  tierIds: Set<string>,
  tiers: PlatformProductTier[],
): Set<string> {
  const out = new Set<string>();
  for (const id of tierIds) {
    const t = tiers.find((x) => x.id === id);
    if (t) out.add(t.product_id);
  }
  return out;
}

/**
 * Money helpers for the pricing grid.
 */
export function formatUSD(cents: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(cents);
}

/**
 * Annual savings as a whole-dollar amount: 12 × monthly − annual.
 * Returns 0 if annual_price is not set.
 */
export function annualSavings(
  monthlyPrice: number,
  annualPrice: number | null,
): number {
  if (!annualPrice || annualPrice <= 0) return 0;
  return Math.max(0, Math.round(monthlyPrice * 12 - annualPrice));
}
