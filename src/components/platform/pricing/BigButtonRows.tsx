import type { PlatformBundle, PlatformProduct, PlatformProductTier } from "@/lib/entitlements";
import { formatUSD } from "@/lib/entitlements";
import { cn } from "@/lib/utils";
import {
  ArrowRight,
  Building2,
  CheckCircle2,
  Crown,
  Gift,
  Phone,
  Sparkles,
  Calendar,
  TrendingUp,
} from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * Premium horizontal "big button" pricing layout — matches the visual
 * language of the ArchitectureSelector cards above it (rounded-xl,
 * border-2, icon box on the left, hover-lift, CheckCircle2 when
 * selected). Each product is its own row of tier buttons, side-by-side.
 *
 * State of each tier button:
 *   1. Available     → subtle border, icon box neutral, ArrowRight
 *   2. Selected      → primary border + ring, icon box primary,
 *                       CheckCircle2
 *   3. Complimentary → emerald border/bg, Gift icon, "Included — Free
 *                       with X" copy, price struck-through
 *   4. Bundle-locked → dim + "Included in All-Apps" overlay when the
 *                       dealer picked the bundle
 */

export type ComplimentaryMap = Record<string /* tier_id */, string /* reason */>;

interface BigButtonRowsProps {
  products: PlatformProduct[];
  tiersByProduct: Map<string, PlatformProductTier[]>;
  featuredBundle: PlatformBundle | null;
  enterpriseBundle: PlatformBundle | null;
  productIconFor: (iconName: string) => React.ElementType;

  selectedTiers: Record<string, string>;
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
  const bundleActive = Boolean(selectedBundle);
  const bundleName = featuredBundle?.name ?? "bundle";

