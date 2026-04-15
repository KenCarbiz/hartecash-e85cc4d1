import type { PlatformBundle, PlatformProduct, PlatformProductTier } from "@/lib/entitlements";
import { formatUSD } from "@/lib/entitlements";
import { Card, CardContent } from "@/components/ui/card";
import { Check, Gift, Sparkles, Building2, Phone } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * High-end "big button row" pricing layout used on the admin Billing &
 * Plan screen. Each product is a horizontal row with big tier buttons
 * side by side, left-to-right. Auto-greens any tier that is
 * complimentary based on the current selection (AutoLabels Basic
 * turns green when AutoCurb OR AutoLabels Premium is picked).
 *
 * Pure presentation — state + data come from the parent PricingPlanPicker.
 */

export type ComplimentaryMap = Record<string /* tier_id */, string /* reason */>;

interface BigButtonRowsProps {
  products: PlatformProduct[];
  tiersByProduct: Map<string, PlatformProductTier[]>;
  featuredBundle: PlatformBundle | null;
  enterpriseBundle: PlatformBundle | null;
  productIconFor: (iconName: string) => React.ElementType;

  selectedTiers: Record<string, string>; // product_id -> tier_id
  selectedBundle: string | null;
  cycle: "monthly" | "annual";
  complimentary: ComplimentaryMap;

  readOnly?: boolean;
  onSelectTier: (productId: string, tierId: string, cycle?: "monthly" | "annual") => void;
  onSelectBundle: (bundleId: string, cycle: "monthly" | "annual") => void;
}

