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
 * Grid layout mirroring the authoritative rate card (image set dated
 * 2026-04-15): four architecture cards stacked top-to-bottom, each with
 * one row per product plus the All-Apps Unlimited bundle. Monthly
 * prices are manually editable; discount sliders next to any row that
 * supports annual prepaid drive the annual-equivalent monthly price.
 *
 * Architectures:
 *   • single_store           — Dealer single location (1 rooftop)
 *   • single_store_secondary — Single + secondary lot (2 rooftops)
 *   • multi_location         — Multi-location dealers (3–5 rooftops)
 *   • dealer_group           — Dealer group (6–10 rooftops)
 *
 * Persists to `platform_pricing_model`. NOT yet wired to the dealer
 * onboarding picker — this is the staging ground.
 */

type Arch =
  | "single_store"
  | "single_store_secondary"
  | "multi_location"
  | "dealer_group";

const ARCHITECTURES: {
  key: Arch;
  label: string;
  sublabel: string;
  icon: typeof Store;
}[] = [
  {
    key: "single_store",
    label: "Dealer — Single Location",
    sublabel: "1 rooftop",
    icon: Store,
  },
  {
    key: "single_store_secondary",
    label: "Dealer — Single + Secondary",
    sublabel: "2 rooftops",
    icon: Building2,
  },
  {
    key: "multi_location",
    label: "Multi-Location Dealers",
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

  // ── Helpers ──
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
    const payload = {
      id: "global",
      annual_discount_pct: draft.annual_discount_pct,
      tier_overrides: draft.tier_overrides,
      bundle_overrides: draft.bundle_overrides,
      // `multi_location_overrides` is a NOT NULL column on the table
      // (legacy from v1); include an empty object so upserts into a
      // freshly healed row never trip the constraint.
      multi_location_overrides: {},
      updated_at: new Date().toISOString(),
    };

    const { error } = await supabase
      .from("platform_pricing_model" as never)
      .upsert(payload as never, { onConflict: "id" });
    setSaving(false);

    if (error) {
      // eslint-disable-next-line no-console
      console.error("[PlatformPricingManager] save failed", { error, payload });
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

      {/* Four architecture cards, stacked like the source rate card */}
      <div className="space-y-6">
        {ARCHITECTURES.map((arch) => {
          const Icon = arch.icon;
          return (
            <Card key={arch.key} className="border-border/60 overflow-hidden">
              {/* Card header */}
              <div className="flex items-center gap-3 px-6 py-4 border-b border-border/50 bg-muted/30">
                <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center">
                  <Icon className="w-4.5 h-4.5 text-primary" />
                </div>
                <div className="flex-1">
                  <h3 className="text-base font-semibold text-card-foreground tracking-tight">
                    {arch.label}
                  </h3>
                  <p className="text-xs text-muted-foreground">
                    {arch.sublabel} · per-store pricing
                  </p>
                </div>
                <Badge
                  variant="outline"
                  className="text-[10px] uppercase tracking-wider font-semibold"
                >
                  {arch.key.replace(/_/g, " ")}
                </Badge>
              </div>

              <CardContent className="p-0">
                <div className="divide-y divide-border/40">
                  {/* Products */}
                  {sortedProducts.map((product) => {
                    const productTiers = tiersByProduct[product.id] ?? [];
                    if (productTiers.length === 0) return null;

                    // Single-tier products (autocurb, autofilm) get the
                    // full monthly + slider + annual layout. Multi-tier
                    // (autolabels basic/premium, autoframe 75/125/unl)
                    // render inline tier chips — no annual, just
                    // editable monthlies.
                    if (productTiers.length === 1) {
                      return (
                        <MainTierRow
                          key={product.id}
                          product={product}
                          tier={productTiers[0]}
                          price={getTierPrice(productTiers[0].id, arch.key)}
                          onChange={(patch) =>
                            setTierPrice(productTiers[0].id, arch.key, patch)
                          }
                          onReset={() =>
                            setTierPrice(productTiers[0].id, arch.key, {
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
                        getPrice={(tierId) => getTierPrice(tierId, arch.key)}
                        onChange={(tierId, patch) =>
                          setTierPrice(tierId, arch.key, patch)
                        }
                      />
                    );
                  })}

                  {/* Bundles (All-Apps Unlimited) */}
                  {sortedBundles.map((bundle) => (
                    <BundleRow
                      key={bundle.id}
                      bundle={bundle}
                      price={getBundlePrice(bundle.id, arch.key)}
                      onChange={(patch) =>
                        setBundlePrice(bundle.id, arch.key, patch)
                      }
                      onReset={() =>
                        setBundlePrice(bundle.id, arch.key, {
                          monthly: undefined,
                          annual: undefined,
                        })
                      }
                    />
                  ))}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

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
