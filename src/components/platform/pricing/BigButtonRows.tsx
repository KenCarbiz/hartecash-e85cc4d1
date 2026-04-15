import type { PlatformBundle, PlatformProduct, PlatformProductTier } from "@/lib/entitlements";
import { formatUSD } from "@/lib/entitlements";
import { cn } from "@/lib/utils";
import {
  Building2,
  CheckCircle2,
  Crown,
  Gift,
  Phone,
  Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  ALL_APPS_GRADIENT_BAR,
  ALL_APPS_GRADIENT_BG,
  brandFor,
  type ProductBrand,
} from "./brandColors";

/**
 * Premium "big button" pricing layout. Audi/Ferrari design rules:
 *   • Brand-color identity per product (green AutoCurb, orange
 *     AutoLabels, blue AutoFilm, purple AutoFrame). Selection ring
 *     and icon use the product's brand color, not generic primary.
 *   • Borders whisper, never shout — 1px hairlines, never border-2.
 *   • One identity per row (the product icon-box on the left).
 *     Tier buttons themselves are pure typography — no inner icon
 *     boxes, no trailing arrows. Just label, price, caption, and
 *     a check-mark when chosen.
 *   • Letter-spaced uppercase labels for the haute-couture feel.
 *   • Generous interior padding — the menu of a Michelin restaurant.
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
  /** tier_id → human-readable reason this tier is gated in the
   *  caller's context (e.g. architecture-specific). Buttons render
   *  greyed-out and un-clickable with the reason in micro-text. */
  unavailableTiers?: Record<string, string>;

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
  unavailableTiers,
  readOnly = false,
  onSelectTier,
  onSelectBundle,
}: BigButtonRowsProps) {
  const bundleActive = Boolean(selectedBundle);
  const bundleName = featuredBundle?.name ?? "bundle";

  return (
    <div className="space-y-3">
      {bundleActive && (
        <div className="relative overflow-hidden rounded-2xl border border-border/60 bg-card px-4 py-3">
          <div className={cn("absolute inset-x-0 top-0 h-0.5", ALL_APPS_GRADIENT_BAR)} />
          <div className="flex items-center gap-2.5">
            <CheckCircle2 className="w-4 h-4 text-foreground/70 shrink-0" />
            <p className="text-xs text-muted-foreground leading-snug">
              Your <span className="font-semibold text-foreground">{bundleName}</span> plan
              covers every app below at its top tier. Pick a single app to switch to à la carte.
            </p>
          </div>
        </div>
      )}

      {products.map((product) => {
        const list = (tiersByProduct.get(product.id) ?? []).filter((t) => t.is_active);
        if (list.length === 0) return null;
        const brand = brandFor(product.id);
        return (
          <ProductRow
            key={product.id}
            product={product}
            tiers={list}
            Icon={productIconFor(product.icon_name)}
            brand={brand}
            selectedTierId={selectedTiers[product.id] ?? null}
            cycle={cycle}
            complimentary={complimentary}
            unavailableTiers={unavailableTiers}
            bundleActive={bundleActive}
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
// Product row — identity on the left, tier buttons on the right
// ─────────────────────────────────────────────────────────────────────

function ProductRow({
  product,
  tiers,
  Icon,
  brand,
  selectedTierId,
  cycle,
  complimentary,
  unavailableTiers,
  bundleActive,
  readOnly,
  onSelectTier,
}: {
  product: PlatformProduct;
  tiers: PlatformProductTier[];
  Icon: React.ElementType;
  brand: ProductBrand;
  selectedTierId: string | null;
  cycle: "monthly" | "annual";
  complimentary: ComplimentaryMap;
  unavailableTiers?: Record<string, string>;
  bundleActive: boolean;
  readOnly: boolean;
  onSelectTier: (tierId: string, cycle?: "monthly" | "annual") => void;
}) {
  // AutoCurb / AutoFilm: one tier shown as a Monthly + Annual pair.
  const hasSingleAnnualDualTier =
    tiers.length === 1 &&
    tiers[0].annual_price != null &&
    Number(tiers[0].annual_price) > 0;

  const anyTierSelected = selectedTierId != null;
  const rowHasComplimentary =
    !anyTierSelected && tiers.some((t) => complimentary[t.id]);

  return (
    <div
      className={cn(
        "relative rounded-2xl border bg-card transition-all duration-200",
        bundleActive
          ? "border-border/40 opacity-60"
          : anyTierSelected
            ? cn(brand.border, brand.softBg, "shadow-sm")
            : rowHasComplimentary
              ? "border-emerald-500/30 bg-emerald-500/[0.02]"
              : "border-border/60 hover:border-border",
      )}
    >
      <div className="p-5 sm:p-6 flex flex-col md:flex-row md:items-center gap-5">
        {/* Left: brand-tinted product identity */}
        <div className="flex items-center gap-3.5 md:w-56 md:shrink-0">
          <div
            className={cn(
              "flex items-center justify-center w-12 h-12 rounded-xl shrink-0 transition-all duration-200",
              anyTierSelected || rowHasComplimentary
                ? brand.iconBg
                : brand.iconTint,
            )}
          >
            <Icon className="w-6 h-6" />
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="font-semibold text-[15px] text-card-foreground leading-tight tracking-tight">
              {product.name}
              <span className="text-muted-foreground/60 font-normal">.io</span>
            </h3>
            <p className="text-[11px] text-muted-foreground mt-1 leading-snug line-clamp-2">
              {product.description}
            </p>
          </div>
        </div>

        {/* Right: tier buttons */}
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
                brand={brand}
                selected={selectedTierId === tiers[0].id && cycle === "monthly"}
                complimentaryReason={null}
                disabled={readOnly || bundleActive}
                bundleCovered={bundleActive}
                onClick={() => onSelectTier(tiers[0].id, "monthly")}
              />
              <TierButton
                tier={tiers[0]}
                kind="annual"
                brand={brand}
                selected={selectedTierId === tiers[0].id && cycle === "annual"}
                complimentaryReason={null}
                disabled={readOnly || bundleActive}
                bundleCovered={bundleActive}
                onClick={() => onSelectTier(tiers[0].id, "annual")}
              />
            </>
          ) : (
            tiers.map((tier) => {
              const unavailableReason = unavailableTiers?.[tier.id] ?? null;
              return (
                <TierButton
                  key={tier.id}
                  tier={tier}
                  kind="tier"
                  brand={brand}
                  selected={selectedTierId === tier.id && !unavailableReason}
                  complimentaryReason={complimentary[tier.id] ?? null}
                  unavailableReason={unavailableReason}
                  disabled={
                    readOnly ||
                    bundleActive ||
                    Boolean(complimentary[tier.id]) ||
                    Boolean(unavailableReason)
                  }
                  bundleCovered={bundleActive}
                  onClick={() => onSelectTier(tier.id)}
                />
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────
// Tier button — pure typography, no inner icon box, no trailing arrow
// ─────────────────────────────────────────────────────────────────────

interface TierButtonProps {
  tier: PlatformProductTier;
  kind: "monthly" | "annual" | "tier";
  brand: ProductBrand;
  selected: boolean;
  complimentaryReason: string | null;
  /** Architecture / business-rule gate. When set, the button renders
   *  greyed-out and un-clickable with this text in the micro-slot. */
  unavailableReason?: string | null;
  disabled: boolean;
  bundleCovered: boolean;
  onClick: () => void;
}

function TierButton({
  tier,
  kind,
  brand,
  selected,
  complimentaryReason,
  unavailableReason,
  disabled,
  bundleCovered,
  onClick,
}: TierButtonProps) {
  // ── Unavailable state: greyed, crossed-out price, reason caption ──
  //    Shown when a business rule (e.g. dealership architecture)
  //    excludes this tier. Distinct from `disabled` because the visual
  //    carries a "why" — not just "you can't click."
  if (unavailableReason && !bundleCovered && !complimentaryReason) {
    return (
      <div
        className="relative rounded-xl border border-border/40 bg-muted/30 px-4 py-3.5 cursor-not-allowed opacity-70"
        aria-disabled="true"
      >
        <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground pr-5 truncate">
          {tier.name}
        </p>
        <p className="text-[28px] font-bold text-muted-foreground/80 leading-none mt-2 tabular-nums line-through decoration-muted-foreground/40">
          {formatUSD(tier.monthly_price)}
          <span className="text-xs font-normal text-muted-foreground/60 ml-0.5 tracking-tight no-underline">
            /mo
          </span>
        </p>
        <p className="text-[11px] font-medium mt-2 leading-snug line-clamp-1 text-muted-foreground">
          {unavailableReason}
        </p>
      </div>
    );
  }

  // ── Complimentary state: subtle emerald, no big icon box ──────────
  if (complimentaryReason && !bundleCovered) {
    return (
      <div className="relative rounded-xl border border-emerald-500/40 bg-emerald-500/[0.05] px-4 py-3.5">
        <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-emerald-700">
          {tier.name}
        </p>
        <p className="text-2xl font-bold text-emerald-800 leading-none mt-1.5 tabular-nums flex items-baseline gap-2">
          Included
          <span className="text-xs font-normal text-emerald-700/70 line-through">
            {formatUSD(tier.monthly_price)}/mo
          </span>
        </p>
        <p className="text-[10px] text-emerald-700/80 mt-1.5 leading-snug flex items-center gap-1">
          <Gift className="w-3 h-3 shrink-0" />
          Free with {complimentaryReason}
        </p>
      </div>
    );
  }

  // ── Header / price / caption derivation ──────────────────────────
  const monthlyPrice = tier.monthly_price;
  const annualPerMo =
    tier.annual_price != null ? Number(tier.annual_price) / 12 : null;

  // Derive the 3-row grammar every tier button renders:
  //   row 1 — uppercase tracking-wide label
  //   row 2 — big tabular price
  //   row 3 — muted micro-text (Pattern B from the Linear/GitHub/Apple
  //            research — savings and billing-cycle callouts live in
  //            the same baseline slot so sibling buttons align.)
  let header: string;
  let bigPrice: string;
  let smallUnit: string;
  let microText: { text: string; tone: "muted" | "emerald" | "amber" } = {
    text: "",
    tone: "muted",
  };

  if (kind === "monthly") {
    header = "Monthly";
    bigPrice = formatUSD(monthlyPrice);
    smallUnit = "/mo";
    microText = { text: "Billed monthly", tone: "muted" };
  } else if (kind === "annual" && annualPerMo != null) {
    const savePct =
      monthlyPrice * 12 > Number(tier.annual_price!)
        ? Math.round((1 - Number(tier.annual_price!) / (monthlyPrice * 12)) * 100)
        : 0;
    header = "Annual Prepaid";
    bigPrice = formatUSD(Math.round(annualPerMo));
    smallUnit = "/mo";
    // Pair-choice rule: savings sits in the same baseline slot as
    // "Billed monthly" on the sibling — never as an inline pill
    // beside the header (that broke alignment).
    microText =
      savePct > 0
        ? { text: `Save ${savePct}%`, tone: "emerald" }
        : { text: "Paid annually", tone: "muted" };
  } else {
    header = tier.name;
    bigPrice = formatUSD(monthlyPrice);
    smallUnit = "/mo";
    microText = tier.is_introductory
      ? { text: "Introductory pricing", tone: "amber" }
      : { text: tier.description?.trim() || "", tone: "muted" };
  }

  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      aria-pressed={selected}
      className={cn(
        "group relative rounded-xl border px-4 py-3.5 text-left transition-all duration-200",
        selected
          ? cn(brand.border, brand.softBg, "ring-2", brand.ring, "shadow-sm")
          : bundleCovered
            ? "border-border/40 opacity-70 cursor-not-allowed"
            : disabled
              ? "border-border/40 opacity-70 cursor-not-allowed"
              : "border-border/60 hover:border-border hover:shadow-sm hover:-translate-y-0.5 cursor-pointer",
      )}
    >
      {/* Selected check — top-right corner, brand-colored */}
      {selected && (
        <CheckCircle2
          className={cn("absolute top-2.5 right-2.5 w-4 h-4", brand.text)}
        />
      )}

      <p
        className={cn(
          "text-[10px] font-semibold uppercase tracking-[0.18em] pr-5 truncate",
          selected ? brand.text : "text-muted-foreground",
        )}
      >
        {header}
      </p>

      <p className="text-[28px] font-bold text-card-foreground leading-none mt-2 tabular-nums">
        {bigPrice}
        <span className="text-xs font-normal text-muted-foreground ml-0.5 tracking-tight">
          {smallUnit}
        </span>
      </p>

      {microText.text && (
        <p
          className={cn(
            "text-[11px] font-medium mt-2 leading-snug line-clamp-1",
            microText.tone === "emerald" && "text-emerald-600",
            microText.tone === "amber" && "text-amber-600",
            microText.tone === "muted" && "text-muted-foreground",
          )}
        >
          {microText.text}
        </p>
      )}
    </button>
  );
}

// ─────────────────────────────────────────────────────────────────────
// Bundle row — multi-color top bar (4 brand colors flowing) + Sparkles
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
        "relative overflow-hidden rounded-2xl border transition-all duration-200",
        isSelected
          ? "border-foreground/20 ring-2 ring-foreground/10 shadow-md"
          : "border-border/60",
        ALL_APPS_GRADIENT_BG,
      )}
    >
      {/* 4-color brand gradient bar — visual signature for "all apps" */}
      <div className={cn("absolute inset-x-0 top-0 h-0.5", ALL_APPS_GRADIENT_BAR)} />

      <div className="p-5 sm:p-6 flex flex-col md:flex-row md:items-center gap-5">
        {/* Left: bundle identity */}
        <div className="flex items-center gap-3.5 md:w-56 md:shrink-0">
          <div className="flex items-center justify-center w-12 h-12 rounded-xl shrink-0 bg-foreground text-background shadow-sm">
            <Sparkles className="w-6 h-6" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5 flex-wrap">
              <h3 className="font-semibold text-[15px] text-card-foreground leading-tight tracking-tight">
                {bundle.name}
              </h3>
              <span className="text-[9px] font-bold uppercase tracking-[0.15em] rounded-full px-2 py-0.5 bg-foreground text-background">
                Best Value
              </span>
            </div>
            <p className="text-[11px] text-muted-foreground mt-1 leading-snug">
              All four apps · White-glove service · Priority 24/7 support
            </p>
          </div>
        </div>

        <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 gap-2.5">
          <BundleButton
            label="Monthly"
            price={formatUSD(bundle.monthly_price)}
            microText={{ text: "Billed monthly", tone: "muted" }}
            selected={isSelected && cycle === "monthly"}
            disabled={readOnly}
            onClick={() => onSelect("monthly")}
          />
          {annualPerMo != null && (
            <BundleButton
              label="Annual Prepaid"
              price={formatUSD(Math.round(annualPerMo))}
              microText={
                savePct > 0
                  ? { text: `Save ${savePct}%`, tone: "emerald" }
                  : { text: "Paid annually", tone: "muted" }
              }
              selected={isSelected && cycle === "annual"}
              disabled={readOnly}
              onClick={() => onSelect("annual")}
            />
          )}
        </div>
      </div>
    </div>
  );
}

function BundleButton({
  label,
  price,
  microText,
  selected,
  disabled,
  onClick,
}: {
  label: string;
  price: string;
  microText: { text: string; tone: "muted" | "emerald" | "amber" };
  selected: boolean;
  disabled: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      aria-pressed={selected}
      className={cn(
        "group relative rounded-xl border px-4 py-3.5 text-left transition-all duration-200 bg-card/70 backdrop-blur-sm",
        selected
          ? "border-foreground/30 ring-2 ring-foreground/15 shadow-sm bg-card"
          : disabled
            ? "border-border/40 opacity-70 cursor-not-allowed"
            : "border-border/60 hover:border-foreground/30 hover:shadow-sm hover:-translate-y-0.5 cursor-pointer",
      )}
    >
      {selected && (
        <CheckCircle2 className="absolute top-2.5 right-2.5 w-4 h-4 text-foreground" />
      )}

      <p
        className={cn(
          "text-[10px] font-semibold uppercase tracking-[0.18em] pr-5 truncate",
          selected ? "text-foreground" : "text-muted-foreground",
        )}
      >
        {label}
      </p>

      <p className="text-[28px] font-bold text-card-foreground leading-none mt-2 tabular-nums">
        {price}
        <span className="text-xs font-normal text-muted-foreground ml-0.5 tracking-tight">
          /mo
        </span>
      </p>

      <p
        className={cn(
          "text-[11px] font-medium mt-2 leading-snug line-clamp-1",
          microText.tone === "emerald" && "text-emerald-600",
          microText.tone === "amber" && "text-amber-600",
          microText.tone === "muted" && "text-muted-foreground",
        )}
      >
        {microText.text}
      </p>
    </button>
  );
}

// ─────────────────────────────────────────────────────────────────────
// Enterprise — dark slate, amber accent
// ─────────────────────────────────────────────────────────────────────

function EnterpriseRow({ bundle }: { bundle: PlatformBundle }) {
  return (
    <div className="relative rounded-2xl border border-slate-800 bg-gradient-to-br from-slate-900 to-slate-800 text-slate-50 overflow-hidden">
      <div className="absolute inset-x-0 top-0 h-0.5 bg-amber-400" />
      <div className="p-5 sm:p-6 flex flex-col md:flex-row md:items-center gap-5">
        <div className="flex items-center gap-3.5 md:w-56 md:shrink-0">
          <div className="flex items-center justify-center w-12 h-12 rounded-xl bg-amber-400 text-slate-900 shrink-0 shadow-sm">
            <Crown className="w-6 h-6" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5 flex-wrap">
              <h3 className="font-semibold text-[15px] text-slate-50 leading-tight tracking-tight">
                {bundle.name}
              </h3>
              <span className="text-[9px] font-bold uppercase tracking-[0.15em] rounded-full px-2 py-0.5 bg-amber-400/15 text-amber-300 border border-amber-400/30">
                Custom Pricing
              </span>
            </div>
            <p className="text-[11px] text-slate-400 mt-1 leading-snug">
              Dealer groups · Multi-rooftop · Named CSM · Consolidated billing
            </p>
          </div>
        </div>
        <div className="flex-1 flex items-center justify-end gap-3">
          <div className="text-right">
            <p className="text-base font-semibold text-amber-400 leading-none flex items-center gap-1.5 justify-end">
              <Building2 className="w-4 h-4" />
              Contact Sales
            </p>
            <p className="text-[10px] text-slate-500 mt-1.5">
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
