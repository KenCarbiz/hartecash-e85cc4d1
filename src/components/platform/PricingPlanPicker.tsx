import { useMemo, useState } from "react";
import { usePlatform } from "@/contexts/PlatformContext";
import type { PlatformBundle, PlatformProduct, PlatformProductTier } from "@/lib/entitlements";
import { formatUSD } from "@/lib/entitlements";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Building2,
  Camera,
  Car,
  Check,
  FileCheck,
  Phone,
  Tag,
  Video,
} from "lucide-react";
import { PlanCard } from "./pricing/PlanCard";
import { RooftopStepper } from "./pricing/RooftopStepper";
import { SelectionSummary } from "./pricing/SelectionSummary";
import { BigButtonRows } from "./pricing/BigButtonRows";
import {
  FALLBACK_PRODUCTS,
  FALLBACK_TIERS,
  FALLBACK_BUNDLES,
} from "./pricing/fallbackCatalog";
import {
  tierPriceOverride,
  bundlePriceOverride,
} from "./pricing/architecturePricing";
import { usePricingModel } from "@/hooks/usePricingModel";

const ICON_MAP: Record<string, React.ElementType> = {
  Car,
  FileCheck,
  Camera,
  Video,
  Tag,
};

export type PlanSelection =
  | { kind: "bundle"; bundleId: string; cycle: "monthly" | "annual"; rooftopCount: number }
  | { kind: "tiers"; tierIds: string[]; cycle: "monthly" | "annual"; rooftopCount: number }
  | { kind: "enterprise"; bundleId: string; rooftopCount: number };

// Annual pricing schema is live; the UI toggle is parked until we're
// ready to market the annual discount. Flip to `true` to enable.
const ANNUAL_AVAILABLE = false;

// Hero-bundle benefits — the `platform_bundles` schema has no
// features column yet, so these ship here. When we add that column
// we'll pull from data. Same treatment for EnterpriseCard below.
const ALL_APPS_BENEFITS = [
  "Dedicated Customer Success Manager",
  "Priority 24/7 technical support",
  "White-glove onboarding concierge",
  "Quarterly business reviews",
  "Unlimited inventory across all apps",
  "Custom integration support",
];

const ENTERPRISE_BENEFITS = [
  "Multi-rooftop consolidated billing",
  "Cross-rooftop executive reporting",
  "Group-wide SSO & identity",
  "Named Enterprise Customer Success Manager",
  "Dedicated onboarding engineering team",
  "Custom integrations & data pipelines",
  "Negotiated multi-rooftop pricing",
  "Priority roadmap influence",
];

interface PricingPlanPickerProps {
  /** Preselected state — onboarding resume, admin reflect-current-plan. */
  initialSelection?: Partial<PlanSelection>;
  /** Read-only preview mode. */
  readOnly?: boolean;
  /** Fires on every selection change. */
  onChange?: (selection: PlanSelection) => void;
  /** Confirm CTA label. */
  ctaLabel?: string;
  /** Fires when the confirm CTA is clicked. */
  onConfirm?: (selection: PlanSelection) => void;
  /**
   * Layout variant:
   *   - "full"    → standalone /plan page: 2-col with sticky summary rail
   *   - "compact" → onboarding / modals: single column, slim summary strip
   *   - "rows"    → admin Billing & Plan: horizontal rows with big tier
   *                 buttons per product, monthly/annual toggle baked in
   */
  variant?: "full" | "compact" | "rows";
  /**
   * Hide the confirm CTA and auto-persist on every change (used by admin
   * Billing & Plan which auto-saves into dealer_accounts).
   */
  autoSave?: boolean;
  /**
   * Business-rule gate: map of tier_id → human-readable reason this
   * tier is unavailable in the caller's context. Those buttons render
   * greyed-out with the reason shown in the micro-text slot. Example:
   * `{ autoframe_70: "Multi-location — 125+ units" }` when the dealer
   * picked Single Store + Secondary.
   */
  unavailableTiers?: Record<string, string>;
  /**
   * Dealership architecture (single_store / single_store_secondary /
   * multi_location / dealer_group / enterprise). When set, per-store
   * pricing overrides for that architecture are applied — multi-rooftop
   * dealers get volume discounts on top of the catalog base prices.
   */
  architecture?: string;
}

