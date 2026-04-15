import { useEffect, useMemo, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Slider } from "@/components/ui/slider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { usePlatform } from "@/contexts/PlatformContext";
import { Percent, Tag, Store, RotateCcw, Check, Info } from "lucide-react";

/**
 * Super-admin-only Platform Pricing Manager.
 *
 * Single page that lets the platform admin:
 *   1. Drag a slider to set the platform-wide annual-prepaid discount %
 *      (live preview of each tier's annual-equivalent monthly price).
 *   2. Edit base monthly prices per tier and per bundle.
 *   3. Edit multi-location (3+ rooftop) per-store prices per tier.
 *
 * Changes stage locally. A sticky "Save changes" bar slides up when the
 * draft diverges from the saved state. Save writes a singleton row to
 * `platform_pricing_model`.
 *
 * NOT wired to the dealer-facing pricing picker yet (per user direction).
 * This is a standalone configuration surface while the model is
 * finalized. Once the picker reads from `platform_pricing_model`, this
 * page becomes the authoritative control plane.
 */

type PriceOverride = { monthly?: number; annual?: number };

interface PricingModelRow {
  id: "global";
  annual_discount_pct: number;
  tier_overrides: Record<string, PriceOverride>;
  bundle_overrides: Record<string, PriceOverride>;
  multi_location_overrides: Record<string, PriceOverride>;
}

const DEFAULT_MODEL: PricingModelRow = {
  id: "global",
  annual_discount_pct: 15,
  tier_overrides: {},
  bundle_overrides: {},
  multi_location_overrides: {},
};