  return (
    <div className="space-y-4">
      {/* Single elegant banner when the bundle is active — replaces the
          noisy per-row "Included" ribbons. Restraint over repetition. */}
      {bundleActive && (
        <div className="flex items-center gap-2.5 rounded-xl border border-primary/25 bg-primary/[0.04] px-4 py-2.5 text-xs">
          <CheckCircle2 className="w-4 h-4 text-primary shrink-0" />
          <p className="text-card-foreground leading-snug">
            Your <span className="font-semibold">{bundleName}</span> plan
            covers every app below at its top tier. Pick a single app to
            switch to à la carte.
          </p>
        </div>
      )}

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
            bundleActive={bundleActive}
            bundleName={bundleName}
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
// Product row — premium card wrapper with product identity on the left
// and 1-3 tier buttons on the right
// ─────────────────────────────────────────────────────────────────────

function ProductRow({
  product,
  tiers,
  Icon,
  selectedTierId,
  cycle,
  complimentary,
  bundleActive,
  bundleName,
  readOnly,
  onSelectTier,
}: {
  product: PlatformProduct;
  tiers: PlatformProductTier[];
  Icon: React.ElementType;
  selectedTierId: string | null;
  cycle: "monthly" | "annual";
  complimentary: ComplimentaryMap;
  bundleActive: boolean;
  bundleName: string;
  readOnly: boolean;
  onSelectTier: (tierId: string, cycle?: "monthly" | "annual") => void;
}) {
  // AutoCurb special-case: one tier, shown as Monthly + Annual pair.
  const hasSingleAnnualDualTier =
    tiers.length === 1 && tiers[0].annual_price != null && Number(tiers[0].annual_price) > 0;

  const anyTierSelected = selectedTierId != null;
  const rowHasComplimentary =
    !anyTierSelected && tiers.some((t) => complimentary[t.id]);

  // Reference `bundleName` so TypeScript doesn't flag the prop as unused
  // now that the per-row ribbon is gone (banner at the top covers it).
  void bundleName;

  return (
    <div
      className={cn(
        "relative rounded-xl border-2 p-4 sm:p-5 transition-all duration-200",
        bundleActive
          ? "border-border/60 bg-muted/20 opacity-60"
          : anyTierSelected
            ? "border-primary/40 bg-primary/[0.02] shadow-sm"
            : rowHasComplimentary
              ? "border-emerald-500/30 bg-emerald-500/[0.03]"
              : "border-border bg-card",
      )}
    >

      <div className="flex flex-col md:flex-row md:items-stretch gap-4">
        {/* Left: product identity (matches ArchitectureSelector icon + title) */}
        <div className="flex items-start gap-3 md:w-60 md:shrink-0">
          <div
            className={cn(
              "flex items-center justify-center w-11 h-11 sm:w-12 sm:h-12 rounded-xl shrink-0 transition-colors",
              bundleActive || anyTierSelected
                ? "bg-primary text-primary-foreground shadow-sm"
                : "bg-muted text-muted-foreground",
            )}
          >
            <Icon className="w-5 h-5 sm:w-6 sm:h-6" />
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="font-bold text-[15px] sm:text-base text-card-foreground leading-tight">
              {product.name}
            </h3>
            <p className="text-[11px] sm:text-xs text-muted-foreground mt-0.5 leading-snug">
              {product.description}
            </p>
          </div>
        </div>

        {/* Right: tier buttons, horizontal, left-to-right */}
        <div
          className={cn(
            "flex-1 grid gap-2.5",
            hasSingleAnnualDualTier || tiers.length === 2
              ? "grid-cols-1 sm:grid-cols-2"
              : tiers.length === 3
                ? "grid-cols-1 sm:grid-cols-3"
                : "grid-cols-1",
          )}
        >
          {hasSingleAnnualDualTier ? (
            <>
              <TierButton
                tier={tiers[0]}
                kind="monthly"
                selected={selectedTierId === tiers[0].id && cycle === "monthly"}
                complimentaryReason={null}
                disabled={readOnly || bundleActive}
                bundleCovered={bundleActive}
                onClick={() => onSelectTier(tiers[0].id, "monthly")}
              />
              <TierButton
                tier={tiers[0]}
                kind="annual"
                selected={selectedTierId === tiers[0].id && cycle === "annual"}
                complimentaryReason={null}
                disabled={readOnly || bundleActive}
                bundleCovered={bundleActive}
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
                disabled={
                  readOnly ||
                  bundleActive ||
                  Boolean(complimentary[tier.id])
                }
                bundleCovered={bundleActive}
                onClick={() => onSelectTier(tier.id)}
              />
            ))
          )}
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────
// A premium tier button (wide pill, icon box, title, big price, check)
// ─────────────────────────────────────────────────────────────────────

interface TierButtonProps {
  tier: PlatformProductTier;
  kind: "monthly" | "annual" | "tier";
  selected: boolean;
  complimentaryReason: string | null;
  disabled: boolean;
  bundleCovered: boolean;
  onClick: () => void;
}

function TierButton({
  tier,
  kind,
  selected,
  complimentaryReason,
  disabled,
  bundleCovered,
  onClick,
}: TierButtonProps) {
  // ── Complimentary state (emerald, Gift icon, crossed-out price) ────
  if (complimentaryReason && !bundleCovered) {
    return (
      <div className="group relative flex items-center gap-3 rounded-xl border-2 border-emerald-500/50 bg-emerald-500/[0.06] p-4 text-left transition-all">
        <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-emerald-500 text-white shrink-0 shadow-sm">
          <Gift className="w-5 h-5" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[11px] font-bold uppercase tracking-wider text-emerald-700">
            {tier.name}
          </p>
          <p className="text-lg font-bold text-emerald-800 leading-none mt-0.5">
            Included
            <span className="ml-1.5 text-xs font-normal text-emerald-700 line-through">
              {formatUSD(tier.monthly_price)}/mo
            </span>
          </p>
          <p className="text-[10px] text-emerald-700/80 mt-1 leading-snug">
            Free with {complimentaryReason}
          </p>
        </div>
        <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
      </div>
    );
  }

  // ── Header / price / caption derivation ────────────────────────────
  const monthlyPrice = tier.monthly_price;
  const annualPerMo =
    tier.annual_price != null ? Number(tier.annual_price) / 12 : null;

  let header: string;
  let bigPrice: string;
  let smallUnit: string;
  let caption: string;
  let badge: { label: string; tone: "emerald" | "amber" | "primary" } | null =
    null;
  let headerIcon: React.ElementType = TrendingUp;

  if (kind === "monthly") {
    header = "Monthly";
    bigPrice = formatUSD(monthlyPrice);
    smallUnit = "/mo";
    caption = "Billed monthly, cancel any time";
    headerIcon = TrendingUp;
  } else if (kind === "annual" && annualPerMo != null) {
    const savePct =
      monthlyPrice * 12 > Number(tier.annual_price!)
        ? Math.round((1 - Number(tier.annual_price!) / (monthlyPrice * 12)) * 100)
        : 0;
    header = "Annual Prepaid";
    bigPrice = formatUSD(Math.round(annualPerMo));
    smallUnit = "/mo";
    caption = `${formatUSD(Number(tier.annual_price!))} upfront · 12 months`;
    if (savePct > 0) badge = { label: `Save ${savePct}%`, tone: "emerald" };
    headerIcon = Calendar;
  } else {
    header = tier.name;
    bigPrice = formatUSD(monthlyPrice);
    smallUnit = "/mo";
    const inv =
      tier.inventory_limit != null
        ? `Up to ${tier.inventory_limit.toLocaleString()} units`
        : null;
    caption = inv ?? tier.description ?? "";
    if (tier.is_introductory) badge = { label: "Intro", tone: "amber" };
  }

  const HeaderIcon = headerIcon;

  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      aria-pressed={selected}
      className={cn(
        "group relative flex items-start gap-3 rounded-xl border-2 p-4 text-left transition-all duration-200",
        selected
          ? "border-primary bg-primary/5 ring-2 ring-primary/20 shadow-md"
          : bundleCovered
            ? "border-border/40 bg-muted/10 opacity-70 cursor-not-allowed"
            : disabled
              ? "border-border/40 bg-muted/20 cursor-not-allowed opacity-70"
              : "border-border bg-card hover:border-primary/40 hover:shadow-md hover:-translate-y-0.5",
      )}
    >
      {/* Icon box on the left, mirrors ArchitectureSelector */}
      <div
        className={cn(
          "flex items-center justify-center w-10 h-10 rounded-lg shrink-0 transition-colors",
          selected
            ? "bg-primary text-primary-foreground shadow-sm"
            : "bg-muted text-muted-foreground group-hover:bg-primary/10 group-hover:text-primary",
        )}
      >
        <HeaderIcon className="w-5 h-5" />
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 flex-wrap">
          <p
            className={cn(
              "text-[10px] font-bold uppercase tracking-wider",
              selected ? "text-primary" : "text-muted-foreground",
            )}
          >
            {header}
          </p>
          {badge && (
            <span
              className={cn(
                "text-[9px] font-bold uppercase tracking-wider rounded-full px-2 py-0.5",
                badge.tone === "emerald" && "bg-emerald-500 text-white",
                badge.tone === "amber" &&
                  "bg-amber-500/10 text-amber-600 border border-amber-500/20",
                badge.tone === "primary" &&
                  "bg-primary/10 text-primary border border-primary/20",
              )}
            >
              {badge.label}
            </span>
          )}
        </div>
        <p className="text-2xl font-bold text-card-foreground leading-none mt-1">
          {bigPrice}
          <span className="text-[11px] font-normal text-muted-foreground ml-0.5">
            {smallUnit}
          </span>
        </p>
        {caption && (
          <p className="text-[10px] text-muted-foreground mt-1.5 leading-snug line-clamp-2">
            {caption}
          </p>
        )}
      </div>

      {/* Trailing indicator */}
      <div className="shrink-0 mt-0.5">
        {selected ? (
          <CheckCircle2 className="w-5 h-5 text-primary" />
        ) : (
          <ArrowRight
            className={cn(
              "w-4 h-4 transition-colors",
              bundleCovered
                ? "text-muted-foreground/20"
                : "text-muted-foreground/30 group-hover:text-primary/50",
            )}
          />
        )}
      </div>
    </button>
  );
}

// ─────────────────────────────────────────────────────────────────────
// Bundle row — All-Apps Unlimited with Monthly/Annual pair, gradient
// background and a "Best Value" ribbon
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
    bundle.annual_price != null &&
    bundle.monthly_price * 12 > Number(bundle.annual_price)
      ? Math.round(
          (1 - Number(bundle.annual_price) / (bundle.monthly_price * 12)) * 100,
        )
      : 0;

