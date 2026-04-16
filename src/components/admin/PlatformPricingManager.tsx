import { useEffect, useMemo, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Slider } from "@/components/ui/slider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { usePlatform } from "@/contexts/PlatformContext";
import {
  FALLBACK_PRODUCTS,
  FALLBACK_TIERS,
  FALLBACK_BUNDLES,
} from "@/components/platform/pricing/fallbackCatalog";
import {
  Store,
  Building2,
  Building,
  Factory,
  RotateCcw,
  Check,
} from "lucide-react";
import type { PlatformProduct, PlatformProductTier, PlatformBundle } from "@/lib/entitlements";

/**
 * Super-admin-only Platform Pricing Manager.
 *
 * Simplified design: ONE base pricing block showing catalog prices
 * for all products with editable monthly + annual discount sliders.
 * Below that, volume discount percentage sliders per tier that
 * automatically compute discounted prices for multi-location and
 * dealer group architectures.
 *
 * Persists to `platform_pricing_model` in the same format as before
 * (tier_overrides / bundle_overrides keyed by tier_id → arch → prices).
 * The picker, billing page, and onboarding all read the same data.
 */

type Arch =
  | "single_store"
  | "single_store_secondary"
  | "multi_location"
  | "dealer_group";

/** Volume discount tiers — displayed as sliders below the base block. */
const VOLUME_TIERS: {
  key: Arch;
  label: string;
  sublabel: string;
  icon: typeof Store;
}[] = [
  {
    key: "single_store_secondary",
    label: "Single + Secondary",
    sublabel: "2 rooftops",
    icon: Building2,
  },
  {
    key: "multi_location",
    label: "Multi-Location",
    sublabel: "3–5 rooftops",
    icon: Building,
  },
  {
    key: "dealer_group",
    label: "Dealer Group",
    sublabel: "6–10 rooftops",
    icon: Factory,
  },
];

interface PricePair {
  monthly?: number;
  annual?: number;
}
type ArchPricing = Partial<Record<Arch, PricePair>>;

interface PricingModelRow {
  id: "global";
  annual_discount_pct: number;
  tier_overrides: Record<string, ArchPricing>;
  bundle_overrides: Record<string, ArchPricing>;
}

const DEFAULT_MODEL: PricingModelRow = {
  id: "global",
  annual_discount_pct: 15,
  tier_overrides: {},
  bundle_overrides: {},
};

