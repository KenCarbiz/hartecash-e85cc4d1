import { useCallback, useMemo, useState } from "react";
import { usePlatform } from "@/contexts/PlatformContext";
import type { PlatformProductTier } from "@/contexts/PlatformContext";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import PricingPlanPicker, { type PlanSelection } from "@/components/platform/PricingPlanPicker";
import {
  FALLBACK_PRODUCTS,
  FALLBACK_TIERS,
  FALLBACK_BUNDLES,
} from "@/components/platform/pricing/fallbackCatalog";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useTenant } from "@/contexts/TenantContext";
import { formatUSD } from "@/lib/entitlements";
import type { PlatformProduct, PlatformBundle } from "@/lib/entitlements";
import {
  Car,
  FileCheck,
  Camera,
  Video,
  Tag,
  Check,
  Lock,
  CreditCard,
  Zap,
  Gift,
  ChevronDown,
  Pencil,
  Sparkles,
} from "lucide-react";

const ICON_MAP: Record<string, React.ElementType> = {
  Car,
  FileCheck,
  Camera,
  Video,
  Tag,
};

const STATUS_COLORS: Record<string, string> = {
  active: "bg-emerald-500/15 text-emerald-600 border-emerald-500/30",
  trial: "bg-amber-500/15 text-amber-600 border-amber-500/30",
  suspended: "bg-red-500/15 text-red-600 border-red-500/30",
  cancelled: "bg-muted text-muted-foreground border-border",
};

