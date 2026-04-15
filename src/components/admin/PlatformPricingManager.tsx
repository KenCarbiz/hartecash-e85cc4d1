import { useEffect, useMemo, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Slider } from "@/components/ui/slider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { usePlatform } from "@/contexts/PlatformContext";
import {
  Percent,
  Store,
  Building2,
  Building,
  Factory,
  RotateCcw,
  Check,
  Info,
  Sparkles,
} from "lucide-react";

/**
 * Super-admin-only Platform Pricing Manager.
 *
 * Four-architecture pricing matrix plus a platform-wide annual-prepaid
 * discount slider. Pre-populated from the authoritative rate card
 * (2026-04-15 image set) and persisted to `platform_pricing_model`.
 *
 * Architectures (columns in the source rate card):
 *   • single_store           — Dealer single location (1 rooftop)
 *   • single_store_secondary — Single + secondary lot (2 rooftops)
 *   • multi_location         — Multi-location dealers (3-5 rooftops)
 *   • dealer_group           — Dealer group (6-10 rooftops)
 *
 * Every tier / bundle has a `{ monthly, annual? }` pair per architecture.
 * `annual` is the per-month-equivalent rate when billed annually prepaid
 * — matching the source rate card layout. A blank `annual` value means
 * the fallback slider discount is applied; an explicit `annual` wins.
 *
 * NOT wired to the dealer-facing pricing picker yet — the staging ground
 * until we flip the switch.
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
    label: "Single Location",
    sublabel: "1 rooftop",
    icon: Store,
  },
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
  const [activeArch, setActiveArch] = useState<Arch>("single_store");

  // Load the singleton row on mount.
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

  const sortedTiers = useMemo(() => {
    return [...tiers]
      .filter((t) => t.is_active !== false)
      .sort((a, b) => {
        const pa = products.find((p) => p.id === a.product_id)?.sort_order ?? 99;
        const pb = products.find((p) => p.id === b.product_id)?.sort_order ?? 99;
        if (pa !== pb) return pa - pb;
        return (a.sort_order ?? 0) - (b.sort_order ?? 0);
      });
  }, [tiers, products]);

  const sortedBundles = useMemo(
    () =>
      [...bundles]
        .filter((b) => !b.is_enterprise)
        .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0)),
    [bundles],
  );

  // ── Helpers ──
  const getTierPrice = (tierId: string, arch: Arch): PricePair =>
    draft.tier_overrides[tierId]?.[arch] ?? {};

  const getBundlePrice = (bundleId: string, arch: Arch): PricePair =>
    draft.bundle_overrides[bundleId]?.[arch] ?? {};

  const annualFromDiscount = (monthly: number) =>
    Math.round(monthly * (1 - draft.annual_discount_pct / 100));

  const setTierPrice = (
    tierId: string,
    arch: Arch,
    field: "monthly" | "annual",
    value: number | undefined,
  ) => {
    setDraft((d) => {
      const overrides = { ...d.tier_overrides };
      const archMap = { ...(overrides[tierId] ?? {}) } as ArchPricing;
      const pair = { ...(archMap[arch] ?? {}) } as PricePair;
      if (value == null) delete pair[field];
      else pair[field] = value;

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
    field: "monthly" | "annual",
    value: number | undefined,
  ) => {
    setDraft((d) => {
      const overrides = { ...d.bundle_overrides };
      const archMap = { ...(overrides[bundleId] ?? {}) } as ArchPricing;
      const pair = { ...(archMap[arch] ?? {}) } as PricePair;
      if (value == null) delete pair[field];
      else pair[field] = value;

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
    const { error } = await supabase
      .from("platform_pricing_model" as never)
      .upsert({
        id: "global",
        annual_discount_pct: draft.annual_discount_pct,
        tier_overrides: draft.tier_overrides,
        bundle_overrides: draft.bundle_overrides,
        updated_at: new Date().toISOString(),
      } as never);
    setSaving(false);

    if (error) {
      toast({
        title: "Couldn't save pricing model",
        description: error.message,
        variant: "destructive",
      });
      return;
    }
    setSaved(draft);
    toast({
      title: "Pricing model saved",
      description:
        "Changes stored. The dealer-facing picker isn't reading from this yet.",
    });
  };

  if (loading) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="h-8 w-64 bg-muted rounded" />
        <div className="h-40 bg-muted rounded" />
        <div className="h-96 bg-muted rounded" />
      </div>
    );
  }

  const dirtyMarks =
    (draft.annual_discount_pct !== saved.annual_discount_pct ? 1 : 0) +
    Object.keys(draft.tier_overrides).length +
    Object.keys(draft.bundle_overrides).length;

  return (
    <div className="space-y-12 pb-28">
      {/* Header */}
      <div>
        <h2 className="text-lg font-semibold text-card-foreground tracking-tight">
          Pricing Model
        </h2>
        <p className="text-sm text-muted-foreground mt-1 max-w-2xl">
          The authoritative rate card for every dealer architecture. Drag the
          annual-prepaid slider for a global discount, or enter explicit monthly
          and annual prices per architecture below — explicit values always win.
        </p>
        <div className="mt-3 flex items-start gap-2 rounded-xl border border-amber-500/30 bg-amber-500/5 px-3 py-2 text-xs text-amber-900 dark:text-amber-200 max-w-2xl">
          <Info className="w-3.5 h-3.5 shrink-0 mt-0.5" />
          <p className="leading-snug">
            Not yet wired to the dealer onboarding picker. Save persists to the
            pricing-model table; the picker will read from it once we flip the
            switch.
          </p>
        </div>
      </div>

      {/* SECTION 1 — Default annual discount slider */}
      <section className="space-y-5">
        <SectionHeader
          icon={Percent}
          title="Default annual-prepaid discount"
          subtitle="Applied to any tier that doesn't have an explicit annual price below."
        />
        <Card className="border-border/60">
          <CardContent className="pt-8 pb-6 px-6 md:px-10">
            <div className="flex items-baseline gap-3">
              <span
                className="text-6xl font-semibold tracking-tight text-card-foreground"
                style={{ fontVariantNumeric: "tabular-nums" }}
              >
                {draft.annual_discount_pct}
              </span>
              <span className="text-4xl font-light text-muted-foreground">%</span>
              <span className="text-sm text-muted-foreground ml-2">
                default fallback when billed annually
              </span>
            </div>

            <div className="mt-8">
              <Slider
                value={[draft.annual_discount_pct]}
                min={0}
                max={30}
                step={1}
                onValueChange={([v]) =>
                  setDraft((d) => ({ ...d, annual_discount_pct: v }))
                }
              />
              <div
                className="mt-3 flex justify-between text-[10px] font-medium text-muted-foreground uppercase tracking-wider"
                style={{ fontVariantNumeric: "tabular-nums" }}
              >
                <span>0%</span>
                <span>5%</span>
                <span>10%</span>
                <span>15%</span>
                <span>20%</span>
                <span>25%</span>
                <span>30%</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </section>

      <Separator className="bg-border/50" />

      {/* SECTION 2 — Architecture matrix */}
      <section className="space-y-5">
        <SectionHeader
          icon={Store}
          title="Rate card by architecture"
          subtitle="Per-store prices for every dealer size. Leave the annual column blank to fall back to the slider discount."
        />

        <Tabs
          value={activeArch}
          onValueChange={(v) => setActiveArch(v as Arch)}
          className="w-full"
        >
          <TabsList className="grid grid-cols-2 md:grid-cols-4 h-auto gap-1 bg-muted/40 p-1">
            {ARCHITECTURES.map((a) => {
              const Icon = a.icon;
              return (
                <TabsTrigger
                  key={a.key}
                  value={a.key}
                  className="flex-col gap-0.5 py-2.5 px-3 data-[state=active]:bg-background data-[state=active]:shadow-sm"
                >
                  <span className="flex items-center gap-1.5">
                    <Icon className="w-3.5 h-3.5" />
                    <span className="text-xs font-semibold tracking-tight">
                      {a.label}
                    </span>
                  </span>
                  <span className="text-[10px] text-muted-foreground font-medium">
                    {a.sublabel}
                  </span>
                </TabsTrigger>
              );
            })}
          </TabsList>

          {ARCHITECTURES.map((a) => (
            <TabsContent key={a.key} value={a.key} className="mt-5">
              <Card className="border-border/60">
                <CardContent className="p-0">
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground border-b border-border/50">
                          <th className="text-left py-3 px-5 font-semibold">
                            Product
                          </th>
                          <th className="text-left py-3 px-3 font-semibold">
                            Tier
                          </th>
                          <th className="text-right py-3 px-3 font-semibold">
                            Monthly
                          </th>
                          <th className="text-right py-3 px-3 font-semibold">
                            Annual pre-paid <span className="text-muted-foreground/70 font-normal normal-case">/mo equiv.</span>
                          </th>
                          <th className="text-right py-3 px-3 font-semibold">
                            Discount
                          </th>
                          <th className="w-12" />
                        </tr>
                      </thead>
                      <tbody>
                        {sortedTiers.map((t) => {
                          const product = products.find((p) => p.id === t.product_id);
                          const price = getTierPrice(t.id, a.key);
                          const monthly = price.monthly;
                          const annual = price.annual;
                          const computedAnnual =
                            annual ??
                            (monthly != null ? annualFromDiscount(monthly) : undefined);
                          const discountPct =
                            monthly != null && annual != null && monthly > 0
                              ? Math.round(((monthly - annual) / monthly) * 100)
                              : null;
                          return (
                            <MatrixRow
                              key={t.id}
                              productName={product?.name ?? t.product_id}
                              tierName={t.name}
                              monthly={monthly ?? null}
                              annual={annual ?? null}
                              computedAnnual={computedAnnual ?? null}
                              discountPct={discountPct}
                              onMonthly={(v) =>
                                setTierPrice(t.id, a.key, "monthly", v)
                              }
                              onAnnual={(v) =>
                                setTierPrice(t.id, a.key, "annual", v)
                              }
                              onReset={() => {
                                setTierPrice(t.id, a.key, "monthly", undefined);
                                setTierPrice(t.id, a.key, "annual", undefined);
                              }}
                            />
                          );
                        })}

                        {sortedBundles.length > 0 && (
                          <tr className="bg-muted/30 border-y border-border/40">
                            <td
                              colSpan={6}
                              className="py-2 px-5 text-[10px] uppercase tracking-wider font-semibold text-muted-foreground flex items-center gap-1.5"
                            >
                              <Sparkles className="w-3 h-3" />
                              Bundles
                            </td>
                          </tr>
                        )}
                        {sortedBundles.map((b) => {
                          const price = getBundlePrice(b.id, a.key);
                          const monthly = price.monthly;
                          const annual = price.annual;
                          const computedAnnual =
                            annual ??
                            (monthly != null ? annualFromDiscount(monthly) : undefined);
                          const discountPct =
                            monthly != null && annual != null && monthly > 0
                              ? Math.round(((monthly - annual) / monthly) * 100)
                              : null;
                          return (
                            <MatrixRow
                              key={b.id}
                              productName="Bundle"
                              tierName={b.name}
                              monthly={monthly ?? null}
                              annual={annual ?? null}
                              computedAnnual={computedAnnual ?? null}
                              discountPct={discountPct}
                              onMonthly={(v) =>
                                setBundlePrice(b.id, a.key, "monthly", v)
                              }
                              onAnnual={(v) =>
                                setBundlePrice(b.id, a.key, "annual", v)
                              }
                              onReset={() => {
                                setBundlePrice(b.id, a.key, "monthly", undefined);
                                setBundlePrice(b.id, a.key, "annual", undefined);
                              }}
                            />
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          ))}
        </Tabs>
      </section>

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

function SectionHeader({
  icon: Icon,
  title,
  subtitle,
}: {
  icon: React.ElementType;
  title: string;
  subtitle: string;
}) {
  return (
    <div className="flex items-center gap-2.5">
      <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
        <Icon className="w-4 h-4 text-primary" />
      </div>
      <div>
        <h3 className="text-base font-semibold text-card-foreground tracking-tight">
          {title}
        </h3>
        <p className="text-xs text-muted-foreground">{subtitle}</p>
      </div>
    </div>
  );
}

/** Single editable row in the architecture matrix. */
function MatrixRow({
  productName,
  tierName,
  monthly,
  annual,
  computedAnnual,
  discountPct,
  onMonthly,
  onAnnual,
  onReset,
}: {
  productName: string;
  tierName: string;
  monthly: number | null;
  annual: number | null;
  computedAnnual: number | null;
  discountPct: number | null;
  onMonthly: (v: number | undefined) => void;
  onAnnual: (v: number | undefined) => void;
  onReset: () => void;
}) {
  const hasAny = monthly != null || annual != null;

  return (
    <tr className="border-b border-border/30 last:border-0 hover:bg-muted/20 transition-colors">
      <td className="py-3 px-5">
        <span className="text-xs text-muted-foreground uppercase tracking-wider font-medium">
          {productName}
        </span>
      </td>
      <td className="py-3 px-3">
        <span className="text-sm font-medium text-card-foreground">
          {tierName}
        </span>
      </td>
      <td
        className="py-3 px-3 text-right"
        style={{ fontVariantNumeric: "tabular-nums" }}
      >
        <NumberField value={monthly} placeholder="—" onCommit={onMonthly} />
      </td>
      <td
        className="py-3 px-3 text-right"
        style={{ fontVariantNumeric: "tabular-nums" }}
      >
        {annual == null && computedAnnual != null ? (
          <div className="flex flex-col items-end">
            <NumberField value={null} placeholder="—" onCommit={onAnnual} />
            <span className="text-[10px] text-muted-foreground mt-0.5">
              calc. ${computedAnnual.toLocaleString()}
            </span>
          </div>
        ) : (
          <NumberField value={annual} placeholder="—" onCommit={onAnnual} />
        )}
      </td>
      <td
        className="py-3 px-3 text-right"
        style={{ fontVariantNumeric: "tabular-nums" }}
      >
        {discountPct != null ? (
          <span className="inline-flex items-center rounded-full bg-emerald-500/10 px-2 py-0.5 text-[11px] font-semibold text-emerald-700 dark:text-emerald-400 border border-emerald-500/20">
            -{discountPct}%
          </span>
        ) : (
          <span className="text-[11px] text-muted-foreground">—</span>
        )}
      </td>
      <td className="py-3 px-3 text-right">
        {hasAny && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onReset}
            className="h-7 px-2 text-muted-foreground hover:text-card-foreground"
            title="Clear this row"
          >
            <RotateCcw className="w-3 h-3" />
          </Button>
        )}
      </td>
    </tr>
  );
}

function NumberField({
  value,
  placeholder,
  onCommit,
}: {
  value: number | null;
  placeholder: string;
  onCommit: (v: number | undefined) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [buffer, setBuffer] = useState(value == null ? "" : String(value));

  useEffect(() => {
    setBuffer(value == null ? "" : String(value));
  }, [value]);

  const commit = () => {
    if (buffer.trim() === "") {
      onCommit(undefined);
    } else {
      const parsed = parseFloat(buffer);
      if (Number.isFinite(parsed) && parsed >= 0) {
        onCommit(Math.round(parsed));
      } else {
        setBuffer(value == null ? "" : String(value));
      }
    }
    setEditing(false);
  };

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
            setBuffer(value == null ? "" : String(value));
            setEditing(false);
          }
        }}
        className="w-24 ml-auto h-8 text-right"
        style={{ fontVariantNumeric: "tabular-nums" }}
      />
    );
  }

  return (
    <button
      type="button"
      onClick={() => setEditing(true)}
      className={`text-sm font-medium hover:underline underline-offset-4 ${
        value == null ? "text-muted-foreground" : "text-card-foreground"
      }`}
    >
      {value == null ? placeholder : `$${value.toLocaleString()}`}
    </button>
  );
}

export default PlatformPricingManager;
