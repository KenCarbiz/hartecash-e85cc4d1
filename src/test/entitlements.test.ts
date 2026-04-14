import { describe, it, expect } from "vitest";
import {
  annualSavings,
  formatUSD,
  getActiveTier,
  hasProductAccess,
  resolveEntitledTierIds,
  type DealerSubscription,
  type PlatformBundle,
  type PlatformProductTier,
} from "@/lib/entitlements";

// Minimal fixture matching the production seed. Any change to the seed
// that affects entitlement logic should be mirrored here.
const tiers: PlatformProductTier[] = [
  {
    id: "autocurb_starter",
    product_id: "autocurb",
    name: "Starter (Introductory)",
    description: null,
    monthly_price: 1495,
    annual_price: 14950,
    features: [],
    inventory_limit: null,
    included_with_product_ids: [],
    is_introductory: true,
    is_active: true,
    sort_order: 0,
  },
  {
    id: "autocurb_standard",
    product_id: "autocurb",
    name: "Standard",
    description: null,
    monthly_price: 1999,
    annual_price: 19990,
    features: [],
    inventory_limit: null,
    included_with_product_ids: [],
    is_introductory: false,
    is_active: true,
    sort_order: 1,
  },
  {
    id: "autolabels_base",
    product_id: "autolabels",
    name: "Base",
    description: null,
    monthly_price: 299,
    annual_price: 2990,
    features: [],
    inventory_limit: null,
    included_with_product_ids: ["autocurb"],
    is_introductory: false,
    is_active: true,
    sort_order: 0,
  },
  {
    id: "autolabels_pro",
    product_id: "autolabels",
    name: "Pro",
    description: null,
    monthly_price: 895,
    annual_price: 8950,
    features: [],
    inventory_limit: null,
    included_with_product_ids: [],
    is_introductory: false,
    is_active: true,
    sort_order: 1,
  },
  {
    id: "autoframe_70",
    product_id: "autoframe",
    name: "Up to 70",
    description: null,
    monthly_price: 399,
    annual_price: 3990,
    features: [],
    inventory_limit: 70,
    included_with_product_ids: [],
    is_introductory: false,
    is_active: true,
    sort_order: 0,
  },
  {
    id: "autoframe_120",
    product_id: "autoframe",
    name: "Up to 120",
    description: null,
    monthly_price: 599,
    annual_price: 5990,
    features: [],
    inventory_limit: 120,
    included_with_product_ids: [],
    is_introductory: false,
    is_active: true,
    sort_order: 1,
  },
  {
    id: "autoframe_unlimited",
    product_id: "autoframe",
    name: "Unlimited",
    description: null,
    monthly_price: 799,
    annual_price: 7990,
    features: [],
    inventory_limit: null,
    included_with_product_ids: [],
    is_introductory: false,
    is_active: true,
    sort_order: 2,
  },
  {
    id: "autofilm_full",
    product_id: "autofilm",
    name: "Sales + Service MPI",
    description: null,
    monthly_price: 899,
    annual_price: 8990,
    features: [],
    inventory_limit: null,
    included_with_product_ids: [],
    is_introductory: false,
    is_active: true,
    sort_order: 0,
  },
];

const bundles: PlatformBundle[] = [
  {
    id: "all_apps_unlimited",
    name: "All-Apps Unlimited",
    description: "All apps top tier",
    monthly_price: 3999,
    annual_price: 39990,
    product_ids: ["autocurb", "autolabels", "autoframe", "autofilm"],
    is_featured: true,
    sort_order: 0,
  },
  {
    id: "enterprise_group",
    name: "Enterprise (Dealer Groups)",
    description: "Contact sales",
    monthly_price: 0,
    annual_price: 0,
    product_ids: ["autocurb", "autolabels", "autoframe", "autofilm"],
    is_featured: false,
    sort_order: 1,
    is_enterprise: true,
  },
];

function sub(patch: Partial<DealerSubscription> = {}): DealerSubscription {
  return {
    id: "sub-1",
    bundle_id: null,
    product_ids: [],
    tier_ids: [],
    status: "active",
    trial_ends_at: null,
    billing_cycle: "monthly",
    monthly_amount: null,
    rooftop_count: 1,
    ...patch,
  };
}