const PlatformPricingManager = () => {
  const { products, bundles, tiers } = usePlatform();
  const { toast } = useToast();

  const [saved, setSaved] = useState<PricingModelRow>(DEFAULT_MODEL);
  const [draft, setDraft] = useState<PricingModelRow>(DEFAULT_MODEL);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data, error } = await supabase
        .from("platform_pricing_model" as never)
        .select("*")
        .eq("id", "global")
        .maybeSingle();

      if (cancelled) return;
      if (error) {
        // eslint-disable-next-line no-console
        console.warn("platform_pricing_model load:", error.message);
        setLoading(false);
        return;
      }
      if (data) {
        const row = data as unknown as PricingModelRow;
        const normalized: PricingModelRow = {
          id: "global",
          annual_discount_pct: Number(row.annual_discount_pct ?? 15),
          tier_overrides: (row.tier_overrides ?? {}) as Record<string, ArchPricing>,
          bundle_overrides: (row.bundle_overrides ?? {}) as Record<string, ArchPricing>,
        };
        setSaved(normalized);
        setDraft(normalized);
      }
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const dirty = useMemo(
    () => JSON.stringify(saved) !== JSON.stringify(draft),
    [saved, draft],
  );

  // Merge DB catalog with the hardcoded fallback so the admin page
  // always has something to render even if the `platform_products` /
  // `platform_product_tiers` / `platform_bundles` tables are empty
  // (e.g. before the v2 seed migration has run on this environment).
  // DB rows win on matching id; fallbacks fill every gap.
  const mergedProducts = useMemo(() => {
    const map = new Map<string, PlatformProduct>();
    for (const x of FALLBACK_PRODUCTS) map.set(x.id, x);
    for (const x of products) map.set(x.id, x);
    return Array.from(map.values());
  }, [products]);

  const mergedBundles = useMemo(() => {
    const map = new Map<string, PlatformBundle>();
    for (const x of FALLBACK_BUNDLES) map.set(x.id, x);
    for (const x of bundles) map.set(x.id, x);
    return Array.from(map.values());
  }, [bundles]);

  const mergedTiers = useMemo(() => {
    const map = new Map<string, PlatformProductTier>();
    for (const x of FALLBACK_TIERS) map.set(x.id, x);
    for (const x of tiers) map.set(x.id, x);
    return Array.from(map.values());
  }, [tiers]);

  const sortedProducts = useMemo(
    () => [...mergedProducts].sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0)),
    [mergedProducts],
  );

  const sortedBundles = useMemo(
    () =>
      [...mergedBundles]
        .filter((b) => !b.is_enterprise)
        .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0)),
    [mergedBundles],
  );

  const tiersByProduct = useMemo(() => {
    const byProduct: Record<string, PlatformProductTier[]> = {};
    for (const t of mergedTiers) {
      if (t.is_active === false) continue;
      (byProduct[t.product_id] = byProduct[t.product_id] ?? []).push(t);
    }
    Object.values(byProduct).forEach((list) =>
      list.sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0)),
    );
    return byProduct;
  }, [mergedTiers]);

  // ── Volume discount percentages (per architecture tier) ──
  // Stored locally; on save, the component computes dollar overrides
  // from base prices × (1 - volume%) and writes to the same DB format.
  const [volumeDiscounts, setVolumeDiscounts] = useState<Record<Arch, number>>({
    single_store: 0,
    single_store_secondary: 0,
    multi_location: 15,
    dealer_group: 20,
  });

  // Derive initial volume discounts from saved overrides on load.
  // Uses autocurb_standard as the reference tier — if it has a
  // multi_location override, compute what % off catalog that is.
  useEffect(() => {
    if (!saved || !mergedTiers.length) return;
    const ref = mergedTiers.find((t) => t.id === "autocurb_standard");
    if (!ref) return;
    const base = ref.monthly_price;
    const derived: Record<string, number> = {};
    for (const tier of VOLUME_TIERS) {
      const override = saved.tier_overrides["autocurb_standard"]?.[tier.key];
      if (override?.monthly != null && base > 0) {
        derived[tier.key] = Math.round(((base - override.monthly) / base) * 100);
      }
    }
    if (Object.keys(derived).length > 0) {
      setVolumeDiscounts((prev) => ({ ...prev, ...derived }));
    }
  }, [saved, mergedTiers]);

  // Apply a volume discount to ALL tiers and bundles for a given arch.
  // Computes monthly = catalog × (1 - pct/100), annual = monthly × (1 - annualPct/100).
  const applyVolumeDiscount = (arch: Arch, pct: number) => {
    setVolumeDiscounts((prev) => ({ ...prev, [arch]: pct }));
    setDraft((d) => {
      const tierOverrides = { ...d.tier_overrides };
      const bundleOverrides = { ...d.bundle_overrides };

      // Apply to every active tier
      for (const tier of mergedTiers) {
        if (tier.is_active === false) continue;
        const base = tier.monthly_price;
        if (pct === 0) {
          // Remove override for this arch
          const archMap = { ...(tierOverrides[tier.id] ?? {}) } as ArchPricing;
          delete archMap[arch];
          if (Object.keys(archMap).length === 0) delete tierOverrides[tier.id];
          else tierOverrides[tier.id] = archMap;
        } else {
          const discountedMonthly = Math.round(base * (1 - pct / 100));
          const annualPct = d.annual_discount_pct || 15;
          const discountedAnnual = Math.round(discountedMonthly * (1 - annualPct / 100));
          const archMap = { ...(tierOverrides[tier.id] ?? {}) } as ArchPricing;
          archMap[arch] = { monthly: discountedMonthly, annual: discountedAnnual };
          tierOverrides[tier.id] = archMap;
        }
      }

      // Apply to every bundle
      for (const bundle of sortedBundles) {
        const base = bundle.monthly_price;
        if (pct === 0) {
          const archMap = { ...(bundleOverrides[bundle.id] ?? {}) } as ArchPricing;
          delete archMap[arch];
          if (Object.keys(archMap).length === 0) delete bundleOverrides[bundle.id];
          else bundleOverrides[bundle.id] = archMap;
        } else {
          const discountedMonthly = Math.round(base * (1 - pct / 100));
          const annualPct = d.annual_discount_pct || 15;
          const discountedAnnual = Math.round(discountedMonthly * (1 - annualPct / 100));
          const archMap = { ...(bundleOverrides[bundle.id] ?? {}) } as ArchPricing;
          archMap[arch] = { monthly: discountedMonthly, annual: discountedAnnual };
          bundleOverrides[bundle.id] = archMap;
        }
      }

      return { ...d, tier_overrides: tierOverrides, bundle_overrides: bundleOverrides };
    });
  };

  // ── Per-tier helpers (kept for base block editing) ──
  const getTierPrice = (tierId: string, arch: Arch): PricePair =>
    draft.tier_overrides[tierId]?.[arch] ?? {};

  const getBundlePrice = (bundleId: string, arch: Arch): PricePair =>
    draft.bundle_overrides[bundleId]?.[arch] ?? {};

  const setTierPrice = (
    tierId: string,
    arch: Arch,
    patch: PricePair,
  ) => {
    setDraft((d) => {
      const overrides = { ...d.tier_overrides };
      const archMap = { ...(overrides[tierId] ?? {}) } as ArchPricing;
      const pair: PricePair = { ...(archMap[arch] ?? {}), ...patch };
      if (pair.monthly === undefined) delete pair.monthly;
      if (pair.annual === undefined) delete pair.annual;
      if (pair.monthly == null && pair.annual == null) {
        delete archMap[arch];
      } else {
        archMap[arch] = pair;
      }
      if (Object.keys(archMap).length === 0) {
        delete overrides[tierId];
      } else {
        overrides[tierId] = archMap;
      }
      return { ...d, tier_overrides: overrides };
    });
  };

  const setBundlePrice = (
    bundleId: string,
    arch: Arch,
    patch: PricePair,
  ) => {
    setDraft((d) => {
      const overrides = { ...d.bundle_overrides };
      const archMap = { ...(overrides[bundleId] ?? {}) } as ArchPricing;
      const pair: PricePair = { ...(archMap[arch] ?? {}), ...patch };
      if (pair.monthly === undefined) delete pair.monthly;
      if (pair.annual === undefined) delete pair.annual;
      if (pair.monthly == null && pair.annual == null) {
        delete archMap[arch];
      } else {
        archMap[arch] = pair;
      }
      if (Object.keys(archMap).length === 0) {
        delete overrides[bundleId];
      } else {
        overrides[bundleId] = archMap;
      }
      return { ...d, bundle_overrides: overrides };
    });
  };

  const discard = () => setDraft(saved);

  const save = async () => {
    setSaving(true);
    const payload: Record<string, unknown> = {
      id: "global",
      annual_discount_pct: draft.annual_discount_pct,
      tier_overrides: draft.tier_overrides,
      bundle_overrides: draft.bundle_overrides,
      // `multi_location_overrides` is a NOT NULL column on the v1
      // table; include an empty object so upserts into a freshly
      // healed row never trip the constraint.
      multi_location_overrides: {},
      updated_at: new Date().toISOString(),
    };

    // PostgREST schema cache can lag behind recent DDL — if it does,
    // strip the unknown column and retry so saves land on whatever
    // the schema cache currently knows about.
    let error: { message: string; hint?: string } | null = null;
    for (let attempt = 0; attempt < 4; attempt++) {
      const res = await supabase
        .from("platform_pricing_model" as never)
        .upsert(payload as never, { onConflict: "id" });
      error = res.error as typeof error;
      if (!error) break;
      const match = /Could not find the '([a-z_]+)' column/i.exec(error.message);
      if (!match) break;
      // eslint-disable-next-line no-console
      console.warn(
        `[PlatformPricingManager] schema cache missing '${match[1]}', retrying without it`,
      );
      delete payload[match[1]];
    }
    setSaving(false);

    if (error) {
      // eslint-disable-next-line no-console
      console.error("[PlatformPricingManager] save failed", { error, payload });
      // If the table doesn't exist yet, save locally and show a
      // non-destructive warning. The static architecturePricing.ts
      // overrides still drive volume pricing on all pages.
      const isTableMissing = /Could not find the table/i.test(error.message);
      if (isTableMissing) {
        setSaved(draft);
        toast({
          title: "Pricing updated locally",
          description:
            "Database table not provisioned yet — changes apply to this session. Static volume pricing is active on all pages.",
        });
        return;
      }
      toast({
        title: "Couldn't save pricing model",
        description: `${error.message}${error.hint ? ` — ${error.hint}` : ""}`,
        variant: "destructive",
      });
      return;
    }
    setSaved(draft);
    toast({
      title: "Pricing model saved",
      description:
        "Prices pushed to the dealer picker via Supabase realtime.",
    });
  };

  if (loading) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="h-8 w-64 bg-muted rounded" />
        <div className="h-96 bg-muted rounded" />
      </div>
    );
  }

  const dirtyMarks =
    (draft.annual_discount_pct !== saved.annual_discount_pct ? 1 : 0) +
    Object.keys(draft.tier_overrides).length +
    Object.keys(draft.bundle_overrides).length;

  return (
    <div className="space-y-8 pb-28">
      {/* Header */}
      <div>
        <h2 className="text-lg font-semibold text-card-foreground tracking-tight">
          Pricing Model
        </h2>
        <p className="text-sm text-muted-foreground mt-1 max-w-2xl">
          Every architecture on one page. Monthly prices are manually editable
          — drag the discount slider next to any annual-prepaid row to set the
          percentage off. The annual-equivalent monthly price and multiplier
          recompute live.
        </p>
        <div className="mt-3 flex items-start gap-2 rounded-xl border border-emerald-500/30 bg-emerald-500/5 px-3 py-2 text-xs text-emerald-900 dark:text-emerald-200 max-w-2xl">
          <span className="w-2 h-2 rounded-full bg-emerald-500 mt-1 shrink-0 animate-pulse" />
          <p className="leading-snug">
            <span className="font-semibold">Live —</span> wired into the dealer
            onboarding picker and the billing plan card. Every save here pushes
            to open pickers in real time via Supabase realtime.
          </p>
        </div>
      </div>

      {/* ─── Block 1: Base Catalog Pricing ─── */}
      <Card className="border-border/60 overflow-hidden">
        <div className="flex items-center gap-3 px-6 py-4 border-b border-border/50 bg-muted/30">
          <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center">
            <Store className="w-4.5 h-4.5 text-primary" />
          </div>
          <div className="flex-1">
            <h3 className="text-base font-semibold text-card-foreground tracking-tight">
              Base Catalog Pricing
            </h3>
            <p className="text-xs text-muted-foreground">
              Single store · 1 rooftop · full price
            </p>
          </div>
          <Badge variant="outline" className="text-[10px] uppercase tracking-wider font-semibold">
            Base Rate
          </Badge>
        </div>
        <CardContent className="p-0">
          <div className="divide-y divide-border/40">
            {sortedProducts.map((product) => {
              const productTiers = tiersByProduct[product.id] ?? [];
              if (productTiers.length === 0) return null;
              if (productTiers.length === 1) {
                return (
                  <MainTierRow
                    key={product.id}
                    product={product}
                    tier={productTiers[0]}
                    price={getTierPrice(productTiers[0].id, "single_store")}
                    onChange={(patch) =>
                      setTierPrice(productTiers[0].id, "single_store", patch)
                    }
                    onReset={() =>
                      setTierPrice(productTiers[0].id, "single_store", {
                        monthly: undefined,
                        annual: undefined,
                      })
                    }
                  />
                );
              }
              return (
                <MultiTierRow
                  key={product.id}
                  product={product}
                  productTiers={productTiers}
                  getPrice={(tierId) => getTierPrice(tierId, "single_store")}
                  onChange={(tierId, patch) =>
                    setTierPrice(tierId, "single_store", patch)
                  }
                />
              );
            })}
            {sortedBundles.map((bundle) => (
              <BundleRow
                key={bundle.id}
                bundle={bundle}
                price={getBundlePrice(bundle.id, "single_store")}
                onChange={(patch) =>
                  setBundlePrice(bundle.id, "single_store", patch)
                }
                onReset={() =>
                  setBundlePrice(bundle.id, "single_store", {
                    monthly: undefined,
                    annual: undefined,
                  })
                }
              />
            ))}
          </div>
        </CardContent>
      </Card>

      {/* ─── Block 2: Volume Discount Tiers ─── */}
      <Card className="border-border/60 overflow-hidden">
        <div className="flex items-center gap-3 px-6 py-4 border-b border-border/50 bg-muted/30">
          <div className="w-9 h-9 rounded-lg bg-emerald-500/10 flex items-center justify-center">
            <Building className="w-4.5 h-4.5 text-emerald-600" />
          </div>
          <div className="flex-1">
            <h3 className="text-base font-semibold text-card-foreground tracking-tight">
              Volume Discount Tiers
            </h3>
            <p className="text-xs text-muted-foreground">
              Percentage off base pricing per rooftop count tier
            </p>
          </div>
        </div>
        <CardContent className="p-0">
          <div className="divide-y divide-border/40">
            {VOLUME_TIERS.map((tier) => {
              const Icon = tier.icon;
              const pct = volumeDiscounts[tier.key] ?? 0;
              return (
                <div
                  key={tier.key}
                  className="px-6 py-5 grid grid-cols-1 md:grid-cols-[200px_1fr_100px] items-center gap-4"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center shrink-0">
                      <Icon className="w-4 h-4 text-muted-foreground" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-card-foreground">
                        {tier.label}
                      </p>
                      <p className="text-[11px] text-muted-foreground">
                        {tier.sublabel} · per-store
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <Slider
                      value={[pct]}
                      min={0}
                      max={30}
                      step={1}
                      onValueChange={([v]) => applyVolumeDiscount(tier.key, v)}
                      className="flex-1"
                    />
                  </div>

                  <div className="text-right">
                    <span
                      className={`text-lg font-bold ${
                        pct > 0
                          ? "text-emerald-600 dark:text-emerald-400"
                          : "text-muted-foreground"
                      }`}
                      style={{ fontVariantNumeric: "tabular-nums" }}
                    >
                      {pct}% off
                    </span>
                  </div>
                </div>
              );
            })}

            {/* Enterprise row — no slider, just "Contact Sales" */}
            <div className="px-6 py-5 grid grid-cols-1 md:grid-cols-[200px_1fr_100px] items-center gap-4 bg-slate-900 text-slate-50 rounded-b-lg">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-amber-400/20 flex items-center justify-center shrink-0">
                  <Factory className="w-4 h-4 text-amber-400" />
                </div>
                <div>
                  <p className="text-sm font-semibold">Enterprise</p>
                  <p className="text-[11px] text-slate-400">11+ rooftops</p>
                </div>
              </div>
              <p className="text-sm text-slate-400">Custom pricing · negotiated per group</p>
              <div className="text-right">
                <span className="text-xs font-semibold text-amber-400 uppercase tracking-wider">
                  Contact Sales
                </span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ─── Block 3: Live Preview Table ─── */}
      <Card className="border-border/60 overflow-hidden">
        <div className="flex items-center gap-3 px-6 py-4 border-b border-border/50 bg-muted/30">
          <div className="flex-1">
            <h3 className="text-base font-semibold text-card-foreground tracking-tight">
              Computed Price Preview
            </h3>
            <p className="text-xs text-muted-foreground">
              Per-store monthly prices after volume discounts · updates live
            </p>
          </div>
        </div>
        <CardContent className="p-0 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border/40 bg-muted/20">
                <th className="text-left px-4 py-3 font-semibold text-muted-foreground text-xs uppercase tracking-wider">
                  Product
                </th>
                <th
                  className="text-right px-4 py-3 font-semibold text-muted-foreground text-xs uppercase tracking-wider"
                  style={{ fontVariantNumeric: "tabular-nums" }}
                >
                  Base
                </th>
                {VOLUME_TIERS.map((tier) => (
                  <th
                    key={tier.key}
                    className="text-right px-4 py-3 font-semibold text-muted-foreground text-xs uppercase tracking-wider"
                    style={{ fontVariantNumeric: "tabular-nums" }}
                  >
                    {tier.label}
                    <br />
                    <span className="text-[9px] font-normal">
                      ({volumeDiscounts[tier.key] ?? 0}% off)
                    </span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border/30">
              {mergedTiers
                .filter((t) => t.is_active !== false)
                .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
                .map((tier) => {
                  const product = sortedProducts.find((p) => p.id === tier.product_id);
                  const base = tier.monthly_price;
                  return (
                    <tr key={tier.id} className="hover:bg-muted/10">
                      <td className="px-4 py-2.5 text-card-foreground">
                        <span className="font-medium">{product?.name ?? tier.product_id}</span>
                        <span className="text-muted-foreground ml-1.5 text-xs">
                          {tier.name}
                        </span>
                      </td>
                      <td
                        className="text-right px-4 py-2.5 font-semibold text-card-foreground"
                        style={{ fontVariantNumeric: "tabular-nums" }}
                      >
                        ${base.toLocaleString()}
                      </td>
                      {VOLUME_TIERS.map((vt) => {
                        const pct = volumeDiscounts[vt.key] ?? 0;
                        const discounted = Math.round(base * (1 - pct / 100));
                        const changed = discounted !== base;
                        return (
                          <td
                            key={vt.key}
                            className={`text-right px-4 py-2.5 font-semibold ${
                              changed
                                ? "text-emerald-600 dark:text-emerald-400"
                                : "text-muted-foreground"
                            }`}
                            style={{ fontVariantNumeric: "tabular-nums" }}
                          >
                            ${discounted.toLocaleString()}
                            {changed && (
                              <span className="text-[10px] text-muted-foreground line-through ml-1.5">
                                ${base.toLocaleString()}
                              </span>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              {/* Bundle row */}
              {sortedBundles.map((bundle) => (
                <tr key={bundle.id} className="hover:bg-muted/10 bg-primary/[0.02]">
                  <td className="px-4 py-2.5 text-card-foreground font-medium">
                    All-Apps Unlimited
                  </td>
                  <td
                    className="text-right px-4 py-2.5 font-semibold text-card-foreground"
                    style={{ fontVariantNumeric: "tabular-nums" }}
                  >
                    ${bundle.monthly_price.toLocaleString()}
                  </td>
                  {VOLUME_TIERS.map((vt) => {
                    const pct = volumeDiscounts[vt.key] ?? 0;
                    const discounted = Math.round(bundle.monthly_price * (1 - pct / 100));
                    const changed = discounted !== bundle.monthly_price;
                    return (
                      <td
                        key={vt.key}
                        className={`text-right px-4 py-2.5 font-semibold ${
                          changed
                            ? "text-emerald-600 dark:text-emerald-400"
                            : "text-muted-foreground"
                        }`}
                        style={{ fontVariantNumeric: "tabular-nums" }}
                      >
                        ${discounted.toLocaleString()}
                        {changed && (
                          <span className="text-[10px] text-muted-foreground line-through ml-1.5">
                            ${bundle.monthly_price.toLocaleString()}
                          </span>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>

      {/* Sticky save bar */}
      {dirty && (
        <div className="fixed bottom-0 left-0 right-0 z-40 border-t border-border/60 bg-background/90 backdrop-blur-md">
          <div className="max-w-7xl mx-auto px-6 py-3 flex items-center justify-between gap-4">
            <div className="flex items-center gap-2 text-sm">
              <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
              <span className="font-medium text-card-foreground">
                Unsaved changes
              </span>
              <Badge variant="outline" className="text-[10px]">
                {dirtyMarks} {dirtyMarks === 1 ? "edit" : "edits"}
              </Badge>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={discard}
                disabled={saving}
                className="gap-1.5"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                Discard
              </Button>
              <Button
                size="sm"
                onClick={save}
                disabled={saving}
                className="gap-1.5"
              >
                <Check className="w-3.5 h-3.5" />
                {saving ? "Saving…" : "Save changes"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

/**
 * Row for single-tier products (AutoCurb, AutoFilm). Shows:
 *   label · [editable monthly] · [discount slider] · [annual display] · [multiplier]
 */
function MainTierRow({
  product,
  tier,
  price,
  onChange,
  onReset,
}: {
  product: PlatformProduct;
  tier: PlatformProductTier;
  price: PricePair;
  onChange: (patch: PricePair) => void;
  onReset: () => void;
}) {
  const monthly = price.monthly ?? tier.monthly_price;
  const annual = price.annual;

  const discountPct =
    annual != null && monthly > 0
      ? Math.round(((monthly - annual) / monthly) * 100)
      : 0;
  const multiplier = (1 - discountPct / 100).toFixed(2);

  const onSlider = (pct: number) => {
    if (pct === 0) {
      onChange({ monthly, annual: undefined });
    } else {
      onChange({
        monthly,
        annual: Math.round(monthly * (1 - pct / 100)),
      });
    }
  };

  return (
    <div className="px-6 py-4 grid grid-cols-1 md:grid-cols-[180px_160px_1fr_160px_80px_40px] items-center gap-4">
      <div>
        <p className="text-sm font-semibold text-card-foreground lowercase tracking-tight">
          {product.base_url?.replace(/^https?:\/\//, "") ?? product.name}
        </p>
        <p className="text-[11px] text-muted-foreground mt-0.5">
          {tier.description?.split(" — ")[0] ?? tier.name}
        </p>
      </div>

      <MonthlyField
        value={price.monthly ?? null}
        fallback={tier.monthly_price}
        onCommit={(v) => onChange({ monthly: v, annual })}
      />

      <div className="flex items-center gap-3">
        <Slider
          value={[discountPct]}
          min={0}
          max={30}
          step={1}
          onValueChange={([v]) => onSlider(v)}
          className="flex-1"
        />
        <span
          className="text-xs font-semibold text-muted-foreground min-w-[3ch] text-right"
          style={{ fontVariantNumeric: "tabular-nums" }}
        >
          -{discountPct}%
        </span>
      </div>

      <div className="text-right">
        <div
          className="flex items-baseline justify-end gap-1"
          style={{ fontVariantNumeric: "tabular-nums" }}
        >
          {annual != null ? (
            <>
              <span className="text-sm font-semibold text-emerald-700 dark:text-emerald-400">
                ${annual.toLocaleString()}
              </span>
              <span className="text-[10px] text-muted-foreground">/mo</span>
            </>
          ) : (
            <span className="text-xs text-muted-foreground">annual off</span>
          )}
        </div>
        <p className="text-[10px] text-muted-foreground mt-0.5">
          annual pre-paid
        </p>
      </div>

      <div
        className="text-right text-xs text-muted-foreground"
        style={{ fontVariantNumeric: "tabular-nums" }}
      >
        {annual != null ? `× ${multiplier}` : "—"}
      </div>

      <div className="text-right">
        {(price.monthly != null || price.annual != null) && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onReset}
            className="h-7 w-7 p-0 text-muted-foreground hover:text-card-foreground"
            title="Clear this row"
          >
            <RotateCcw className="w-3 h-3" />
          </Button>
        )}
      </div>
    </div>
  );
}

/**
 * Row for multi-tier products (AutoLabels basic/premium, AutoFrame 75/125/unlimited).
 * Renders inline monthly editors for each tier. No annual slider — these tiers
 * are monthly-only in the source rate card.
 */
function MultiTierRow({
  product,
  productTiers,
  getPrice,
  onChange,
}: {
  product: PlatformProduct;
  productTiers: PlatformProductTier[];
  getPrice: (tierId: string) => PricePair;
  onChange: (tierId: string, patch: PricePair) => void;
}) {
  return (
    <div className="px-6 py-4 grid grid-cols-1 md:grid-cols-[180px_1fr] items-center gap-4">
      <div>
        <p className="text-sm font-semibold text-card-foreground lowercase tracking-tight">
          {product.base_url?.replace(/^https?:\/\//, "") ?? product.name}
        </p>
        <p className="text-[11px] text-muted-foreground mt-0.5">
          {productTiers.length} tiers · monthly only
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        {productTiers.map((tier) => {
          const price = getPrice(tier.id);
          return (
            <div
              key={tier.id}
              className="flex items-center gap-2 rounded-lg border border-border/50 bg-muted/20 pl-2 pr-1 py-1"
            >
              <MonthlyField
                value={price.monthly ?? null}
                fallback={tier.monthly_price}
                onCommit={(v) => onChange(tier.id, { monthly: v })}
                compact
              />
              <span className="text-[11px] text-muted-foreground pl-1 pr-1">
                {tier.name.toLowerCase()}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/** Bundle row (All-Apps Unlimited). Same layout as MainTierRow. */
function BundleRow({
  bundle,
  price,
  onChange,
  onReset,
}: {
  bundle: PlatformBundle;
  price: PricePair;
  onChange: (patch: PricePair) => void;
  onReset: () => void;
}) {
  const monthly = price.monthly ?? bundle.monthly_price;
  const annual = price.annual;

  const discountPct =
    annual != null && monthly > 0
      ? Math.round(((monthly - annual) / monthly) * 100)
      : 0;
  const multiplier = (1 - discountPct / 100).toFixed(2);

  const onSlider = (pct: number) => {
    if (pct === 0) {
      onChange({ monthly, annual: undefined });
    } else {
      onChange({
        monthly,
        annual: Math.round(monthly * (1 - pct / 100)),
      });
    }
  };

  return (
    <div className="px-6 py-4 grid grid-cols-1 md:grid-cols-[180px_160px_1fr_160px_80px_40px] items-center gap-4 bg-primary/[0.03]">
      <div>
        <p className="text-sm font-semibold text-card-foreground lowercase tracking-tight">
          all in one
        </p>
        <p className="text-[11px] text-muted-foreground mt-0.5">
          every app, top tier
        </p>
      </div>

      <MonthlyField
        value={price.monthly ?? null}
        fallback={bundle.monthly_price}
        onCommit={(v) => onChange({ monthly: v, annual })}
      />

      <div className="flex items-center gap-3">
        <Slider
          value={[discountPct]}
          min={0}
          max={30}
          step={1}
          onValueChange={([v]) => onSlider(v)}
          className="flex-1"
        />
        <span
          className="text-xs font-semibold text-muted-foreground min-w-[3ch] text-right"
          style={{ fontVariantNumeric: "tabular-nums" }}
        >
          -{discountPct}%
        </span>
      </div>

      <div className="text-right">
        <div
          className="flex items-baseline justify-end gap-1"
          style={{ fontVariantNumeric: "tabular-nums" }}
        >
          {annual != null ? (
            <>
              <span className="text-sm font-semibold text-emerald-700 dark:text-emerald-400">
                ${annual.toLocaleString()}
              </span>
              <span className="text-[10px] text-muted-foreground">/mo</span>
            </>
          ) : (
            <span className="text-xs text-muted-foreground">annual off</span>
          )}
        </div>
        <p className="text-[10px] text-muted-foreground mt-0.5">
          annual pre-paid
        </p>
      </div>

      <div
        className="text-right text-xs text-muted-foreground"
        style={{ fontVariantNumeric: "tabular-nums" }}
      >
        {annual != null ? `× ${multiplier}` : "—"}
      </div>

      <div className="text-right">
        {(price.monthly != null || price.annual != null) && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onReset}
            className="h-7 w-7 p-0 text-muted-foreground hover:text-card-foreground"
            title="Clear this row"
          >
            <RotateCcw className="w-3 h-3" />
          </Button>
        )}
      </div>
    </div>
  );
}

/**
 * Editable "$X,XXX" monthly number. Click to edit, Enter to commit.
 * Displays the fallback (catalog) price in muted text when no override
 * is set.
 */
function MonthlyField({
  value,
  fallback,
  onCommit,
  compact = false,
}: {
  value: number | null;
  fallback: number;
  onCommit: (v: number | undefined) => void;
  compact?: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [buffer, setBuffer] = useState(
    value != null ? String(value) : String(fallback),
  );

  useEffect(() => {
    setBuffer(value != null ? String(value) : String(fallback));
  }, [value, fallback]);

  const commit = () => {
    const parsed = parseFloat(buffer);
    if (!Number.isFinite(parsed) || parsed < 0) {
      setBuffer(value != null ? String(value) : String(fallback));
    } else if (parsed === fallback) {
      onCommit(undefined);
    } else {
      onCommit(Math.round(parsed));
    }
    setEditing(false);
  };

  const displayed = value ?? fallback;
  const isOverride = value != null;

  if (editing) {
    return (
      <Input
        autoFocus
        type="number"
        value={buffer}
        onChange={(e) => setBuffer(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") commit();
          if (e.key === "Escape") {
            setBuffer(value != null ? String(value) : String(fallback));
            setEditing(false);
          }
        }}
        className={`${compact ? "w-20 h-7" : "w-32 h-9"} text-right font-semibold`}
        style={{ fontVariantNumeric: "tabular-nums" }}
      />
    );
  }

  return (
    <button
      type="button"
      onClick={() => setEditing(true)}
      className={`group inline-flex items-baseline gap-1 rounded-md px-2 py-1 hover:bg-muted/40 transition-colors ${
        compact ? "text-sm" : "text-lg"
      }`}
      style={{ fontVariantNumeric: "tabular-nums" }}
    >
      <span
        className={`font-semibold ${
          isOverride ? "text-amber-600 dark:text-amber-400" : "text-card-foreground"
        }`}
      >
        ${displayed.toLocaleString()}
      </span>
      <span className="text-[10px] text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity">
        edit
      </span>
    </button>
  );
}

export default PlatformPricingManager;