  return (
    <div
      className={cn(
        "relative rounded-xl border-2 p-4 sm:p-5 transition-all duration-200 overflow-hidden",
        isSelected
          ? "border-primary bg-primary/[0.04] ring-2 ring-primary/20 shadow-lg"
          : "border-primary/30 bg-gradient-to-br from-primary/[0.06] via-primary/[0.02] to-transparent shadow-md",
      )}
    >
      {/* Best Value ribbon */}
      <div className="absolute top-0 right-0 bg-gradient-to-r from-primary to-primary/80 text-primary-foreground text-[10px] font-bold uppercase tracking-wider px-3 py-1 rounded-bl-xl shadow-sm">
        Best Value · All-in-One
      </div>

      <div className="flex flex-col md:flex-row md:items-stretch gap-4 mt-4 md:mt-0">
        {/* Left: bundle identity — mirrors ArchitectureSelector */}
        <div className="flex items-start gap-3 md:w-60 md:shrink-0">
          <div className="flex items-center justify-center w-11 h-11 sm:w-12 sm:h-12 rounded-xl bg-primary text-primary-foreground shrink-0 shadow-sm">
            <Sparkles className="w-5 h-5 sm:w-6 sm:h-6" />
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="font-bold text-[15px] sm:text-base text-card-foreground leading-tight">
              {bundle.name}
            </h3>
            <p className="text-[11px] sm:text-xs text-muted-foreground mt-0.5 leading-snug">
              Everything unlocked · White-glove service · Priority 24/7 support
            </p>
          </div>
        </div>

        {/* Right: Monthly + Annual tier buttons */}
        <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 gap-2.5">
          {/* Monthly */}
          <button
            type="button"
            disabled={readOnly}
            onClick={() => onSelect("monthly")}
            aria-pressed={isSelected && cycle === "monthly"}
            className={cn(
              "group relative flex items-start gap-3 rounded-xl border-2 p-4 text-left transition-all duration-200",
              isSelected && cycle === "monthly"
                ? "border-primary bg-primary/5 ring-2 ring-primary/20 shadow-md"
                : readOnly
                  ? "border-border/40 bg-muted/20 cursor-not-allowed opacity-70"
                  : "border-border bg-card hover:border-primary/40 hover:shadow-md hover:-translate-y-0.5",
            )}
          >
            <div
              className={cn(
                "flex items-center justify-center w-10 h-10 rounded-lg shrink-0 transition-colors",
                isSelected && cycle === "monthly"
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "bg-muted text-muted-foreground group-hover:bg-primary/10 group-hover:text-primary",
              )}
            >
              <TrendingUp className="w-5 h-5" />
            </div>
            <div className="flex-1 min-w-0">
              <p
                className={cn(
                  "text-[10px] font-bold uppercase tracking-wider",
                  isSelected && cycle === "monthly"
                    ? "text-primary"
                    : "text-muted-foreground",
                )}
              >
                Monthly
              </p>
              <p className="text-2xl font-bold text-card-foreground leading-none mt-1">
                {formatUSD(bundle.monthly_price)}
                <span className="text-[11px] font-normal text-muted-foreground ml-0.5">
                  /mo
                </span>
              </p>
              <p className="text-[10px] text-muted-foreground mt-1.5 leading-snug">
                Billed monthly, cancel any time
              </p>
            </div>
            <div className="shrink-0 mt-0.5">
              {isSelected && cycle === "monthly" ? (
                <CheckCircle2 className="w-5 h-5 text-primary" />
              ) : (
                <ArrowRight className="w-4 h-4 text-muted-foreground/30 group-hover:text-primary/50 transition-colors" />
              )}
            </div>
          </button>

          {/* Annual */}
          {annualPerMo != null && (
            <button
              type="button"
              disabled={readOnly}
              onClick={() => onSelect("annual")}
              aria-pressed={isSelected && cycle === "annual"}
              className={cn(
                "group relative flex items-start gap-3 rounded-xl border-2 p-4 text-left transition-all duration-200",
                isSelected && cycle === "annual"
                  ? "border-primary bg-primary/5 ring-2 ring-primary/20 shadow-md"
                  : readOnly
                    ? "border-border/40 bg-muted/20 cursor-not-allowed opacity-70"
                    : "border-border bg-card hover:border-primary/40 hover:shadow-md hover:-translate-y-0.5",
              )}
            >
              <div
                className={cn(
                  "flex items-center justify-center w-10 h-10 rounded-lg shrink-0 transition-colors",
                  isSelected && cycle === "annual"
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "bg-muted text-muted-foreground group-hover:bg-primary/10 group-hover:text-primary",
                )}
              >
                <Calendar className="w-5 h-5" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <p
                    className={cn(
                      "text-[10px] font-bold uppercase tracking-wider",
                      isSelected && cycle === "annual"
                        ? "text-primary"
                        : "text-muted-foreground",
                    )}
                  >
                    Annual Prepaid
                  </p>
                  {savePct > 0 && (
                    <span className="text-[9px] font-bold uppercase tracking-wider rounded-full px-2 py-0.5 bg-emerald-500 text-white">
                      Save {savePct}%
                    </span>
                  )}
                </div>
                <p className="text-2xl font-bold text-card-foreground leading-none mt-1">
                  {formatUSD(Math.round(annualPerMo))}
                  <span className="text-[11px] font-normal text-muted-foreground ml-0.5">
                    /mo
                  </span>
                </p>
                <p className="text-[10px] text-muted-foreground mt-1.5 leading-snug">
                  {formatUSD(Number(bundle.annual_price!))} upfront · 12 months
                </p>
              </div>
              <div className="shrink-0 mt-0.5">
                {isSelected && cycle === "annual" ? (
                  <CheckCircle2 className="w-5 h-5 text-primary" />
                ) : (
                  <ArrowRight className="w-4 h-4 text-muted-foreground/30 group-hover:text-primary/50 transition-colors" />
                )}
              </div>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────
// Enterprise row — dark slate, Contact Sales
// ─────────────────────────────────────────────────────────────────────

function EnterpriseRow({ bundle }: { bundle: PlatformBundle }) {
  return (
    <div className="relative rounded-xl border-2 border-slate-800 bg-gradient-to-br from-slate-900 to-slate-800 text-slate-50 p-4 sm:p-5 overflow-hidden">
      <div className="flex flex-col md:flex-row md:items-center gap-4">
        <div className="flex items-start gap-3 md:w-60 md:shrink-0">
          <div className="flex items-center justify-center w-11 h-11 sm:w-12 sm:h-12 rounded-xl bg-amber-400 text-slate-900 shrink-0 shadow-sm">
            <Crown className="w-5 h-5 sm:w-6 sm:h-6" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="font-bold text-[15px] sm:text-base text-slate-50 leading-tight">
                {bundle.name}
              </h3>
              <span className="text-[9px] font-bold uppercase tracking-wider rounded-full px-2 py-0.5 bg-amber-400/20 text-amber-300 border border-amber-400/30">
                Custom Pricing
              </span>
            </div>
            <p className="text-[11px] sm:text-xs text-slate-300 mt-0.5 leading-snug">
              Dealer groups · Multi-rooftop · Named CSM · Consolidated billing
            </p>
          </div>
        </div>
        <div className="flex-1 flex items-center justify-end gap-3">
          <div className="text-right">
            <p className="text-lg font-bold text-amber-400 leading-none flex items-center gap-1 justify-end">
              <Building2 className="w-4 h-4" />
              Contact Sales
            </p>
            <p className="text-[10px] text-slate-400 mt-1">
              Custom multi-rooftop pricing
            </p>
          </div>
          <Button
            size="sm"
            className="bg-amber-400 hover:bg-amber-300 text-slate-900 font-semibold shadow-sm"
            asChild
          >
            <a href="mailto:sales@autocurb.io?subject=Enterprise%20Dealer%20Group%20Inquiry">
              <Phone className="w-3.5 h-3.5 mr-1.5" />
              Talk to sales
            </a>
          </Button>
        </div>
      </div>
    </div>
  );
}
