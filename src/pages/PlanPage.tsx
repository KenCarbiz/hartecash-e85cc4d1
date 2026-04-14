import { useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { PlatformProvider, usePlatform } from "@/contexts/PlatformContext";
import { useTenant } from "@/contexts/TenantContext";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import PricingPlanPicker, { type PlanSelection } from "@/components/platform/PricingPlanPicker";
import { ArrowLeft } from "lucide-react";

/**
 * Dealer-facing standalone pricing / plan page. Reachable from the
 * AppSwitcher and from /plan. Uses the same shared PricingPlanPicker
 * that onboarding + admin use.
 */
const PlanPageInner = () => {
  const { tenant } = useTenant();
  const { subscription, tiers } = usePlatform();
  const { toast } = useToast();
  const navigate = useNavigate();

  const saveSelection = useCallback(
    async (selection: PlanSelection) => {
      const base = {
        dealership_id: tenant.dealership_id,
        status: "trial" as const,
        billing_cycle: selection.cycle === "annual" ? "annual" : "monthly",
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
        toast({ title: "Couldn't save plan", description: error.message, variant: "destructive" });
        return;
      }
      toast({
        title: "Plan updated",
        description: "Your account manager will follow up with billing details shortly.",
      });
      navigate("/admin");
    },
    [tenant.dealership_id, tiers, toast, navigate],
  );

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6 sm:py-10 space-y-6">
        <div className="flex items-center justify-between gap-4">
          <Button variant="ghost" size="sm" onClick={() => navigate(-1)}>
            <ArrowLeft className="w-4 h-4 mr-1.5" />
            Back
          </Button>
          <div className="text-right">
            <h1 className="text-2xl font-bold text-card-foreground tracking-tight">Your plan</h1>
            <p className="text-[11px] text-muted-foreground">
              {subscription
                ? `${subscription.billing_cycle === "annual" ? "Annual" : "Monthly"} · ${subscription.rooftop_count ?? 1} rooftop${(subscription.rooftop_count ?? 1) > 1 ? "s" : ""}`
                : "No active subscription"}
            </p>
          </div>
        </div>

        <PricingPlanPicker
          initialSelection={
            subscription?.bundle_id
              ? { kind: "bundle", bundleId: subscription.bundle_id, cycle: (subscription.billing_cycle as "monthly" | "annual") ?? "monthly" }
              : subscription?.tier_ids && subscription.tier_ids.length > 0
                ? { kind: "tiers", tierIds: subscription.tier_ids, cycle: (subscription.billing_cycle as "monthly" | "annual") ?? "monthly" }
                : undefined
          }
          ctaLabel="Save plan"
          onConfirm={saveSelection}
        />
      </div>
    </div>
  );
};

const PlanPage = () => (
  <PlatformProvider>
    <PlanPageInner />
  </PlatformProvider>
);

export default PlanPage;