const PlatformPricingManager = () => {
  const { products, bundles, tiers } = usePlatform();
  const { toast } = useToast();

  const [saved, setSaved] = useState<PricingModelRow>(DEFAULT_MODEL);
  const [draft, setDraft] = useState<PricingModelRow>(DEFAULT_MODEL);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

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
        // Table may not exist yet in this environment — fall back to defaults.
        // Logged to console rather than toasted so first-visit load stays silent.
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
          tier_overrides: row.tier_overrides ?? {},
          bundle_overrides: row.bundle_overrides ?? {},
          multi_location_overrides: row.multi_location_overrides ?? {},
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
    () => [...bundles].sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0)),
    [bundles],
  );

  const resolvedTierMonthly = (tierId: string, catalog: number): number =>
    draft.tier_overrides[tierId]?.monthly ?? catalog;

  const resolvedBundleMonthly = (bundleId: string, catalog: number): number =>
    draft.bundle_overrides[bundleId]?.monthly ?? catalog;

  const resolvedMultiLoc = (tierId: string): PriceOverride | null =>
    draft.multi_location_overrides[tierId] ?? null;

  const annualEquivalent = (monthly: number) =>
    Math.round(monthly * (1 - draft.annual_discount_pct / 100));

  const updateTierOverride = (tierId: string, patch: PriceOverride) => {
    setDraft((d) => {
      const next = { ...d.tier_overrides };
      const merged: PriceOverride = { ...(next[tierId] ?? {}), ...patch };
      if (merged.monthly == null && merged.annual == null) {
        delete next[tierId];
      } else {
        next[tierId] = merged;
      }
      return { ...d, tier_overrides: next };
    });
  };

  const updateBundleOverride = (bundleId: string, patch: PriceOverride) => {
    setDraft((d) => {
      const next = { ...d.bundle_overrides };
      const merged: PriceOverride = { ...(next[bundleId] ?? {}), ...patch };
      if (merged.monthly == null && merged.annual == null) {
        delete next[bundleId];
      } else {
        next[bundleId] = merged;
      }
      return { ...d, bundle_overrides: next };
    });
  };

  const updateMultiLoc = (tierId: string, patch: PriceOverride) => {
    setDraft((d) => {
      const next = { ...d.multi_location_overrides };
      const merged: PriceOverride = { ...(next[tierId] ?? {}), ...patch };
      if (merged.monthly == null && merged.annual == null) {
        delete next[tierId];
      } else {
        next[tierId] = merged;
      }
      return { ...d, multi_location_overrides: next };
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
        multi_location_overrides: draft.multi_location_overrides,
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
        "Changes stored. The dealer-facing picker isn't reading from this yet — wire-up is the next step.",
    });
  };

  if (loading) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="h-8 w-64 bg-muted rounded" />
        <div className="h-40 bg-muted rounded" />
        <div className="h-80 bg-muted rounded" />
      </div>
    );
  }

  const modifiedCount =
    Object.keys(draft.tier_overrides).length +
    Object.keys(draft.bundle_overrides).length +
    Object.keys(draft.multi_location_overrides).length +
    (draft.annual_discount_pct !== saved.annual_discount_pct ? 1 : 0);

  return (
    <div className="space-y-12 pb-28">
      {/* Header */}
      <div>
        <h2 className="text-lg font-semibold text-card-foreground tracking-tight">
          Pricing Model
        </h2>
        <p className="text-sm text-muted-foreground mt-1 max-w-2xl">
          Control the numbers dealers see in the Billing &amp; Plan picker. Drag
          the annual-prepaid discount slider to re-price every tier at once, or
          override individual tiers and bundles below. Changes are staged —
          nothing ships until you hit <span className="font-medium">Save</span>.
        </p>
        <div className="mt-3 flex items-start gap-2 rounded-xl border border-amber-500/30 bg-amber-500/5 px-3 py-2 text-xs text-amber-900 dark:text-amber-200 max-w-2xl">
          <Info className="w-3.5 h-3.5 shrink-0 mt-0.5" />
          <p className="leading-snug">
            Not yet wired to the dealer onboarding picker. This page is the
            staging ground for the new pricing model — values save to a
            dedicated table and will drive the picker once we flip the switch.
          </p>
        </div>
      </div>

      {/* SECTION 1 — Annual Discount Slider */}
      <section className="space-y-5">
        <SectionHeader
          icon={Percent}
          title="Annual-prepaid discount"
          subtitle="One lever that re-prices every tier's annual-equivalent monthly rate."
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
                off when billed annually
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

            <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-4">
              {sortedTiers
                .filter((t) =>
                  ["autocurb_standard", "autofilm_full", "autoframe_unlimited"].includes(t.id),
                )
                .slice(0, 3)
                .map((t) => {
                  const base = resolvedTierMonthly(t.id, t.monthly_price);
                  const equiv = annualEquivalent(base);
                  const diff = base - equiv;
                  const product = products.find((p) => p.id === t.product_id);
                  return (
                    <div
                      key={t.id}
                      className="rounded-xl border border-border/50 bg-muted/20 p-4"
                    >
                      <p className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground">
                        {product?.name ?? ""} · {t.name}
                      </p>
                      <div
                        className="mt-1.5 flex items-baseline gap-1.5"
                        style={{ fontVariantNumeric: "tabular-nums" }}
                      >
                        <span className="text-2xl font-semibold text-card-foreground">
                          ${equiv.toLocaleString()}
                        </span>
                        <span className="text-xs text-muted-foreground">/mo</span>
                      </div>
                      <p
                        className="text-[11px] text-muted-foreground mt-0.5"
                        style={{ fontVariantNumeric: "tabular-nums" }}
                      >
                        was ${base.toLocaleString()}/mo · save $
                        {diff.toLocaleString()}/mo
                      </p>
                    </div>
                  );
                })}
            </div>
          </CardContent>
        </Card>
      </section>

      <Separator className="bg-border/50" />

      {/* SECTION 2 — Base monthly prices */}
      <section className="space-y-5">
        <SectionHeader
          icon={Tag}
          title="Base monthly pricing"
          subtitle="Catalog price per rooftop, single-store architecture. Annual equivalent recalculates from the slider above."
        />

        <Card className="border-border/60">
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground border-b border-border/50">
                    <th className="text-left py-3 px-5 font-semibold">Tier</th>
                    <th className="text-right py-3 px-3 font-semibold">Catalog</th>
                    <th className="text-right py-3 px-3 font-semibold">Base monthly</th>
                    <th className="text-right py-3 px-3 font-semibold">Annual equivalent</th>
                    <th className="text-right py-3 px-5 font-semibold w-16"></th>
                  </tr>
                </thead>
                <tbody>
                  {sortedTiers.map((t) => {
                    const product = products.find((p) => p.id === t.product_id);
                    const override = draft.tier_overrides[t.id];
                    const base = resolvedTierMonthly(t.id, t.monthly_price);
                    const equiv = annualEquivalent(base);
                    const changed = override?.monthly != null;
                    return (
                      <PriceRow
                        key={t.id}
                        label={t.name}
                        sublabel={product?.name}
                        catalog={t.monthly_price}
                        value={base}
                        equivalent={equiv}
                        changed={changed}
                        onChange={(v) =>
                          updateTierOverride(t.id, {
                            monthly: v === t.monthly_price ? undefined : v,
                          })
                        }
                        onReset={() =>
                          updateTierOverride(t.id, { monthly: undefined })
                        }
                      />
                    );
                  })}
                  {sortedBundles
                    .filter((b) => !b.is_enterprise)
                    .map((b) => {
                      const override = draft.bundle_overrides[b.id];
                      const base = resolvedBundleMonthly(b.id, b.monthly_price);
                      const equiv = annualEquivalent(base);
                      const changed = override?.monthly != null;
                      return (
                        <PriceRow
                          key={b.id}
                          label={b.name}
                          sublabel="Bundle"
                          catalog={b.monthly_price}
                          value={base}
                          equivalent={equiv}
                          changed={changed}
                          onChange={(v) =>
                            updateBundleOverride(b.id, {
                              monthly: v === b.monthly_price ? undefined : v,
                            })
                          }
                          onReset={() =>
                            updateBundleOverride(b.id, { monthly: undefined })
                          }
                        />
                      );
                    })}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </section>

      <Separator className="bg-border/50" />

      {/* SECTION 3 — Multi-location volume pricing */}
      <section className="space-y-5">
        <SectionHeader
          icon={Store}
          title="Multi-location volume pricing"
          subtitle="Per-store prices when a dealer has 3+ rooftops. Leave blank to inherit the base tier price."
        />

        <Card className="border-border/60">
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground border-b border-border/50">
                    <th className="text-left py-3 px-5 font-semibold">Tier</th>
                    <th className="text-right py-3 px-3 font-semibold">Single-store</th>
                    <th className="text-right py-3 px-3 font-semibold">Multi-loc monthly</th>
                    <th className="text-right py-3 px-3 font-semibold">Multi-loc annual</th>
                    <th className="text-right py-3 px-5 font-semibold w-16"></th>
                  </tr>
                </thead>
                <tbody>
                  {sortedTiers.map((t) => {
                    const product = products.find((p) => p.id === t.product_id);
                    const override = resolvedMultiLoc(t.id);
                    const base = resolvedTierMonthly(t.id, t.monthly_price);
                    return (
                      <MultiLocRow
                        key={t.id}
                        label={t.name}
                        sublabel={product?.name}
                        baseMonthly={base}
                        monthly={override?.monthly ?? null}
                        annual={override?.annual ?? null}
                        onMonthly={(v) =>
                          updateMultiLoc(t.id, {
                            monthly: v,
                            annual: override?.annual,
                          })
                        }
                        onAnnual={(v) =>
                          updateMultiLoc(t.id, {
                            monthly: override?.monthly,
                            annual: v,
                          })
                        }
                        onReset={() =>
                          updateMultiLoc(t.id, {
                            monthly: undefined,
                            annual: undefined,
                          })
                        }
                      />
                    );
                  })}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
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
                {modifiedCount} {modifiedCount === 1 ? "edit" : "edits"}
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

/** Inline editable price row for tiers + bundles. */
function PriceRow({
  label,
  sublabel,
  catalog,
  value,
  equivalent,
  changed,
  onChange,
  onReset,
}: {
  label: string;
  sublabel?: string;
  catalog: number;
  value: number;
  equivalent: number;
  changed: boolean;
  onChange: (v: number) => void;
  onReset: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [buffer, setBuffer] = useState(String(value));

  useEffect(() => {
    setBuffer(String(value));
  }, [value]);

  const commit = () => {
    const parsed = parseFloat(buffer);
    if (!Number.isFinite(parsed) || parsed < 0) {
      setBuffer(String(value));
    } else {
      onChange(Math.round(parsed));
    }
    setEditing(false);
  };

  return (
    <tr className="border-b border-border/30 last:border-0 hover:bg-muted/20 transition-colors">
      <td className="py-3.5 px-5">
        <div className="flex flex-col">
          <span className="text-sm font-medium text-card-foreground">{label}</span>
          {sublabel && (
            <span className="text-[11px] text-muted-foreground">{sublabel}</span>
          )}
        </div>
      </td>
      <td
        className="py-3.5 px-3 text-right text-muted-foreground text-xs"
        style={{ fontVariantNumeric: "tabular-nums" }}
      >
        ${catalog.toLocaleString()}
      </td>
      <td
        className="py-3.5 px-3 text-right"
        style={{ fontVariantNumeric: "tabular-nums" }}
      >
        {editing ? (
          <Input
            autoFocus
            type="number"
            value={buffer}
            onChange={(e) => setBuffer(e.target.value)}
            onBlur={commit}
            onKeyDown={(e) => {
              if (e.key === "Enter") commit();
              if (e.key === "Escape") {
                setBuffer(String(value));
                setEditing(false);
              }
            }}
            className="w-28 ml-auto h-8 text-right"
            style={{ fontVariantNumeric: "tabular-nums" }}
          />
        ) : (
          <button
            type="button"
            onClick={() => setEditing(true)}
            className={`inline-flex items-center gap-1.5 text-sm font-medium hover:underline underline-offset-4 ${
              changed ? "text-amber-600 dark:text-amber-400" : "text-card-foreground"
            }`}
          >
            ${value.toLocaleString()}
            {changed && (
              <span className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-full bg-amber-500/10 text-amber-700 dark:text-amber-300 border border-amber-500/30">
                edited
              </span>
            )}
          </button>
        )}
      </td>
      <td
        className="py-3.5 px-3 text-right text-sm"
        style={{ fontVariantNumeric: "tabular-nums" }}
      >
        <span className="text-emerald-700 dark:text-emerald-400 font-medium">
          ${equivalent.toLocaleString()}
        </span>
        <span className="text-muted-foreground text-xs">/mo</span>
      </td>
      <td className="py-3.5 px-5 text-right">
        {changed && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onReset}
            className="h-7 px-2 text-muted-foreground hover:text-card-foreground"
            title="Reset to catalog"
          >
            <RotateCcw className="w-3 h-3" />
          </Button>
        )}
      </td>
    </tr>
  );
}