export function BigButtonRows({
  products,
  tiersByProduct,
  featuredBundle,
  enterpriseBundle,
  productIconFor,
  selectedTiers,
  selectedBundle,
  cycle,
  complimentary,
  readOnly = false,
  onSelectTier,
  onSelectBundle,
}: BigButtonRowsProps) {
  return (
    <div className="space-y-4">
      {products.map((product) => {
        const list = (tiersByProduct.get(product.id) ?? []).filter((t) => t.is_active);
        if (list.length === 0) return null;
        return (
          <ProductRow
            key={product.id}
            product={product}
            tiers={list}
            Icon={productIconFor(product.icon_name)}
            selectedTierId={selectedTiers[product.id] ?? null}
            cycle={cycle}
            complimentary={complimentary}
            isBundleActive={Boolean(selectedBundle)}
            readOnly={readOnly}
            onSelectTier={(tid, c) => onSelectTier(product.id, tid, c)}
          />
        );
      })}

      {featuredBundle && (
        <BundleRow
          bundle={featuredBundle}
          cycle={cycle}
          isSelected={selectedBundle === featuredBundle.id}
          readOnly={readOnly}
          onSelect={(c) => onSelectBundle(featuredBundle.id, c)}
        />
      )}

      {enterpriseBundle && <EnterpriseRow bundle={enterpriseBundle} />}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────
// Rows
// ─────────────────────────────────────────────────────────────────────

function ProductRow({
  product,
  tiers,
  Icon,
  selectedTierId,
  cycle,
  complimentary,
  isBundleActive,
  readOnly,
  onSelectTier,
}: {
  product: PlatformProduct;
  tiers: PlatformProductTier[];
  Icon: React.ElementType;
  selectedTierId: string | null;
  cycle: "monthly" | "annual";
  complimentary: ComplimentaryMap;
  isBundleActive: boolean;
  readOnly: boolean;
  onSelectTier: (tierId: string, cycle?: "monthly" | "annual") => void;
}) {
  // Special-case AutoCurb: single tier but shows a Monthly + Annual pair.
  // For products where ONE tier has a meaningful annual_price and only one
  // tier exists, we split it into two pill buttons.
  const hasSingleAnnualDualTier =
    tiers.length === 1 && tiers[0].annual_price != null && tiers[0].annual_price > 0;

  const panelDisabled = readOnly || isBundleActive;

  return (
    <Card
      className={`overflow-hidden border-border/60 transition-opacity ${
        isBundleActive ? "opacity-60" : ""
      }`}
    >
      <CardContent className="p-4 sm:p-5">
        <div className="flex flex-col md:flex-row md:items-center gap-4">
          {/* Left: product identity */}
          <div className="flex items-start gap-3 md:w-60 md:shrink-0">
            <div className="w-11 h-11 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
              <Icon className="w-5 h-5 text-primary" />
            </div>
            <div className="min-w-0">
              <p className="text-[15px] font-bold text-card-foreground leading-tight">
                {product.name}
              </p>
              <p className="text-[11px] text-muted-foreground mt-0.5 leading-snug">
                {product.description}
              </p>
            </div>
          </div>

          {/* Right: tier buttons, horizontal */}
          <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
            {hasSingleAnnualDualTier ? (
              <>
                <TierButton
                  tier={tiers[0]}
                  kind="monthly"
                  selected={selectedTierId === tiers[0].id && cycle === "monthly"}
                  complimentaryReason={null}
                  disabled={panelDisabled}
                  onClick={() => onSelectTier(tiers[0].id, "monthly")}
                />
                <TierButton
                  tier={tiers[0]}
                  kind="annual"
                  selected={selectedTierId === tiers[0].id && cycle === "annual"}
                  complimentaryReason={null}
                  disabled={panelDisabled}
                  onClick={() => onSelectTier(tiers[0].id, "annual")}
                />
              </>
            ) : (
              tiers.map((tier) => (
                <TierButton
                  key={tier.id}
                  tier={tier}
                  kind="tier"
                  selected={selectedTierId === tier.id}
                  complimentaryReason={complimentary[tier.id] ?? null}
                  disabled={panelDisabled || Boolean(complimentary[tier.id])}
                  onClick={() => onSelectTier(tier.id)}
                />
              ))
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ─────────────────────────────────────────────────────────────────────
// A big pill-style tier button
// ─────────────────────────────────────────────────────────────────────

interface TierButtonProps {
  tier: PlatformProductTier;
  /** "monthly" / "annual" render monthly-vs-annual split for a single
   *  tier (AutoCurb); "tier" renders a normal tier pick. */
  kind: "monthly" | "annual" | "tier";
  selected: boolean;
  complimentaryReason: string | null;
  disabled: boolean;
  onClick: () => void;
}

function TierButton({
  tier,
  kind,
  selected,
  complimentaryReason,
  disabled,
  onClick,
}: TierButtonProps) {
  // Complimentary tier? Green pill, disabled, "Included" copy.
  if (complimentaryReason) {
    return (
      <div className="relative rounded-xl border-2 border-emerald-500/50 bg-emerald-50 px-4 py-3 text-left shadow-sm">
        <div className="absolute top-2 right-2">
          <Gift className="w-3.5 h-3.5 text-emerald-600" />
        </div>
        <p className="text-[11px] font-bold uppercase tracking-wider text-emerald-700">
          {tier.name}
        </p>
        <p className="text-xl font-bold text-emerald-700 mt-0.5 leading-none">Included</p>
        <p className="text-[10px] text-emerald-700/80 mt-1 leading-snug">
          Free with {complimentaryReason}
        </p>
      </div>
    );
  }

  const monthlyPerMo = tier.monthly_price;
  const annualPerMoEquivalent =
    tier.annual_price != null ? Number(tier.annual_price) / 12 : null;

  let header = "";
  let bigPrice = "";
  let smallPrice = "";
  let caption = "";
  let badge: string | null = null;

  if (kind === "monthly") {
    header = "Monthly";
    bigPrice = formatUSD(monthlyPerMo);
    smallPrice = "/mo";
    caption = "Billed monthly";
  } else if (kind === "annual" && annualPerMoEquivalent != null) {
    const monthsSaved =
      monthlyPerMo * 12 > Number(tier.annual_price!)
        ? Math.round((1 - Number(tier.annual_price!) / (monthlyPerMo * 12)) * 100)
        : 0;
    header = "Annual — Prepaid";
    bigPrice = formatUSD(Math.round(annualPerMoEquivalent));
    smallPrice = "/mo";
    caption = `${formatUSD(Number(tier.annual_price!))} upfront, 12 months`;
    if (monthsSaved > 0) badge = `Save ${monthsSaved}%`;
  } else {
    header = tier.name;
    bigPrice = formatUSD(monthlyPerMo);
    smallPrice = "/mo";
    // Inventory limit / overage summary line
    const inv = tier.inventory_limit != null ? `Up to ${tier.inventory_limit} units` : null;
    const over =
      tier.allow_overage && tier.overage_price_per_unit != null
        ? `+ ${formatUSD(tier.overage_price_per_unit)}/unit over cap`
        : null;
    caption = inv && over ? `${inv} · ${over}` : (inv ?? over ?? (tier.description ?? ""));
    if (tier.is_introductory) badge = "Intro";
  }

  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      aria-pressed={selected}
      className={`group relative rounded-xl border-2 px-4 py-3 text-left transition-all ${
        selected
          ? "border-primary bg-primary/[0.06] shadow-md ring-2 ring-primary/20"
          : disabled
            ? "border-border/40 bg-muted/30 cursor-not-allowed"
            : "border-border/60 bg-card hover:border-primary/40 hover:shadow-sm"
      }`}
    >
      {badge && (
        <span
          className={`absolute top-2 right-2 text-[9px] font-bold uppercase tracking-wider rounded-full px-2 py-0.5 ${
            kind === "annual" ? "bg-emerald-500 text-white" : "bg-amber-500 text-white"
          }`}
        >
          {badge}
        </span>
      )}
      <p
        className={`text-[10px] font-bold uppercase tracking-wider ${
          selected ? "text-primary" : "text-muted-foreground"
        }`}
      >
        {header}
      </p>
      <p className="text-2xl font-bold text-card-foreground mt-0.5 leading-none">
        {bigPrice}
        <span className="text-[11px] font-normal text-muted-foreground ml-0.5">
          {smallPrice}
        </span>
      </p>
      {caption && (
        <p className="text-[10px] text-muted-foreground mt-1.5 leading-snug line-clamp-2">
          {caption}
        </p>
      )}
      {selected && (
        <div className="absolute bottom-2 right-2">
          <Check className="w-3.5 h-3.5 text-primary" />
        </div>
      )}
    </button>
  );
}

// ─────────────────────────────────────────────────────────────────────
// Bundle row (All-Apps Unlimited) — featured gradient, monthly + annual
// ─────────────────────────────────────────────────────────────────────

function BundleRow({
  bundle,
  cycle,
  isSelected,
  readOnly,
  onSelect,
}: {
  bundle: PlatformBundle;
  cycle: "monthly" | "annual";
  isSelected: boolean;
  readOnly: boolean;
  onSelect: (cycle: "monthly" | "annual") => void;
}) {
  const annualPerMo =
    bundle.annual_price != null ? Number(bundle.annual_price) / 12 : null;
  const savePct =
    bundle.annual_price != null && bundle.monthly_price * 12 > Number(bundle.annual_price)
      ? Math.round(
          (1 - Number(bundle.annual_price) / (bundle.monthly_price * 12)) * 100,
        )
      : 0;

  return (
    <Card
      className={`relative overflow-hidden border-2 transition-all ${
        isSelected
          ? "border-primary shadow-xl ring-2 ring-primary/30"
          : "border-primary/30 shadow-lg"
      }`}
    >
      <div className="absolute inset-0 bg-gradient-to-br from-primary/10 via-primary/[0.04] to-transparent pointer-events-none" />
      <div className="absolute top-0 right-0 bg-gradient-to-r from-primary to-primary/80 text-primary-foreground text-[10px] font-bold uppercase tracking-wider px-3 py-1 rounded-bl-lg shadow-sm">
        Best Value
      </div>

      <CardContent className="relative p-4 sm:p-5">
        <div className="flex flex-col md:flex-row md:items-center gap-4">
          <div className="flex items-start gap-3 md:w-60 md:shrink-0">
            <div className="w-11 h-11 rounded-xl bg-primary/15 flex items-center justify-center shrink-0">
              <Sparkles className="w-5 h-5 text-primary" />
            </div>
            <div className="min-w-0">
              <p className="text-[15px] font-bold text-card-foreground leading-tight">
                {bundle.name}
              </p>
              <p className="text-[11px] text-muted-foreground mt-0.5 leading-snug">
                Everything unlocked · White-glove service · Priority 24/7 support
              </p>
            </div>
          </div>

          <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            {/* Monthly */}
            <button
              type="button"
              disabled={readOnly}
              onClick={() => onSelect("monthly")}
              aria-pressed={isSelected && cycle === "monthly"}
              className={`relative rounded-xl border-2 px-4 py-3 text-left transition-all ${
                isSelected && cycle === "monthly"
                  ? "border-primary bg-primary/[0.08] shadow-md ring-2 ring-primary/20"
                  : readOnly
                    ? "border-border/40 bg-muted/30 cursor-not-allowed"
                    : "border-border/60 bg-card hover:border-primary/40 hover:shadow-sm"
              }`}
            >
              <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                Monthly
              </p>
              <p className="text-2xl font-bold text-card-foreground mt-0.5 leading-none">
                {formatUSD(bundle.monthly_price)}
                <span className="text-[11px] font-normal text-muted-foreground ml-0.5">
                  /mo
                </span>
              </p>
              <p className="text-[10px] text-muted-foreground mt-1.5">Billed monthly</p>
              {isSelected && cycle === "monthly" && (
                <Check className="w-3.5 h-3.5 text-primary absolute bottom-2 right-2" />
              )}
            </button>

            {/* Annual */}
            {annualPerMo != null ? (
              <button
                type="button"
                disabled={readOnly}
                onClick={() => onSelect("annual")}
                aria-pressed={isSelected && cycle === "annual"}
                className={`relative rounded-xl border-2 px-4 py-3 text-left transition-all ${
                  isSelected && cycle === "annual"
                    ? "border-primary bg-primary/[0.08] shadow-md ring-2 ring-primary/20"
                    : readOnly
                      ? "border-border/40 bg-muted/30 cursor-not-allowed"
                      : "border-border/60 bg-card hover:border-primary/40 hover:shadow-sm"
                }`}
              >
                {savePct > 0 && (
                  <span className="absolute top-2 right-2 text-[9px] font-bold uppercase tracking-wider rounded-full px-2 py-0.5 bg-emerald-500 text-white">
                    Save {savePct}%
                  </span>
                )}
                <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                  Annual — Prepaid
                </p>
                <p className="text-2xl font-bold text-card-foreground mt-0.5 leading-none">
                  {formatUSD(Math.round(annualPerMo))}
                  <span className="text-[11px] font-normal text-muted-foreground ml-0.5">
                    /mo
                  </span>
                </p>
                <p className="text-[10px] text-muted-foreground mt-1.5">
                  {formatUSD(Number(bundle.annual_price!))} upfront, 12 months
                </p>
                {isSelected && cycle === "annual" && (
                  <Check className="w-3.5 h-3.5 text-primary absolute bottom-2 right-2" />
                )}
              </button>
            ) : null}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ─────────────────────────────────────────────────────────────────────
// Enterprise — contact-sales row (dark)
// ─────────────────────────────────────────────────────────────────────

function EnterpriseRow({ bundle }: { bundle: PlatformBundle }) {
  return (
    <Card className="border-border/60 bg-gradient-to-br from-slate-900 to-slate-800 text-slate-50 overflow-hidden">
      <CardContent className="p-4 sm:p-5">
        <div className="flex flex-col md:flex-row md:items-center gap-4">
          <div className="flex items-start gap-3 md:w-60 md:shrink-0">
            <div className="w-11 h-11 rounded-xl bg-amber-400/15 flex items-center justify-center shrink-0">
              <Building2 className="w-5 h-5 text-amber-400" />
            </div>
            <div className="min-w-0">
              <p className="text-[15px] font-bold text-slate-50 leading-tight">
                {bundle.name}
              </p>
              <p className="text-[11px] text-slate-300 mt-0.5 leading-snug">
                Dealer groups · Multi-rooftop pricing · Named CSM
              </p>
            </div>
          </div>
          <div className="flex-1 flex items-center justify-end gap-3">
            <div className="text-right">
              <p className="text-lg font-bold text-amber-400 leading-none">Contact Sales</p>
              <p className="text-[10px] text-slate-400 mt-1">Custom multi-rooftop pricing</p>
            </div>
            <Button
              size="sm"
              className="bg-amber-400 hover:bg-amber-300 text-slate-900 font-semibold"
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