/**
 * Single source of truth for pricing UI. New (Apr 2026) layout:
 *   1. Global controls bar — rooftop stepper (+ billing toggle once enabled)
 *   2. Hero bundle card — "All-Apps Unlimited" promoted front-and-center
 *   3. Per-app tabs — AutoCurb / AutoLabels / AutoFrame / AutoFilm, each
 *      with 1–3 tier cards side-by-side (kills the mega-vertical-scroll
 *      problem of the old stacked layout)
 *   4. Peer Enterprise card — dark gradient, contact-sales CTA
 *   5. Selection summary — sticky right-rail in "full", bottom strip
 *      in "compact"
 *
 * The old `compact` boolean prop is still accepted via `variant="compact"`.
 */
const PricingPlanPicker = ({
  initialSelection,
  readOnly = false,
  onChange,
  ctaLabel = "Continue",
  onConfirm,
  variant = "full",
  autoSave = false,
  unavailableTiers,
  architecture,
}: PricingPlanPickerProps) => {
  const platform = usePlatform();
  // Super-admin-configured pricing (platform_pricing_model). Takes
  // precedence over the static architecturePricing.ts table when an
  // entry exists for this tier+architecture combination.
  const pricingModel = usePricingModel();
  // Guaranteed-complete catalog with per-product fallback.
  //
  // The previous "replace the whole array when empty" approach had a
  // subtle bug: if the DB had products but no ACTIVE tiers (e.g. the
  // seed migration inserted products but a later migration deactivated
  // every tier), `platform.tiers.length > 0` would be true but
  // `tiersByProduct` would be empty after filtering — so every
  // ProductRow silently returned null.
  //
  // We now merge by id with the fallback as the base, DB rows winning
  // on matching ids. Additionally, for any active product that has no
  // active tiers in the DB, we splice in the fallback tiers for that
  // product so the row always renders with clickable buttons.
  const { products, tiers, bundles } = useMemo(() => {
    const mergeById = <T extends { id: string }>(fb: T[], db: T[]): T[] => {
      const map = new Map<string, T>();
      for (const x of fb) map.set(x.id, x);
      for (const x of db) map.set(x.id, x);
      return Array.from(map.values());
    };

    // `is_available_for_new_subs !== false` — absent (undefined) is
    // treated as visible so older schemas pre-visibility-gate keep
    // working. Only an explicit `false` hides a product/bundle.
    const visible = <T extends { is_available_for_new_subs?: boolean }>(x: T) =>
      x.is_available_for_new_subs !== false;

    const mergedProducts = mergeById(FALLBACK_PRODUCTS, platform.products).filter(visible);
    const mergedBundlesBase = mergeById(FALLBACK_BUNDLES, platform.bundles).filter(visible);
    const mergedTiersBase = mergeById(FALLBACK_TIERS, platform.tiers);

    // Per-product fill: if ANY active fallback product lacks an active
    // tier after the merge, keep the fallback tiers for that product.
    const activeProductIds = new Set(
      mergedProducts.filter((p) => p.is_active).map((p) => p.id),
    );
    const productsWithActiveTiers = new Set(
      mergedTiersBase
        .filter((t) => t.is_active)
        .map((t) => t.product_id),
    );
    const needsFallbackFor = new Set(
      [...activeProductIds].filter((pid) => !productsWithActiveTiers.has(pid)),
    );
    const supplementalTiers = FALLBACK_TIERS.filter(
      (t) => needsFallbackFor.has(t.product_id) && t.is_active,
    );
    const mergedTiersAllRaw = [...mergedTiersBase, ...supplementalTiers];

    // ── Apply architecture-aware volume pricing ──────────────────────
    // Multi-rooftop dealers get discounted per-store prices. The merge
    // here swaps monthly/annual numbers so every downstream consumer
    // (totals, summary, tier buttons) sees the right figure without
    // any additional plumbing.
    //
    // Resolution order (first match wins):
    //   1. Super-admin Pricing Model row (platform_pricing_model) —
    //      edited live in the Admin → Pricing Model page.
    //   2. Static architecturePricing.ts hard-coded override (legacy
    //      safety net; kept so behaviour is identical when the DB
    //      row is empty).
    //   3. Catalog price on the tier/bundle itself.
    //
    // `annual_price` on a PlatformProductTier is the FULL 12-month
    // prepaid amount. The DB stores the per-month-equivalent — we
    // multiply by 12 on read to stay compatible with downstream
    // consumers that do `annual_price / 12` for the label.
    const toFullAnnual = (perMonthEquiv: number | undefined) =>
      perMonthEquiv == null ? null : Math.round(perMonthEquiv * 12);

    const mergedTiers = mergedTiersAllRaw.map((t) => {
      const db = pricingModel.getTierOverride(t.id, architecture);
      if (db && db.monthly != null) {
        return {
          ...t,
          monthly_price: db.monthly,
          annual_price: toFullAnnual(db.annual) ?? t.annual_price,
        };
      }
      const legacy = tierPriceOverride(t.id, architecture);
      return legacy
        ? { ...t, monthly_price: legacy.monthly, annual_price: legacy.annual }
        : t;
    });
    const mergedBundles = mergedBundlesBase.map((b) => {
      const db = pricingModel.getBundleOverride(b.id, architecture);
      if (db && db.monthly != null) {
        return {
          ...b,
          monthly_price: db.monthly,
          annual_price: toFullAnnual(db.annual) ?? b.annual_price,
        };
      }
      const legacy = bundlePriceOverride(b.id, architecture);
      return legacy
        ? { ...b, monthly_price: legacy.monthly, annual_price: legacy.annual }
        : b;
    });

    return {
      products: mergedProducts,
      bundles: mergedBundles,
      tiers: mergedTiers,
    };
  }, [platform.products, platform.bundles, platform.tiers, architecture, pricingModel.row]);

  // `rows` variant exposes the monthly/annual toggle via per-product
  // buttons (AutoCurb / All-Apps bundle show both options), so the
  // cycle state needs to be writable here. Other variants keep cycle
  // locked to monthly until ANNUAL_AVAILABLE flips on.
  const [cycle, setCycle] = useState<"monthly" | "annual">(
    variant === "rows" || ANNUAL_AVAILABLE
      ? (initialSelection?.cycle ?? "monthly")
      : "monthly",
  );
  const [rooftopCount, setRooftopCount] = useState<number>(
    Math.max(1, initialSelection?.rooftopCount ?? 1),
  );
  const [selectedBundle, setSelectedBundle] = useState<string | null>(
    initialSelection?.kind === "bundle" ? (initialSelection.bundleId ?? null) : null,
  );
  const [selectedTiers, setSelectedTiers] = useState<Record<string, string>>(
    initialSelection?.kind === "tiers"
      ? Object.fromEntries(
          (initialSelection.tierIds ?? [])
            .map((tid) => {
              const tier = tiers.find((t) => t.id === tid);
              return tier ? [tier.product_id, tid] : null;
            })
            .filter(Boolean) as Array<[string, string]>,
        )
      : {},
  );

  const featuredBundle =
    bundles.find((b) => b.is_featured && !b.is_enterprise) ??
    bundles.find((b) => !b.is_enterprise);
  const enterpriseBundle = bundles.find((b) => b.is_enterprise);

  const activeProducts = useMemo(
    () => products.filter((p) => p.is_active).sort((a, b) => a.sort_order - b.sort_order),
    [products],
  );

  const tiersByProduct = useMemo(() => {
    const map = new Map<string, PlatformProductTier[]>();
    for (const t of tiers.filter((x) => x.is_active)) {
      const list = map.get(t.product_id) ?? [];
      list.push(t);
      map.set(t.product_id, list);
    }
    for (const [, list] of map) list.sort((a, b) => a.sort_order - b.sort_order);
    return map;
  }, [tiers]);

  const tierPrice = (tier: PlatformProductTier) =>
    cycle === "annual" && tier.annual_price ? tier.annual_price : tier.monthly_price;
  void cycle; // referenced for future annual toggle

  const currentSelection: PlanSelection | null = selectedBundle
    ? { kind: "bundle", bundleId: selectedBundle, cycle, rooftopCount }
    : Object.keys(selectedTiers).length > 0
      ? { kind: "tiers", tierIds: Object.values(selectedTiers), cycle, rooftopCount }
      : null;

  // `null` means the user deselected everything — onChange receivers
  // (DealerOnboarding autosave) use this to clear the subscription.
  const emit = (next: PlanSelection | null) => {
    onChange?.(next as PlanSelection);
    // In autoSave mode, every click commits — including deselects.
    // `onConfirm` is called with the current selection (or a sentinel
    // empty `tiers` payload when the user cleared everything).
    if (autoSave && onConfirm) {
      onConfirm(
        (next ?? {
          kind: "tiers",
          tierIds: [],
          cycle,
          rooftopCount,
        }) as PlanSelection,
      );
    }
  };

  const handleSelectTier = (
    productId: string,
    tierId: string,
    nextCycle?: "monthly" | "annual",
  ) => {
    const effectiveCycle = nextCycle ?? cycle;
    if (nextCycle && nextCycle !== cycle) setCycle(nextCycle);
    // Toggle: clicking the already-selected tier for this product
    // clears the selection instead of flipping to a no-op. Same
    // click-once-on / click-once-off grammar on every row.
    const wasSelected = selectedTiers[productId] === tierId && !selectedBundle;
    if (wasSelected) {
      setSelectedTiers((prev) => {
        const n = { ...prev };
        delete n[productId];
        const tierIds = Object.values(n);
        emit(
          tierIds.length > 0
            ? { kind: "tiers", tierIds, cycle: effectiveCycle, rooftopCount }
            : null,
        );
        return n;
      });
      return;
    }
    setSelectedBundle(null);
    setSelectedTiers((prev) => {
      const n = { ...prev, [productId]: tierId };
      emit({
        kind: "tiers",
        tierIds: Object.values(n),
        cycle: effectiveCycle,
        rooftopCount,
      });
      return n;
    });
  };

  const handleSelectBundle = (
    bundleId: string,
    nextCycle?: "monthly" | "annual",
  ) => {
    const effectiveCycle = nextCycle ?? cycle;
    if (nextCycle && nextCycle !== cycle) setCycle(nextCycle);
    // Toggle: re-clicking the selected bundle clears it, same grammar
    // as the tier rows.
    if (selectedBundle === bundleId) {
      setSelectedBundle(null);
      emit(null);
      return;
    }
    setSelectedTiers({});
    setSelectedBundle(bundleId);
    emit({ kind: "bundle", bundleId, cycle: effectiveCycle, rooftopCount });
  };

  const handleRooftopChange = (next: number) => {
    const clamped = Math.max(1, Math.min(9999, Math.floor(next) || 1));
    setRooftopCount(clamped);
    if (currentSelection) emit({ ...currentSelection, rooftopCount: clamped } as PlanSelection);
  };

  const handleConfirm = () => {
    if (!currentSelection || readOnly) return;
    onConfirm?.(currentSelection);
  };

  // Per-rooftop total for the running summary.
  const perRooftopTotal = useMemo(() => {
    if (selectedBundle) {
      const b = bundles.find((x) => x.id === selectedBundle);
      return b?.monthly_price ?? 0;
    }
    let base = 0;
    for (const tid of Object.values(selectedTiers)) {
      const t = tiers.find((x) => x.id === tid);
      if (t) base += t.monthly_price;
    }
    return base;
  }, [selectedBundle, selectedTiers, bundles, tiers]);

  // Summary copy.
  const summaryTitle = selectedBundle
    ? (bundles.find((b) => b.id === selectedBundle)?.name ?? "Bundle selected")
    : Object.keys(selectedTiers).length > 0
      ? `${Object.keys(selectedTiers).length} app${Object.keys(selectedTiers).length === 1 ? "" : "s"} selected`
      : "No plan selected yet";

  const summarySubtitle = selectedBundle
    ? "Everything unlocked, white-glove service included."
    : Object.keys(selectedTiers).length > 0
      ? Object.values(selectedTiers)
          .map((tid) => {
            const t = tiers.find((x) => x.id === tid);
            const p = products.find((x) => x.id === t?.product_id);
            return t && p ? `${p.name} · ${t.name}` : null;
          })
          .filter(Boolean)
          .join(" · ")
      : "Pick a bundle or choose one tier per app below.";

  const isCompact = variant === "compact";

  // ───── Render ─────
  const mainContent = (
    <div className={`space-y-${isCompact ? "5" : "6"}`}>
      {/* Global controls bar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 rounded-xl border border-border/50 bg-gradient-to-br from-muted/30 to-muted/10 p-3.5">
        <div className="min-w-0">
          <h2 className={`${isCompact ? "text-base" : "text-lg"} font-bold text-card-foreground tracking-tight leading-none`}>
            Choose your plan
          </h2>
          <p className="text-[11px] text-muted-foreground mt-1 leading-snug">
            Per-rooftop pricing. AutoLabels Base is included free with any AutoCurb plan.
          </p>
        </div>
        <RooftopStepper
          value={rooftopCount}
          onChange={handleRooftopChange}
          disabled={readOnly}
        />
      </div>

      {/* Hero bundle */}
      {featuredBundle && (
        <HeroBundleCard
          bundle={featuredBundle}
          products={activeProducts}
          rooftopCount={rooftopCount}
          isSelected={selectedBundle === featuredBundle.id}
          readOnly={readOnly}
          onSelect={() => handleSelectBundle(featuredBundle.id)}
        />
      )}

      {/* Per-app tabs */}
      <AppTierTabs
        products={activeProducts}
        tiersByProduct={tiersByProduct}
        tierPrice={tierPrice}
        rooftopCount={rooftopCount}
        selectedTiers={selectedTiers}
        cycle={cycle}
        readOnly={readOnly}
        onSelectTier={handleSelectTier}
      />

      {/* Peer Enterprise */}
      {enterpriseBundle && <EnterpriseCard bundle={enterpriseBundle} />}
    </div>
  );

  // ─ "rows" variant — big horizontal buttons, one row per product ─
  if (variant === "rows") {
    // Derive which tiers are complimentary given the current selection.
    // Reason string powers the "Free with AutoCurb" copy on the button.
    const ownedProductIds = new Set<string>();
    for (const tid of Object.values(selectedTiers)) {
      const t = tiers.find((x) => x.id === tid);
      if (t) ownedProductIds.add(t.product_id);
    }
    const complimentary: Record<string, string> = {};
    for (const tier of tiers) {
      if (!tier.is_active) continue;
      if (tier.included_with_product_ids.length === 0) continue;
      // Only mark as complimentary if the dealer has NOT explicitly picked
      // this tier (if they did, it renders as "Selected" instead).
      if (Object.values(selectedTiers).includes(tier.id)) continue;
      const matchedProduct = tier.included_with_product_ids.find((pid) =>
        ownedProductIds.has(pid),
      );
      if (matchedProduct) {
        const p = products.find((x) => x.id === matchedProduct);
        complimentary[tier.id] = p?.name ?? matchedProduct;
      }
    }

    // Auto-save: whenever currentSelection changes, persist. Admins edit
    // in-place on the Billing & Plan page without a confirm button.
    return (
      <RowsVariantLayout
        products={activeProducts}
        tiersByProduct={tiersByProduct}
        featuredBundle={featuredBundle ?? null}
        enterpriseBundle={enterpriseBundle ?? null}
        productIconFor={(name) => ICON_MAP[name] || Car}
        selectedTiers={selectedTiers}
        selectedBundle={selectedBundle}
        cycle={cycle}
        complimentary={complimentary}
        unavailableTiers={unavailableTiers}
        readOnly={readOnly}
        onSelectTier={(productId, tierId, nextCycle) => {
          // handleSelectTier toggles on re-click; its emit() already
          // fires onConfirm when autoSave is on, so no duplicate call
          // here.
          handleSelectTier(productId, tierId, nextCycle);
        }}
        onSelectBundle={(bundleId, nextCycle) => {
          handleSelectBundle(bundleId, nextCycle);
        }}
        summaryTitle={summaryTitle}
        summarySubtitle={summarySubtitle}
        perRooftopTotal={perRooftopTotal}
        rooftopCount={rooftopCount}
        ctaLabel={ctaLabel}
        onConfirm={!autoSave && onConfirm ? handleConfirm : undefined}
        currentSelection={currentSelection}
      />
    );
  }

  // Layout: "full" gets a 2-col grid with sticky summary on desktop.
  // "compact" stacks, summary at the bottom.
  if (isCompact) {
    return (
      <div className="space-y-5">
        {mainContent}
        {currentSelection && (
          <SelectionSummary
            compact
            title={summaryTitle}
            subtitle={summarySubtitle}
            perRooftopTotal={perRooftopTotal}
            rooftopCount={rooftopCount}
            readOnly={readOnly}
            ctaLabel={ctaLabel}
            onConfirm={onConfirm ? handleConfirm : undefined}
          />
        )}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-6">
      <div className="min-w-0">{mainContent}</div>
      <aside className="lg:pt-1">
        <SelectionSummary
          title={summaryTitle}
          subtitle={summarySubtitle}
          perRooftopTotal={perRooftopTotal}
          rooftopCount={rooftopCount}
          readOnly={readOnly}
          ctaLabel={ctaLabel}
          onConfirm={onConfirm && currentSelection ? handleConfirm : undefined}
        />
      </aside>
    </div>
  );
};

// ──────────────────────────────────────────────────────────────────────────
// Sub-components
// ──────────────────────────────────────────────────────────────────────────

function HeroBundleCard({
  bundle,
  products,
  rooftopCount,
  isSelected,
  readOnly,
  onSelect,
}: {
  bundle: PlatformBundle;
  products: PlatformProduct[];
  rooftopCount: number;
  isSelected: boolean;
  readOnly: boolean;
  onSelect: () => void;
}) {
  const price = bundle.monthly_price;
  const multiplied = price * rooftopCount;

  return (
    <Card
      className={`relative overflow-hidden transition-all ${
        isSelected
          ? "border-primary/60 shadow-xl ring-2 ring-primary/40"
          : "border-primary/30 shadow-lg"
      }`}
    >
      <div className="absolute inset-0 bg-gradient-to-br from-primary/10 via-primary/[0.04] to-transparent pointer-events-none" />

      {/* "Best value" ribbon */}
      <div className="absolute top-0 right-0 bg-gradient-to-r from-primary to-primary/80 text-primary-foreground text-[9px] font-bold uppercase tracking-wider px-3 py-1 rounded-bl-lg shadow-sm">
        Best value
      </div>

      <CardContent className="relative p-5 sm:p-6">
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_auto] gap-5 items-start">
          <div className="space-y-4 min-w-0">
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-primary">Platform bundle</p>
              <h3 className="text-xl sm:text-2xl font-bold text-card-foreground mt-1 leading-tight">
                {bundle.name}
              </h3>
              <p className="text-xs text-muted-foreground mt-1.5 max-w-xl leading-snug">
                {bundle.description}
              </p>
            </div>

            {/* Product chips — what's included */}
            <div className="flex flex-wrap gap-1.5">
              {products.map((p) => {
                const Icon = ICON_MAP[p.icon_name] || Car;
                const included = bundle.product_ids.includes(p.id);
                return (
                  <div
                    key={p.id}
                    className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-medium ${
                      included
                        ? "border-primary/30 bg-primary/5 text-card-foreground"
                        : "border-border/40 bg-muted/40 text-muted-foreground line-through"
                    }`}
                  >
                    <Icon className="w-3 h-3 shrink-0" />
                    <span>{p.name}</span>
                    {included && <Check className="w-2.5 h-2.5 text-emerald-500 ml-0.5" />}
                  </div>
                );
              })}
            </div>

            {/* Benefits */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 pt-3 border-t border-border/40">
              {ALL_APPS_BENEFITS.map((line) => (
                <div key={line} className="flex items-start gap-1.5 text-[11px] text-card-foreground">
                  <Check className="w-3 h-3 text-emerald-500 shrink-0 mt-0.5" />
                  <span className="leading-snug">{line}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Price rail */}
          <div className="lg:w-56 space-y-3 lg:border-l lg:border-border/40 lg:pl-5">
            <div>
              <p className="text-3xl sm:text-4xl font-bold text-card-foreground leading-none">
                {formatUSD(price)}
              </p>
              <p className="text-[11px] text-muted-foreground mt-1">per rooftop/mo</p>
              {rooftopCount > 1 && (
                <p className="text-xs text-primary font-semibold mt-1.5">
                  {formatUSD(multiplied)}/mo total
                </p>
              )}
            </div>
            {!readOnly && (
              <Button
                size="sm"
                className="w-full"
                variant={isSelected ? "default" : "default"}
                onClick={onSelect}
              >
                {isSelected ? (
                  <>
                    Selected <Check className="w-3.5 h-3.5 ml-1.5" />
                  </>
                ) : (
                  "Select bundle"
                )}
              </Button>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function AppTierTabs({
  products,
  tiersByProduct,
  tierPrice,
  rooftopCount,
  selectedTiers,
  cycle,
  readOnly,
  onSelectTier,
}: {
  products: PlatformProduct[];
  tiersByProduct: Map<string, PlatformProductTier[]>;
  tierPrice: (t: PlatformProductTier) => number;
  rooftopCount: number;
  selectedTiers: Record<string, string>;
  cycle: "monthly" | "annual";
  readOnly: boolean;
  onSelectTier: (productId: string, tierId: string, nextCycle?: "monthly" | "annual") => void;
}) {
  const tabbable = products.filter((p) => (tiersByProduct.get(p.id) ?? []).length > 0);
  const [active, setActive] = useState<string>(tabbable[0]?.id ?? "");

  if (tabbable.length === 0) return null;

  return (
    <div className="space-y-3">
      <div className="flex items-baseline justify-between">
        <h3 className="text-sm font-bold text-card-foreground">Or pick per app</h3>
        <p className="text-[10px] text-muted-foreground">
          Mix and match · one tier per product
        </p>
      </div>

      <Tabs value={active} onValueChange={setActive} className="w-full">
        <TabsList className="w-full h-auto flex-wrap justify-start gap-1 bg-muted/40 p-1">
          {tabbable.map((p) => {
            const Icon = ICON_MAP[p.icon_name] || Car;
            const selected = Boolean(selectedTiers[p.id]);
            return (
              <TabsTrigger
                key={p.id}
                value={p.id}
                className="data-[state=active]:bg-card data-[state=active]:shadow-sm text-xs gap-1.5 px-3 py-1.5 h-auto"
              >
                <Icon className="w-3.5 h-3.5" />
                <span className="font-semibold">{p.name}</span>
                {selected && <Check className="w-3 h-3 text-emerald-500" />}
              </TabsTrigger>
            );
          })}
        </TabsList>

        {tabbable.map((p) => {
          const list = tiersByProduct.get(p.id) ?? [];
          const Icon = ICON_MAP[p.icon_name] || Car;
          const hasInventoryTier = list.some((t) => t.inventory_limit != null);
          return (
            <TabsContent key={p.id} value={p.id} className="mt-4 space-y-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                  <Icon className="w-4 h-4 text-primary" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-bold text-card-foreground">{p.name}</p>
                  <p className="text-[11px] text-muted-foreground leading-snug">{p.description}</p>
                </div>
              </div>

              <div
                className={`grid gap-3 ${
                  list.length === 1
                    ? "grid-cols-1 max-w-md"
                    : list.length === 2
                      ? "grid-cols-1 sm:grid-cols-2"
                      : "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3"
                }`}
              >
                {list.map((tier) => {
                  const isComplimentary = tier.included_with_product_ids.length > 0;
                  const isSelected = selectedTiers[p.id] === tier.id;
                  const price = tierPrice(tier);

                  const footerLines: Array<{ label: string; tone?: "muted" | "amber" }> = [];
                  if (tier.inventory_limit != null) {
                    footerLines.push({
                      label: `Up to ${tier.inventory_limit.toLocaleString()} active units`,
                    });
                  } else if (hasInventoryTier) {
                    footerLines.push({ label: "Unlimited inventory" });
                  }
                  if (tier.allow_overage && tier.overage_price_per_unit != null) {
                    footerLines.push({
                      label: `+ ${formatUSD(tier.overage_price_per_unit)}/unit over cap`,
                      tone: "amber",
                    });
                  }

                  const badge = tier.is_introductory
                    ? ({ label: "Introductory", tone: "amber" } as const)
                    : isComplimentary
                      ? ({ label: "Free w/ AutoCurb", tone: "emerald" } as const)
                      : null;

                  return (
                    <PlanCard
                      key={tier.id}
                      name={tier.name}
                      description={tier.description}
                      monthlyPrice={price}
                      annualPricePerMonth={
                        tier.annual_price != null
                          ? Math.round(tier.annual_price / 12)
                          : undefined
                      }
                      annualSelected={isSelected && cycle === "annual"}
                      rooftopCount={rooftopCount}
                      features={tier.features}
                      badge={badge}
                      footerLines={footerLines}
                      selected={isSelected}
                      readOnly={readOnly}
                      onSelect={(nextCycle) =>
                        onSelectTier(p.id, tier.id, nextCycle)
                      }
                    />
                  );
                })}
              </div>
            </TabsContent>
          );
        })}
      </Tabs>
    </div>
  );
}

function EnterpriseCard({ bundle }: { bundle: PlatformBundle }) {
  return (
    <Card className="border-border/60 bg-gradient-to-br from-slate-900 to-slate-800 text-slate-50 shadow-lg overflow-hidden relative">
      <CardContent className="relative p-5 sm:p-6">
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_auto] gap-5 items-start">
          <div className="space-y-3 min-w-0">
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-amber-400">Dealer groups</p>
              <h3 className="text-lg sm:text-xl font-bold text-slate-50 mt-1 leading-tight flex items-center gap-2">
                <Building2 className="w-5 h-5 text-amber-400" />
                {bundle.name}
              </h3>
              <p className="text-xs text-slate-300 mt-1.5 max-w-xl leading-snug">
                {bundle.description}
              </p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 pt-3 border-t border-slate-700">
              {ENTERPRISE_BENEFITS.map((line) => (
                <div key={line} className="flex items-start gap-1.5 text-[11px] text-slate-200">
                  <Check className="w-3 h-3 text-amber-400 shrink-0 mt-0.5" />
                  <span className="leading-snug">{line}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="lg:w-52 space-y-2 lg:border-l lg:border-slate-700 lg:pl-5">
            <div>
              <p className="text-xl font-bold text-amber-400 leading-none">Contact Sales</p>
              <p className="text-[11px] text-slate-400 mt-1">Custom multi-rooftop pricing</p>
            </div>
            <Button
              size="sm"
              className="w-full bg-amber-400 hover:bg-amber-300 text-slate-900 font-semibold"
              asChild
            >
              <a href="mailto:sales@autocurb.io?subject=Enterprise%20Dealer%20Group%20Inquiry">
                <Phone className="w-3.5 h-3.5 mr-1.5" />
                Talk to sales
              </a>
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ──────────────────────────────────────────────────────────────────────
// "rows" variant wrapper — used by admin Billing & Plan. Compact header
// + rooftop stepper + BigButtonRows + optional confirm CTA. Reuses the
// state + handlers from the main component above.
// ──────────────────────────────────────────────────────────────────────

function RowsVariantLayout(props: {
  products: PlatformProduct[];
  tiersByProduct: Map<string, PlatformProductTier[]>;
  featuredBundle: PlatformBundle | null;
  enterpriseBundle: PlatformBundle | null;
  productIconFor: (iconName: string) => React.ElementType;
  selectedTiers: Record<string, string>;
  selectedBundle: string | null;
  cycle: "monthly" | "annual";
  complimentary: Record<string, string>;
  unavailableTiers?: Record<string, string>;
  readOnly: boolean;
  onSelectTier: (
    productId: string,
    tierId: string,
    cycle?: "monthly" | "annual",
  ) => void;
  onSelectBundle: (bundleId: string, cycle: "monthly" | "annual") => void;
  summaryTitle: string;
  summarySubtitle: string;
  perRooftopTotal: number;
  rooftopCount: number;
  ctaLabel: string;
  onConfirm?: () => void;
  currentSelection: PlanSelection | null;
}) {
  const {
    products,
    tiersByProduct,
    featuredBundle,
    enterpriseBundle,
    productIconFor,
    selectedTiers,
    selectedBundle,
    cycle,
    complimentary,
    unavailableTiers,
    readOnly,
    onSelectTier,
    onSelectBundle,
    summaryTitle,
    summarySubtitle,
    perRooftopTotal,
    rooftopCount,
    ctaLabel,
    onConfirm,
    currentSelection,
  } = props;

  return (
    <div className="space-y-4">
      <BigButtonRows
        products={products}
        tiersByProduct={tiersByProduct}
        featuredBundle={featuredBundle}
        enterpriseBundle={enterpriseBundle}
        productIconFor={productIconFor}
        selectedTiers={selectedTiers}
        selectedBundle={selectedBundle}
        cycle={cycle}
        complimentary={complimentary}
        unavailableTiers={unavailableTiers}
        readOnly={readOnly}
        onSelectTier={onSelectTier}
        onSelectBundle={onSelectBundle}
      />

      {/* Running total — slim strip, auto-saves so no confirm CTA unless
          the parent explicitly wants one. */}
      {currentSelection && (
        <SelectionSummary
          compact
          title={summaryTitle}
          subtitle={summarySubtitle}
          perRooftopTotal={perRooftopTotal}
          rooftopCount={rooftopCount}
          readOnly={readOnly}
          ctaLabel={ctaLabel}
          onConfirm={onConfirm}
        />
      )}
    </div>
  );
}

export default PricingPlanPicker;