const PlatformSubscriptions = () => {
  const { products: dbProducts, bundles: dbBundles, tiers: dbTiers, subscription, hasProduct, getActiveTier, entitledTierIds } = usePlatform();
  const { tenant } = useTenant();
  const { toast } = useToast();
  // "Change plan" is collapsed by default — admins arrive here to see
  // current status, not reshop. Opens only when they explicitly ask.
  const [pickerOpen, setPickerOpen] = useState(false);

  // In-flight selection — every click in the picker fires onChange
  // and lands here, so the Current Plan area up top updates live.
  // Cleared when the dealer saves (subscription refresh takes over)
  // or closes the picker without saving.
  const [inFlight, setInFlight] = useState<PlanSelection | null>(null);

  // Merge DB catalog with the fallback so the Current Plan lineup up
  // top can always resolve a bundle / tier / product by id, even when
  // the platform_* tables haven't been seeded yet. Same merge strategy
  // as PricingPlanPicker — DB rows win on matching ids.
  const products = useMemo(() => {
    const map = new Map<string, PlatformProduct>();
    for (const p of FALLBACK_PRODUCTS) map.set(p.id, p);
    for (const p of dbProducts) map.set(p.id, p);
    return Array.from(map.values());
  }, [dbProducts]);

  const bundles = useMemo(() => {
    const map = new Map<string, PlatformBundle>();
    for (const b of FALLBACK_BUNDLES) map.set(b.id, b);
    for (const b of dbBundles) map.set(b.id, b);
    return Array.from(map.values());
  }, [dbBundles]);

  const tiers = useMemo(() => {
    const map = new Map<string, PlatformProductTier>();
    for (const t of FALLBACK_TIERS) map.set(t.id, t);
    for (const t of dbTiers) map.set(t.id, t);
    return Array.from(map.values());
  }, [dbTiers]);

  const activeProducts = products
    .filter((p) => p.is_active)
    .sort((a, b) => a.sort_order - b.sort_order);

  // ── Resolve what to render in Current Plan ────────────────────────
  // Priority: in-flight picker selection (live preview) > saved DB
  // subscription. The "dirty" flag lets the UI show an Unsaved-changes
  // pill and style the lineup card with an amber ring.
  const hasInFlight = inFlight != null;
  const dirty = hasInFlight;

  const displayedBundleId = hasInFlight
    ? inFlight?.kind === "bundle"
      ? inFlight.bundleId
      : null
    : subscription?.bundle_id ?? null;

  const displayedTierIds: string[] = hasInFlight
    ? inFlight?.kind === "tiers"
      ? inFlight.tierIds
      : []
    : subscription?.tier_ids ?? [];

  const displayedCycle: "monthly" | "annual" =
    (hasInFlight
      ? inFlight?.kind !== "enterprise"
        ? inFlight?.cycle
        : "monthly"
      : (subscription?.billing_cycle as "monthly" | "annual" | undefined)) === "annual"
      ? "annual"
      : "monthly";

  const displayedRooftopCount = Math.max(
    1,
    hasInFlight
      ? inFlight?.rooftopCount ?? 1
      : subscription?.rooftop_count ?? 1,
  );

  const hasAnySelection = displayedBundleId != null || displayedTierIds.length > 0;

  // ── Totals maths for the lineup + bubbles ─────────────────────────
  const activeBundle = useMemo(
    () => (displayedBundleId ? bundles.find((b) => b.id === displayedBundleId) ?? null : null),
    [displayedBundleId, bundles],
  );

  const rooftopCount = displayedRooftopCount;
  const cycle = displayedCycle;

  const subscribedTiers = useMemo<PlatformProductTier[]>(() => {
    if (displayedTierIds.length === 0) return [];
    return displayedTierIds
      .map((id) => tiers.find((t) => t.id === id))
      .filter(Boolean) as PlatformProductTier[];
  }, [displayedTierIds, tiers]);

  const effectiveMonthly = (row: { monthly_price: number; annual_price: number | null }) =>
    cycle === "annual" && row.annual_price
      ? Math.round(row.annual_price / 12)
      : row.monthly_price;

  const monthlyPerRooftop = useMemo(() => {
    if (activeBundle) return effectiveMonthly(activeBundle);
    return subscribedTiers.reduce((acc, t) => acc + effectiveMonthly(t), 0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeBundle, subscribedTiers, cycle]);

  const monthlyTotal = monthlyPerRooftop * rooftopCount;

  const dueNow = useMemo(() => {
    if (cycle !== "annual") return 0;
    if (activeBundle?.annual_price && Number.isFinite(activeBundle.annual_price)) {
      return activeBundle.annual_price * rooftopCount;
    }
    const sum = subscribedTiers.reduce((acc, t) => {
      const annual = t.annual_price ?? (t.monthly_price ?? 0) * 12;
      return acc + (Number.isFinite(annual) ? annual : 0);
    }, 0);
    return sum * rooftopCount;
  }, [cycle, activeBundle, subscribedTiers, rooftopCount]);

  // Persist the dealer's plan selection. Records immediately — Stripe
  // checkout will swap in later; until then this is a "declared intent"
  // row the account manager works from.
  const saveSelection = useCallback(
    async (selection: PlanSelection) => {
      const cycle =
        selection.kind !== "enterprise" && selection.cycle === "annual" ? "annual" : "monthly";
      const base = {
        dealership_id: tenant.dealership_id,
        status: "trial" as const,
        billing_cycle: cycle,
        rooftop_count: Math.max(1, selection.rooftopCount ?? 1),
        updated_at: new Date().toISOString(),
      };
      const payload: Record<string, unknown> =
        selection.kind === "bundle"
          ? { ...base, bundle_id: selection.bundleId, tier_ids: [], product_ids: [] }
          : selection.kind === "tiers"
            ? (() => {
                const productIds = Array.from(
                  new Set(
                    selection.tierIds
                      .map((tid) => tiers.find((t) => t.id === tid)?.product_id)
                      .filter(Boolean) as string[],
                  ),
                );
                return { ...base, bundle_id: null, tier_ids: selection.tierIds, product_ids: productIds };
              })()
            : { ...base, bundle_id: selection.bundleId, tier_ids: [], product_ids: [] };

      // Resilient save — identical pattern to DealerOnboarding. Tolerates
      //   (1) PostgREST schema-cache missing a column (strip + retry)
      //   (2) Missing UNIQUE constraint on dealership_id (manual upsert)
      const dealershipId = tenant.dealership_id;
      const manualUpsert = async (): Promise<{ error: { message: string } | null }> => {
        const { data: existing } = await supabase
          .from("dealer_subscriptions")
          .select("id")
          .eq("dealership_id", dealershipId)
          .maybeSingle();
        if (existing && (existing as { id?: string }).id) {
          const { error } = await supabase
            .from("dealer_subscriptions")
            .update(payload as never)
            .eq("dealership_id", dealershipId);
          return { error: error ? { message: error.message } : null };
        }
        const { error } = await supabase
          .from("dealer_subscriptions")
          .insert(payload as never);
        return { error: error ? { message: error.message } : null };
      };

      let error: { message: string } | null = null;
      for (let attempt = 0; attempt < 4; attempt++) {
        const res = await supabase
          .from("dealer_subscriptions")
          .upsert(payload as never, { onConflict: "dealership_id" });
        error = res.error ? { message: res.error.message } : null;
        if (!error) break;
        const colMatch = /Could not find the '([a-z_]+)' column/i.exec(error.message);
        if (colMatch) {
          // eslint-disable-next-line no-console
          console.warn(
            `[PlatformSubscriptions] schema cache missing '${colMatch[1]}', retrying without it`,
          );
          delete payload[colMatch[1]];
          continue;
        }
        if (/ON CONFLICT/i.test(error.message) || /no unique or exclusion/i.test(error.message)) {
          // eslint-disable-next-line no-console
          console.warn(
            "[PlatformSubscriptions] UNIQUE(dealership_id) missing — falling back to manual upsert",
          );
          const r = await manualUpsert();
          error = r.error;
        }
        break;
      }

      if (error) {
        toast({
          title: "Couldn't save plan",
          description: error.message,
          variant: "destructive",
        });
        return;
      }
      toast({
        title: "Plan updated",
        description:
          selection.kind === "bundle"
            ? "Bundle selection saved. Your account manager will reach out for billing."
            : "Tier selections saved. Your account manager will reach out for billing.",
      });
      // Clear the in-flight preview so the Current Plan falls back to
      // the refreshed DB subscription (single source of truth after save).
      setInFlight(null);
    },
    [tenant.dealership_id, tiers, toast],
  );

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-card-foreground tracking-tight">Platform & Billing</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Manage your AutoCurb Platform subscription across AutoCurb.io, AutoLabels.io, AutoFrame.io, and AutoFilm.io.
        </p>
      </div>

      {/* Current Plan snapshot — reflects the dealer's saved sub OR
          the in-flight picker selection (live preview). The amber ring
          + pill below signal when the render is a draft, not saved. */}
      <Card
        className={`shadow-lg overflow-hidden relative transition-[box-shadow,background] ${
          dirty
            ? "border-amber-400/60 ring-1 ring-amber-300/50 bg-amber-50/40 dark:bg-amber-500/5"
            : "border-border/50"
        }`}
      >
        <div className="absolute inset-0 bg-gradient-to-br from-primary/[0.03] to-transparent pointer-events-none" />
        <CardHeader className="relative pb-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-primary/70 flex items-center justify-center shadow-md">
                <CreditCard className="w-5 h-5 text-primary-foreground" />
              </div>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <CardTitle className="text-lg">Current Plan</CardTitle>
                  {dirty && (
                    <Badge
                      variant="outline"
                      className="text-[10px] font-bold uppercase tracking-wider border-amber-400/60 bg-amber-500/10 text-amber-700 dark:text-amber-300 gap-1"
                    >
                      <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
                      Unsaved changes
                    </Badge>
                  )}
                </div>
                <CardDescription>
                  {hasAnySelection
                    ? `${cycle === "annual" ? "Annual" : "Monthly"} billing · ${rooftopCount} rooftop${rooftopCount > 1 ? "s" : ""}`
                    : "No active subscription"}
                </CardDescription>
              </div>
            </div>
            {subscription && !dirty && (
              <Badge
                variant="outline"
                className={`text-xs font-semibold ${STATUS_COLORS[subscription.status] || ""}`}
              >
                {subscription.status.charAt(0).toUpperCase() + subscription.status.slice(1)}
              </Badge>
            )}
          </div>
        </CardHeader>
        <CardContent className="relative space-y-4">
          {hasAnySelection ? (
            <div className="flex flex-col lg:flex-row gap-4">
              {/* ── LEFT: horizontal lineup of subscribed products ───── */}
              <div className="flex-1 min-w-0">
                <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-2">
                  Your Platform Choices
                </p>
                <div className="flex gap-2.5 overflow-x-auto pb-1 -mx-1 px-1">
                  {activeBundle ? (
                    // Bundle takes the whole lineup — one hero card
                    // that reads the four included apps inline.
                    <div className="shrink-0 min-w-[280px] rounded-xl border border-primary/50 bg-gradient-to-br from-primary/10 to-primary/[0.04] p-3 shadow-sm">
                      <div className="flex items-center gap-2 mb-1.5">
                        <Sparkles className="w-3.5 h-3.5 text-primary shrink-0" />
                        <p className="text-[10px] font-bold uppercase tracking-wider text-primary">
                          Bundle · All-Apps
                        </p>
                      </div>
                      <p className="text-sm font-bold text-card-foreground leading-tight">
                        {activeBundle.name}
                      </p>
                      <div className="flex flex-wrap gap-1 mt-2">
                        {(activeBundle.product_ids ?? []).map((pid) => {
                          const p = products.find((x) => x.id === pid);
                          if (!p) return null;
                          const Icon = ICON_MAP[p.icon_name] || Car;
                          return (
                            <span
                              key={pid}
                              className="inline-flex items-center gap-1 rounded-full border border-border/60 bg-card px-2 py-0.5 text-[10px] text-card-foreground"
                            >
                              <Icon className="w-2.5 h-2.5" />
                              {p.name}
                            </span>
                          );
                        })}
                      </div>
                      <p
                        className="text-lg font-bold text-card-foreground mt-2"
                        style={{ fontVariantNumeric: "tabular-nums" }}
                      >
                        {formatUSD(effectiveMonthly(activeBundle))}
                        <span className="text-[10px] font-normal text-muted-foreground ml-0.5">
                          /rooftop/mo
                        </span>
                      </p>
                    </div>
                  ) : subscribedTiers.length > 0 ? (
                    // Union of products with a selected tier (live or saved).
                    // Uses displayedTierIds when dirty so the lineup reflects
                    // the picker clicks before the dealer hits Save.
                    activeProducts
                      .filter((p) => {
                        if (hasInFlight) {
                          return displayedTierIds.some(
                            (tid) => tiers.find((t) => t.id === tid)?.product_id === p.id,
                          );
                        }
                        return hasProduct(p.id);
                      })
                      .map((product) => {
                        const Icon = ICON_MAP[product.icon_name] || Car;
                        const tierByDisplayed = hasInFlight
                          ? tiers.find(
                              (t) =>
                                displayedTierIds.includes(t.id) && t.product_id === product.id,
                            ) ?? null
                          : getActiveTier(product.id);
                        const tier = tierByDisplayed;
                        // Is this tier actually free given the current
                        // lineup? Check the displayed tier IDs' product_ids
                        // against the tier's `included_with_product_ids`.
                        const displayedProductIds = new Set(
                          displayedTierIds
                            .map((tid) => tiers.find((t) => t.id === tid)?.product_id)
                            .filter(Boolean) as string[],
                        );
                        const complimentary =
                          tier &&
                          tier.included_with_product_ids.length > 0 &&
                          tier.included_with_product_ids.some(
                            (pid) => displayedProductIds.has(pid) && pid !== tier.product_id,
                          );
                        const price = tier ? effectiveMonthly(tier) : 0;
                        return (
                          <div
                            key={product.id}
                            className="shrink-0 w-48 rounded-xl border border-border/60 bg-card p-3 shadow-sm flex flex-col"
                          >
                            <div className="flex items-center gap-2 mb-1">
                              <div className="w-7 h-7 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
                                <Icon className="w-3.5 h-3.5" />
                              </div>
                              <p className="text-xs font-bold text-card-foreground truncate">
                                {product.name}
                              </p>
                            </div>
                            {tier && (
                              <p className="text-[10px] text-muted-foreground mb-1.5 truncate">
                                {tier.name}
                              </p>
                            )}
                            {complimentary ? (
                              <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-emerald-600">
                                <Gift className="w-2.5 h-2.5" /> Included
                              </span>
                            ) : (
                              <p
                                className="text-base font-bold text-card-foreground"
                                style={{ fontVariantNumeric: "tabular-nums" }}
                              >
                                {formatUSD(price)}
                                <span className="text-[10px] font-normal text-muted-foreground ml-0.5">
                                  /mo
                                </span>
                              </p>
                            )}
                            {cycle === "annual" && tier?.annual_price && (
                              <p className="text-[9px] text-emerald-600 font-semibold mt-0.5">
                                Annual prepaid
                              </p>
                            )}
                          </div>
                        );
                      })
                  ) : (
                    <div className="w-full p-3 rounded-lg bg-muted/50 border border-border text-[11px] text-muted-foreground">
                      No tiers assigned yet — pick one per app below.
                    </div>
                  )}
                </div>
              </div>

              {/* ── RIGHT: totals bubbles ──────────────────────────── */}
              <div className="lg:w-64 shrink-0 flex flex-col gap-2.5">
                <div className="rounded-xl border border-primary/50 bg-gradient-to-br from-primary/10 to-primary/[0.04] p-4 shadow-sm">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-primary">
                    Monthly Total
                  </p>
                  <p
                    className="text-3xl font-bold text-card-foreground leading-none mt-1.5"
                    style={{ fontVariantNumeric: "tabular-nums" }}
                  >
                    {formatUSD(monthlyTotal)}
                    <span className="text-[11px] font-normal text-muted-foreground ml-1">/mo</span>
                  </p>
                  <p className="text-[10px] text-muted-foreground mt-1">
                    {rooftopCount} rooftop{rooftopCount > 1 ? "s" : ""}
                    {rooftopCount > 1 && (
                      <span className="ml-1">
                        · {formatUSD(monthlyPerRooftop)}/ea
                      </span>
                    )}
                  </p>
                </div>

                {cycle === "annual" && dueNow > 0 && (
                  <div className="rounded-xl border border-emerald-500/50 bg-gradient-to-br from-emerald-500/10 to-emerald-500/[0.05] p-4 shadow-sm">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-300">
                      Due now · 12 months upfront
                    </p>
                    <p
                      className="text-2xl font-bold text-card-foreground leading-none mt-1.5"
                      style={{ fontVariantNumeric: "tabular-nums" }}
                    >
                      {formatUSD(dueNow)}
                    </p>
                    <p className="text-[10px] text-emerald-700 dark:text-emerald-300 mt-1">
                      Then {formatUSD(monthlyTotal)}/mo at renewal
                    </p>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="text-center py-8">
              <Zap className="w-10 h-10 text-muted-foreground/40 mx-auto mb-3" />
              <p className="text-sm font-medium text-card-foreground">No Active Subscription</p>
              <p className="text-xs text-muted-foreground mt-1">
                Choose tiers below to get started with the AutoCurb Platform.
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Change plan — collapsed by default so admins see the current-plan
          snapshot first, not a wall of pricing cards. */}
      <Collapsible
        open={pickerOpen}
        onOpenChange={(next) => {
          setPickerOpen(next);
          // Discard the in-flight preview when the picker closes
          // without a Save. The Current Plan snaps back to the saved
          // subscription so we never lie about what's billed.
          if (!next) setInFlight(null);
        }}
      >
        <div className="flex items-center justify-between rounded-xl border border-border/50 bg-gradient-to-br from-muted/30 to-muted/10 px-4 py-3">
          <div className="min-w-0">
            <p className="text-sm font-bold text-card-foreground leading-tight">
              {subscription ? "Change your plan" : "Pick a starting plan"}
            </p>
            <p className="text-[11px] text-muted-foreground mt-0.5 leading-snug">
              {pickerOpen
                ? "Browse bundles, pick one tier per app, or contact enterprise sales."
                : "Open the picker to switch tiers, upgrade, or start a dealer-group conversation."}
            </p>
          </div>
          <CollapsibleTrigger asChild>
            <Button size="sm" variant={pickerOpen ? "outline" : "default"} className="shrink-0 ml-3">
              <Pencil className="w-3.5 h-3.5 mr-1.5" />
              {pickerOpen ? "Close" : subscription ? "Change plan" : "Choose plan"}
              <ChevronDown
                className={`w-3.5 h-3.5 ml-1.5 transition-transform ${pickerOpen ? "rotate-180" : ""}`}
              />
            </Button>
          </CollapsibleTrigger>
        </div>

        <CollapsibleContent className="pt-6 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0">
          <PricingPlanPicker
            variant="full"
            initialSelection={
              subscription?.bundle_id
                ? {
                    kind: "bundle",
                    bundleId: subscription.bundle_id,
                    cycle: (subscription.billing_cycle as "monthly" | "annual") ?? "monthly",
                    rooftopCount: subscription.rooftop_count ?? 1,
                  }
                : subscription?.tier_ids && subscription.tier_ids.length > 0
                  ? {
                      kind: "tiers",
                      tierIds: subscription.tier_ids,
                      cycle: (subscription.billing_cycle as "monthly" | "annual") ?? "monthly",
                      rooftopCount: subscription.rooftop_count ?? 1,
                    }
                  : undefined
            }
            ctaLabel="Save plan"
            onChange={(s) => {
              // Debug log — remove after hartecash confirms cards
              // accumulate as expected. Helps diagnose a "cards
              // disappear on subsequent clicks" bug report.
              // eslint-disable-next-line no-console
              console.debug("[PlatformSubscriptions] picker onChange", s);
              setInFlight(s ?? null);
            }}
            onConfirm={async (s) => {
              await saveSelection(s);
              setPickerOpen(false);
            }}
          />
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
};

export default PlatformSubscriptions;
