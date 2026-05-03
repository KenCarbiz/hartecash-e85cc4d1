import { useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { PlatformProvider, usePlatform } from "@/contexts/PlatformContext";
import { useTenant } from "@/contexts/TenantContext";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import PricingPlanPicker, { type PlanSelection } from "@/components/platform/PricingPlanPicker";
import { ArrowLeft, ExternalLink } from "lucide-react";
import { useState } from "react";

/**
 * Dealer-facing standalone pricing / plan page. Reachable from the
 * AppSwitcher and from /plan. Uses the same shared PricingPlanPicker
 * that onboarding + admin use.
 */
const PlanPageInner = () => {
  const { tenant } = useTenant();
  const { subscription, architecture } = usePlatform();
  const { toast } = useToast();
  const navigate = useNavigate();

  const saveSelection = useCallback(
    async (selection: PlanSelection) => {
      // Stripe Checkout flow.
      // Picker passes the selection up; we forward it to billing-subscribe,
      // which resolves Stripe Price IDs by metadata and returns a Checkout
      // Session URL. The webhook (billing-stripe-webhook) writes the
      // subscription state back into dealer_subscriptions on confirmation,
      // so there's no local upsert here — Stripe is the source of truth.
      //
      // Enterprise (custom-quote) bundles still take the legacy upsert
      // path: the picker only emits {kind:"enterprise"} for the
      // contact-sales flow, where the actual subscription is created
      // manually in Stripe by the platform admin and the webhook will
      // backfill the row. Until then we save the selection locally so
      // /plan can show "request submitted" state.
      if (selection.kind === "enterprise") {
        const { error } = await supabase
          .from("dealer_subscriptions")
          .upsert(
            {
              dealership_id: tenant.dealership_id,
              bundle_id: selection.bundleId,
              tier_ids: [],
              product_ids: [],
              status: "trial",
              billing_cycle: "annual",
              rooftop_count: Math.max(1, selection.rooftopCount ?? 1),
              updated_at: new Date().toISOString(),
            } as never,
            { onConflict: "dealership_id" },
          );
        if (error) {
          toast({ title: "Couldn't save request", description: error.message, variant: "destructive" });
          return;
        }
        toast({
          title: "Request submitted",
          description: "Your enterprise request is in. We'll be in touch within one business day.",
        });
        navigate("/admin");
        return;
      }

      // Standard flow → Stripe Checkout.
      const { data, error } = await supabase.functions.invoke("billing-subscribe", {
        body: {
          selection: {
            kind: selection.kind,
            bundleId: selection.kind === "bundle" ? selection.bundleId : undefined,
            tierIds: selection.kind === "tiers" ? selection.tierIds : undefined,
            cycle: selection.cycle,
            rooftopCount: Math.max(1, selection.rooftopCount ?? 1),
          },
          origin: window.location.origin,
          return_path: "/plan",
        },
      });
      if (error) {
        toast({
          title: "Couldn't start checkout",
          description: error.message,
          variant: "destructive",
        });
        return;
      }
      const url = (data as { url?: string })?.url;
      if (!url) {
        toast({
          title: "Checkout unavailable",
          description: "Stripe Checkout couldn't be created. Please try again or contact support.",
          variant: "destructive",
        });
        return;
      }
      // Hand off to Stripe. The dealer comes back via success_url which
      // includes ?subscribed=1; PlanPage can show a confirmation banner
      // there in a follow-up.
      window.location.href = url;
    },
    [tenant.dealership_id, toast, navigate],
  );

  // Open the Stripe Customer Portal so the dealer can update card,
  // download invoices, or cancel. Only meaningful for dealers with an
  // active Stripe subscription (stripe_customer_id set in tenants).
  const [portalLoading, setPortalLoading] = useState(false);
  const openCustomerPortal = useCallback(async () => {
    setPortalLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("billing-portal-session", {
        body: { return_url: `${window.location.origin}/plan` },
      });
      if (error) throw error;
      const url = (data as { url?: string })?.url;
      if (!url) throw new Error("No portal URL returned");
      window.location.href = url;
    } catch (e) {
      toast({
        title: "Couldn't open billing portal",
        description: (e as Error).message,
        variant: "destructive",
      });
      setPortalLoading(false);
    }
  }, [toast]);

  const hasActiveStripeSub = !!(subscription as any)?.stripe_subscription_id;

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 sm:py-10 space-y-6">
        <div className="flex items-center justify-between gap-4">
          <Button variant="ghost" size="sm" onClick={() => navigate(-1)}>
            <ArrowLeft className="w-4 h-4 mr-1.5" />
            Back
          </Button>
          <div className="flex items-center gap-3">
            {hasActiveStripeSub && (
              <Button
                variant="outline"
                size="sm"
                onClick={openCustomerPortal}
                disabled={portalLoading}
              >
                <ExternalLink className="w-3.5 h-3.5 mr-1.5" />
                {portalLoading ? "Opening…" : "Manage billing"}
              </Button>
            )}
            <div className="text-right">
              <h1 className="text-2xl font-bold text-card-foreground tracking-tight">Your plan</h1>
              <p className="text-[11px] text-muted-foreground">
                {subscription
                  ? `${subscription.billing_cycle === "annual" ? "Annual" : "Monthly"} · ${subscription.rooftop_count ?? 1} rooftop${(subscription.rooftop_count ?? 1) > 1 ? "s" : ""}`
                  : "No active subscription"}
              </p>
            </div>
          </div>
        </div>

        <PricingPlanPicker
          architecture={architecture}
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