describe("entitlements — resolveEntitledTierIds", () => {
  it("returns an empty set for a null subscription", () => {
    const out = resolveEntitledTierIds({ subscription: null, bundles, tiers });
    expect(out.size).toBe(0);
  });

  it("includes directly-owned tier ids", () => {
    const out = resolveEntitledTierIds({
      subscription: sub({ tier_ids: ["autocurb_standard"] }),
      bundles,
      tiers,
    });
    expect(out.has("autocurb_standard")).toBe(true);
  });

  it("grants complimentary autolabels_base when the dealer has any autocurb tier", () => {
    const out = resolveEntitledTierIds({
      subscription: sub({ tier_ids: ["autocurb_starter"] }),
      bundles,
      tiers,
    });
    expect(out.has("autolabels_base")).toBe(true);
    // Pro is NOT complimentary
    expect(out.has("autolabels_pro")).toBe(false);
  });

  it("does NOT grant autolabels_base when there is no autocurb tier", () => {
    const out = resolveEntitledTierIds({
      subscription: sub({ tier_ids: ["autoframe_70"] }),
      bundles,
      tiers,
    });
    expect(out.has("autolabels_base")).toBe(false);
  });

  it("grants the top tier of each bundled product when on a bundle", () => {
    const out = resolveEntitledTierIds({
      subscription: sub({ bundle_id: "all_apps_unlimited" }),
      bundles,
      tiers,
    });
    expect(out.has("autocurb_standard")).toBe(true); // sort_order 1 beats 0
    expect(out.has("autolabels_pro")).toBe(true); // sort_order 1 beats 0
    expect(out.has("autoframe_unlimited")).toBe(true); // sort_order 2
    expect(out.has("autofilm_full")).toBe(true);
    // Lower tiers are NOT granted directly (they'd only render if their
    // is_complimentary rule applies, which autolabels_base does)
    expect(out.has("autocurb_starter")).toBe(false);
  });

  it("combines direct tier + complimentary in one pass", () => {
    const out = resolveEntitledTierIds({
      subscription: sub({ tier_ids: ["autocurb_standard", "autoframe_120"] }),
      bundles,
      tiers,
    });
    expect(out.has("autocurb_standard")).toBe(true);
    expect(out.has("autoframe_120")).toBe(true);
    expect(out.has("autolabels_base")).toBe(true); // complimentary with autocurb
  });
});

describe("entitlements — hasProductAccess", () => {
  const input = { bundles, tiers };

  it("is true for a product whose tier is directly owned", () => {
    expect(
      hasProductAccess("autofilm", { ...input, subscription: sub({ tier_ids: ["autofilm_full"] }) }),
    ).toBe(true);
  });

  it("is true for autolabels when the dealer has autocurb (complimentary)", () => {
    expect(
      hasProductAccess("autolabels", { ...input, subscription: sub({ tier_ids: ["autocurb_starter"] }) }),
    ).toBe(true);
  });

  it("is false for a product the dealer neither owns nor is entitled to", () => {
    expect(
      hasProductAccess("autoframe", { ...input, subscription: sub({ tier_ids: ["autocurb_standard"] }) }),
    ).toBe(false);
  });
});

describe("entitlements — getActiveTier", () => {
  const input = { bundles, tiers };

  it("returns the top-sort-order tier the dealer has", () => {
    const t = getActiveTier("autocurb", { ...input, subscription: sub({ tier_ids: ["autocurb_standard"] }) });
    expect(t?.id).toBe("autocurb_standard");
  });

  it("returns Base for autolabels when complimentary-only", () => {
    const t = getActiveTier("autolabels", { ...input, subscription: sub({ tier_ids: ["autocurb_starter"] }) });
    expect(t?.id).toBe("autolabels_base");
  });

  it("returns null for an unowned product", () => {
    const t = getActiveTier("autofilm", { ...input, subscription: sub({ tier_ids: ["autocurb_starter"] }) });
    expect(t).toBeNull();
  });
});

describe("entitlements — helpers", () => {
  it("formats USD with no fractional cents", () => {
    expect(formatUSD(1999)).toBe("$1,999");
    expect(formatUSD(3999.5)).toBe("$4,000");
  });

  it("annualSavings returns 0 when annual_price is null", () => {
    expect(annualSavings(299, null)).toBe(0);
  });

  it("annualSavings returns the difference between 12×monthly and annual", () => {
    // 12 × 299 = 3588; annual 2990 → saves 598
    expect(annualSavings(299, 2990)).toBe(598);
  });

  it("annualSavings never returns a negative number", () => {
    expect(annualSavings(100, 2000)).toBe(0);
  });
});
