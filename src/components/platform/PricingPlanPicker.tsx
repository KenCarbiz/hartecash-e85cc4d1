import { useMemo, useState } from "react";
import { usePlatform } from "@/contexts/PlatformContext";
import type {
  PlatformBundle,
  PlatformProduct,
  PlatformProductTier,
} from "@/lib/entitlements";
import { annualSavings, formatUSD } from "@/lib/entitlements";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import {
  ArrowRight,
  Building2,
  Camera,
  Car,
  Check,
  Crown,
  FileCheck,
  Phone,
  Sparkles,
  Tag,
  Video,
} from "lucide-react";

const ICON_MAP: Record<string, React.ElementType> = {
  Car,
  FileCheck,
  Camera,
  Video,
  Tag,
};

export type PlanSelection =
  | { kind: "bundle"; bundleId: string; cycle: "monthly" | "annual" }
  | { kind: "tiers"; tierIds: string[]; cycle: "monthly" | "annual" }
  | { kind: "enterprise"; bundleId: string };

interface PricingPlanPickerProps {
  /**
   * Preselected state — passed in during onboarding so the picker can be
   * resumed; passed in from admin to reflect the current plan.
   */
  initialSelection?: Partial<PlanSelection>;
  /** Hide the "Choose" / CTA buttons — useful for read-only previews. */
  readOnly?: boolean;
  /** Called whenever the dealer changes their selection. */
  onChange?: (selection: PlanSelection) => void;
  /** Text on the primary CTA (defaults to "Continue"). */
  ctaLabel?: string;
  /** Fires when the CTA button is clicked with a finalized selection. */
  onConfirm?: (selection: PlanSelection) => void;
  /** Show a smaller, embedded variant used inside onboarding wizards. */
  compact?: boolean;
}

/**
 * Single source of truth for pricing UI. Renders:
 *  - a billing-cycle toggle (monthly / annual)
 *  - per-product tier cards (AutoCurb, AutoLabels, AutoFrame, AutoFilm)
 *  - the featured All-Apps Unlimited bundle
 *  - an Enterprise (dealer-groups) "Contact Sales" card
 *
 * Consumers: `PlatformSubscriptions` admin page, onboarding wizard,
 * standalone `/plan` route.
 */
