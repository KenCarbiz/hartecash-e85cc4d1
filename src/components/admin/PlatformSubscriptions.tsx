import { useCallback, useState } from "react";
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
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useTenant } from "@/contexts/TenantContext";
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
  const { products, tiers, subscription, hasProduct, getActiveTier, entitledTierIds } = usePlatform();
  const { tenant } = useTenant();
  const { toast } = useToast();
  // "Change plan" is collapsed by default — admins arrive here to see
  // current status, not reshop. Opens only when they explicitly ask.
  const [pickerOpen, setPickerOpen] = useState(false);

  const activeProducts = products
    .filter((p) => p.is_active)
    .sort((a, b) => a.sort_order - b.sort_order);

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
      const payload =
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

      const { error } = await supabase
        .from("dealer_subscriptions")
        .upsert(payload as never, { onConflict: "dealership_id" });

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

      {/* Current subscription snapshot */}
      <Card className="border-border/50 shadow-lg overflow-hidden relative">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/[0.03] to-transparent pointer-events-none" />
        <CardHeader className="relative pb-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-primary/70 flex items-center justify-center shadow-md">
                <CreditCard className="w-5 h-5 text-primary-foreground" />
              </div>
              <div>
                <CardTitle className="text-lg">Current Plan</CardTitle>
                <CardDescription>
                  {subscription
                    ? `${subscription.billing_cycle === "annual" ? "Annual" : "Monthly"} billing · ${subscription.rooftop_count ?? 1} rooftop${(subscription.rooftop_count ?? 1) > 1 ? "s" : ""}`
                    : "No active subscription"}
                </CardDescription>
              </div>
            </div>
            {subscription && (
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
          {subscription ? (
            <div className="space-y-2">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Active Products
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {activeProducts.map((product) => {
                  const Icon = ICON_MAP[product.icon_name] || Car;
                  const active = hasProduct(product.id);
                  const tier: PlatformProductTier | null = getActiveTier(product.id);
                  const complimentary =
                    tier &&
                    tier.included_with_product_ids.length > 0 &&
                    tier.included_with_product_ids.some((pid) => hasProduct(pid)) &&
                    !subscription.tier_ids?.includes(tier.id);
                  return (
                    <div
                      key={product.id}
                      className={`flex items-center gap-3 p-3 rounded-lg border transition-all ${
                        active
                          ? "bg-card border-border/50 shadow-sm"
                          : "bg-muted/30 border-transparent opacity-60"
                      }`}
                    >
                      <div
                        className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                          active ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"
                        }`}
                      >
                        <Icon className="w-4 h-4" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-semibold text-card-foreground truncate">
                          {product.name}
                          {tier && active && (
                            <span className="ml-1.5 text-[10px] font-normal text-muted-foreground">
                              · {tier.name}
                            </span>
                          )}
                        </p>
                        <p className="text-[10px] text-muted-foreground truncate">
                          {complimentary ? (
                            <span className="inline-flex items-center gap-0.5 text-emerald-600 font-medium">
                              <Gift className="w-2.5 h-2.5" /> Included with your plan
                            </span>
                          ) : (
                            product.description
                          )}
                        </p>
                      </div>
                      {active ? (
                        <Check className="w-4 h-4 text-emerald-500 shrink-0" />
                      ) : (
                        <Lock className="w-3.5 h-3.5 text-muted-foreground/50 shrink-0" />
                      )}
                    </div>
                  );
                })}
              </div>
              {entitledTierIds.size === 0 && (
                <div className="p-3 rounded-lg bg-muted/50 border border-border text-[11px] text-muted-foreground">
                  No tiers assigned yet — pick one per app below.
                </div>
              )}
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
      <Collapsible open={pickerOpen} onOpenChange={setPickerOpen}>
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