/** Row for multi-location overrides — two editable fields (monthly + annual prepaid). */
function MultiLocRow({
  label,
  sublabel,
  baseMonthly,
  monthly,
  annual,
  onMonthly,
  onAnnual,
  onReset,
}: {
  label: string;
  sublabel?: string;
  baseMonthly: number;
  monthly: number | null;
  annual: number | null;
  onMonthly: (v: number | undefined) => void;
  onAnnual: (v: number | undefined) => void;
  onReset: () => void;
}) {
  const hasOverride = monthly != null || annual != null;

  return (
    <tr className="border-b border-border/30 last:border-0 hover:bg-muted/20 transition-colors">
      <td className="py-3.5 px-5">
        <div className="flex flex-col">
          <span className="text-sm font-medium text-card-foreground">{label}</span>
          {sublabel && (
            <span className="text-[11px] text-muted-foreground">{sublabel}</span>
          )}
        </div>
      </td>
      <td
        className="py-3.5 px-3 text-right text-muted-foreground text-xs"
        style={{ fontVariantNumeric: "tabular-nums" }}
      >
        ${baseMonthly.toLocaleString()}
      </td>
      <td
        className="py-3.5 px-3 text-right"
        style={{ fontVariantNumeric: "tabular-nums" }}
      >
        <NumberField value={monthly} placeholder="—" onCommit={onMonthly} />
      </td>
      <td
        className="py-3.5 px-3 text-right"
        style={{ fontVariantNumeric: "tabular-nums" }}
      >
        <NumberField value={annual} placeholder="—" onCommit={onAnnual} />
      </td>
      <td className="py-3.5 px-5 text-right">
        {hasOverride && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onReset}
            className="h-7 px-2 text-muted-foreground hover:text-card-foreground"
            title="Clear multi-location override"
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
        className="w-28 ml-auto h-8 text-right"
        style={{ fontVariantNumeric: "tabular-nums" }}
      />
    );
  }

  return (
    <button
      type="button"
      onClick={() => setEditing(true)}
      className={`text-sm font-medium hover:underline underline-offset-4 ${
        value == null ? "text-muted-foreground" : "text-amber-600 dark:text-amber-400"
      }`}
    >
      {value == null ? placeholder : `$${value.toLocaleString()}`}
    </button>
  );
}

export default PlatformPricingManager;