const PricingPlanPicker = ({
  initialSelection,
  readOnly = false,
  onChange,
  ctaLabel = "Continue",
  onConfirm,
  compact = false,
}: PricingPlanPickerProps) => {
  const { products, bundles, tiers } = usePlatform();

  const [cycle, setCycle] = useState<"monthly" | "annual">(
    initialSelection?.cycle ?? "monthly",
  );
  const [selectedBundle, setSelectedBundle] = useState<string | null>(
    initialSelection?.kind === "bundle" ? initialSelection.bundleId ?? null : null,
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

  const currentSelection: PlanSelection | null =
    selectedBundle
      ? { kind: "bundle", bundleId: selectedBundle, cycle }
      : Object.keys(selectedTiers).length > 0
        ? { kind: "tiers", tierIds: Object.values(selectedTiers), cycle }
        : null;

  const emit = (next: PlanSelection) => {
    onChange?.(next);
  };

  const handleSelectTier = (productId: string, tierId: string) => {
    // Picking any individual tier clears a bundle selection.
    setSelectedBundle(null);
    setSelectedTiers((prev) => {
      const n = { ...prev, [productId]: tierId };
      emit({
        kind: "tiers",
        tierIds: Object.values(n),
        cycle,
      });
      return n;
    });
  };

  const handleSelectBundle = (bundleId: string) => {
    setSelectedTiers({});
    setSelectedBundle(bundleId);
    emit({ kind: "bundle", bundleId, cycle });
  };

  const handleCycleChange = (next: "monthly" | "annual") => {
    setCycle(next);
    if (currentSelection) emit({ ...currentSelection, cycle: next } as PlanSelection);
  };

  const handleConfirm = () => {
    if (!currentSelection || readOnly) return;
    onConfirm?.(currentSelection);
  };

  return (
    <div className={`space-y-${compact ? "5" : "8"}`}>
      {/* Header + cycle toggle */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className={`${compact ? "text-lg" : "text-xl"} font-bold text-card-foreground tracking-tight`}>
            Choose your plan
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Pricing is per rooftop. Billed monthly or annually — save ~17% annually.
          </p>
        </div>
        <ToggleGroup
          type="single"
          value={cycle}
          onValueChange={(v) => v && handleCycleChange(v as "monthly" | "annual")}
          className="border border-border/60 rounded-lg p-0.5 bg-muted/40"
          aria-label="Billing cycle"
        >
          <ToggleGroupItem value="monthly" className="text-xs px-3 data-[state=on]:bg-card data-[state=on]:shadow-sm">
            Monthly
          </ToggleGroupItem>
          <ToggleGroupItem value="annual" className="text-xs px-3 data-[state=on]:bg-card data-[state=on]:shadow-sm">
            Annual <span className="ml-1 text-[9px] font-semibold text-emerald-600">SAVE</span>
          </ToggleGroupItem>
        </ToggleGroup>
      </div>

      {/* Apps & tiers */}
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <Crown className="w-4 h-4 text-primary" />
          <h3 className="text-sm font-bold text-card-foreground">Apps</h3>
        </div>

        <div className="grid grid-cols-1 gap-5">
          {activeProducts.map((product) => {
            const productTiers = tiersByProduct.get(product.id) ?? [];
            if (productTiers.length === 0) return null;
            return (
              <ProductTierBlock
                key={product.id}
                product={product}
                tiers={productTiers}
                cycle={cycle}
                tierPrice={tierPrice}
                selectedTierId={selectedTiers[product.id] ?? null}
                readOnly={readOnly}
                onSelectTier={(tid) => handleSelectTier(product.id, tid)}
              />
            );
          })}
        </div>
      </div>

      {/* All-Apps Unlimited */}
      {featuredBundle && (
        <AllAppsCard
          bundle={featuredBundle}
          products={activeProducts}
          cycle={cycle}
          isSelected={selectedBundle === featuredBundle.id}
          readOnly={readOnly}
          onSelect={() => handleSelectBundle(featuredBundle.id)}
        />
      )}

      {/* Enterprise */}
      {enterpriseBundle && <EnterpriseCard bundle={enterpriseBundle} />}

      {/* Confirm CTA */}
      {!readOnly && currentSelection && onConfirm && (
        <Card className="border-primary/30 bg-primary/[0.03]">
          <CardContent className="py-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <p className="text-sm font-semibold text-card-foreground">
                {currentSelection.kind === "bundle"
                  ? `Selected: ${bundles.find((b) => b.id === currentSelection.bundleId)?.name}`
                  : `Selected: ${currentSelection.tierIds.length} app${currentSelection.tierIds.length === 1 ? "" : "s"}`}
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Billing {cycle}. Stripe checkout wires up shortly; your selection is stored immediately.
              </p>
            </div>
            <Button size="sm" className="shrink-0 px-6" onClick={handleConfirm}>
              {ctaLabel}
              <ArrowRight className="w-3.5 h-3.5 ml-1.5" />
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

// ──────────────────────────────────────────────────────────────────────────
// Sub-components
// ──────────────────────────────────────────────────────────────────────────

function ProductTierBlock({
  product,
  tiers,
  cycle,
  tierPrice,
  selectedTierId,
  readOnly,
  onSelectTier,
}: {
  product: PlatformProduct;
  tiers: PlatformProductTier[];
  cycle: "monthly" | "annual";
  tierPrice: (t: PlatformProductTier) => number;
  selectedTierId: string | null;
  readOnly: boolean;
  onSelectTier: (id: string) => void;
}) {
  const Icon = ICON_MAP[product.icon_name] || Car;

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center">
          <Icon className="w-4 h-4 text-primary" />
        </div>
        <div>
          <h4 className="text-sm font-bold text-card-foreground">{product.name}</h4>
          <p className="text-[11px] text-muted-foreground">{product.description}</p>
        </div>
      </div>

      <div
        className={`grid gap-3 ${
          tiers.length === 1
            ? "grid-cols-1"
            : tiers.length === 2
              ? "grid-cols-1 sm:grid-cols-2"
              : "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3"
        }`}
      >
        {tiers.map((tier) => {
          const isComplimentary = tier.included_with_product_ids.length > 0;
          const isSelected = selectedTierId === tier.id;
          const price = tierPrice(tier);
          return (
            <Card
              key={tier.id}
              className={`relative overflow-hidden transition-all ${
                isSelected
                  ? "border-primary/60 shadow-md ring-1 ring-primary/30"
                  : "border-border/50 hover:border-border"
              }`}
            >
              {tier.is_introductory && (
                <div className="absolute top-0 right-0 bg-amber-500 text-white text-[9px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-bl-lg">
                  Introductory
                </div>
              )}
              {isComplimentary && (
                <div className="absolute top-0 right-0 bg-emerald-500 text-white text-[9px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-bl-lg">
                  Included w/ AutoCurb
                </div>
              )}

              <CardContent className="p-4 space-y-3">
                <div>
                  <p className="text-sm font-bold text-card-foreground">{tier.name}</p>
                  {tier.description && (
                    <p className="text-[11px] text-muted-foreground mt-0.5 leading-snug">
                      {tier.description}
                    </p>
                  )}
                </div>

                <div>
                  <p className="text-2xl font-bold text-card-foreground">
                    {formatUSD(price)}
                    <span className="text-[11px] font-normal text-muted-foreground">
                      /{cycle === "annual" ? "yr" : "mo"}
                    </span>
                  </p>
                  {cycle === "annual" && tier.annual_price && (
                    <p className="text-[10px] text-emerald-600 font-semibold">
                      Save {formatUSD(annualSavings(tier.monthly_price, tier.annual_price))}/yr
                    </p>
                  )}
                  {tier.inventory_limit != null && (
                    <p className="text-[10px] text-muted-foreground mt-0.5">
                      Up to {tier.inventory_limit.toLocaleString()} active units
                    </p>
                  )}
                  {tier.inventory_limit == null &&
                    tiers.some((t) => t.inventory_limit != null) && (
                      <p className="text-[10px] text-muted-foreground mt-0.5">
                        Unlimited inventory
                      </p>
                    )}
                </div>

                <ul className="space-y-1.5 pt-2 border-t border-border/40 text-[11px]">
                  {tier.features.slice(0, 5).map((f) => (
                    <li key={f} className="flex items-start gap-1.5">
                      <Check className="w-3 h-3 text-emerald-500 shrink-0 mt-0.5" />
                      <span className="text-card-foreground leading-snug">{f}</span>
                    </li>
                  ))}
                </ul>

                <Button
                  variant={isSelected ? "default" : "outline"}
                  size="sm"
                  className="w-full"
                  disabled={readOnly}
                  onClick={() => onSelectTier(tier.id)}
                >
                  {isSelected ? (
                    <>
                      Selected <Check className="w-3.5 h-3.5 ml-1.5" />
                    </>
                  ) : (
                    <>
                      Select
                      <ArrowRight className="w-3.5 h-3.5 ml-1.5" />
                    </>
                  )}
                </Button>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}

function AllAppsCard({
  bundle,
  products,
  cycle,
  isSelected,
  readOnly,
  onSelect,
}: {
  bundle: PlatformBundle;
  products: PlatformProduct[];
  cycle: "monthly" | "annual";
  isSelected: boolean;
  readOnly: boolean;
  onSelect: () => void;
}) {
  const price =
    cycle === "annual" && bundle.annual_price ? bundle.annual_price : bundle.monthly_price;
  return (
    <Card
      className={`border-primary/40 shadow-lg overflow-hidden relative transition-all ${
        isSelected ? "ring-2 ring-primary/60 shadow-primary/10" : ""
      }`}
    >
      <div className="absolute inset-0 bg-gradient-to-br from-primary/10 via-primary/5 to-transparent pointer-events-none" />
      <CardHeader className="relative">
        <div className="flex items-start justify-between gap-4">
          <div>
            <CardTitle className="text-xl flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-primary" />
              {bundle.name}
            </CardTitle>
            <CardDescription className="mt-1 max-w-2xl">{bundle.description}</CardDescription>
          </div>
          <div className="text-right shrink-0">
            <p className="text-3xl font-bold text-card-foreground">
              {formatUSD(price)}
              <span className="text-xs font-normal text-muted-foreground">
                /{cycle === "annual" ? "yr" : "mo"}
              </span>
            </p>
            {cycle === "annual" && bundle.annual_price && (
              <p className="text-[11px] text-emerald-600 font-semibold mt-0.5">
                Save {formatUSD(annualSavings(bundle.monthly_price, bundle.annual_price))}/yr
              </p>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="relative space-y-4">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {products.map((p) => {
            const Icon = ICON_MAP[p.icon_name] || Car;
            const included = bundle.product_ids.includes(p.id);
            return (
              <div
                key={p.id}
                className={`flex items-center gap-2 p-2.5 rounded-lg border text-xs ${
                  included
                    ? "bg-card/80 border-border/60"
                    : "opacity-40 line-through border-transparent"
                }`}
              >
                <Icon className="w-3.5 h-3.5 text-primary shrink-0" />
                <span className="font-medium truncate">{p.name}</span>
                {included && <Check className="w-3 h-3 text-emerald-500 ml-auto shrink-0" />}
              </div>
            );
          })}
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 pt-3 border-t border-border/50 text-xs text-card-foreground">
          {[
            "Dedicated Customer Success Manager",
            "Priority 24/7 technical support",
            "White-glove onboarding concierge",
            "Quarterly business reviews",
            "Unlimited inventory across all apps",
            "Custom integration support",
          ].map((line) => (
            <div key={line} className="flex items-center gap-2">
              <Check className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
              <span>{line}</span>
            </div>
          ))}
        </div>
        <Button
          size="sm"
          className="w-full sm:w-auto px-6"
          variant={isSelected ? "default" : "outline"}
          disabled={readOnly}
          onClick={onSelect}
        >
          {isSelected ? "Selected" : "Select All-Apps Unlimited"}
          {!isSelected && <ArrowRight className="w-3.5 h-3.5 ml-1.5" />}
        </Button>
      </CardContent>
    </Card>
  );
}

function EnterpriseCard({ bundle }: { bundle: PlatformBundle }) {
  return (
    <Card className="border-border/60 bg-gradient-to-br from-slate-900 to-slate-800 text-slate-50 shadow-lg overflow-hidden relative">
      <CardHeader className="relative">
        <div className="flex items-start justify-between gap-4">
          <div>
            <CardTitle className="text-xl flex items-center gap-2 text-slate-50">
              <Building2 className="w-5 h-5 text-amber-400" />
              {bundle.name}
            </CardTitle>
            <CardDescription className="mt-1 max-w-2xl text-slate-300">
              {bundle.description}
            </CardDescription>
          </div>
          <div className="text-right shrink-0">
            <p className="text-2xl font-bold text-amber-400">Contact Sales</p>
            <p className="text-[11px] text-slate-400 mt-0.5">Custom pricing per dealer group</p>
          </div>
        </div>
      </CardHeader>
      <CardContent className="relative space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 text-xs text-slate-200">
          {[
            "Multi-rooftop consolidated billing",
            "Cross-rooftop executive reporting",
            "Group-wide SSO & identity",
            "Named Enterprise Customer Success Manager",
            "Dedicated onboarding engineering team",
            "Custom integrations & data pipelines",
            "Negotiated multi-rooftop pricing",
            "Priority roadmap influence",
          ].map((line) => (
            <div key={line} className="flex items-center gap-2">
              <Check className="w-3.5 h-3.5 text-amber-400 shrink-0" />
              <span>{line}</span>
            </div>
          ))}
        </div>
        <Button
          size="sm"
          variant="secondary"
          className="w-full sm:w-auto px-6 bg-amber-400 hover:bg-amber-300 text-slate-900 font-semibold"
          asChild
        >
          <a href="mailto:sales@autocurb.io?subject=Enterprise%20Dealer%20Group%20Inquiry">
            <Phone className="w-4 h-4 mr-2" />
            Contact Enterprise Sales
          </a>
        </Button>
      </CardContent>
    </Card>
  );
}

export default PricingPlanPicker;
