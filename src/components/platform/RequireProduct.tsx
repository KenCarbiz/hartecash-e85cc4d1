import { ReactNode } from "react";
import { Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { usePlatform } from "@/contexts/PlatformContext";

interface RequireProductProps {
  /** Product id from platform_products (e.g. "autocurb", "autolabels",
   *  "autoframe", "autofilm"). Resolves through the same hasProduct()
   *  predicate the AppSwitcher uses. */
  productId: string;
  /** Optional minimum tier id within that product. When set, the gate
   *  also requires the dealer to be entitled to that tier OR a higher
   *  one ranked by sort_order on the tier row. */
  minTierId?: string;
  /** Friendly product name shown on the paywall card. Defaults to
   *  the productId if no products row matches. */
  productLabel?: string;
  /** Render this when the dealer IS entitled. */
  children: ReactNode;
  /** Override the default paywall card. */
  fallback?: ReactNode;
}

/**
 * Drop-in entitlement gate. Use to wrap any surface that should only
 * render when the dealer is subscribed to a specific product (or tier).
 *
 *   <RequireProduct productId="autolabels">
 *     <AutoLabelsLanding />
 *   </RequireProduct>
 *
 * Renders a small paywall card with "Upgrade" CTA when the dealer
 * doesn't have access. The CTA navigates to /plan so the dealer can
 * add the product to their subscription.
 */
const RequireProduct = ({
  productId,
  minTierId,
  productLabel,
  children,
  fallback,
}: RequireProductProps) => {
  const { hasProduct, getActiveTier, products, tiers } = usePlatform();
  const navigate = useNavigate();

  const productRow = products.find((p) => p.id === productId);
  const label = productLabel || productRow?.name || productId;

  let entitled = hasProduct(productId);

  // Tier-level gate: the dealer must own the named tier OR a tier
  // with sort_order >= the named one (i.e. a higher tier).
  if (entitled && minTierId) {
    const required = tiers.find((t) => t.id === minTierId);
    const active = getActiveTier(productId);
    if (!required) {
      // Unknown minTierId — fall back to product-level gate only,
      // log so the misconfiguration is visible.
      console.warn(`[RequireProduct] Unknown minTierId="${minTierId}" for product "${productId}".`);
    } else if (!active || active.sort_order < required.sort_order) {
      entitled = false;
    }
  }

  if (entitled) return <>{children}</>;
  if (fallback !== undefined) return <>{fallback}</>;

  return (
    <div className="max-w-md mx-auto my-12 rounded-2xl border border-border bg-card p-8 text-center shadow-sm">
      <div className="w-12 h-12 mx-auto mb-4 rounded-xl bg-muted flex items-center justify-center">
        <Lock className="w-5 h-5 text-muted-foreground" />
      </div>
      <h3 className="text-lg font-semibold mb-2">{label} isn't on your plan</h3>
      <p className="text-sm text-muted-foreground mb-6">
        {minTierId
          ? `This feature requires a higher ${label} tier than your current subscription.`
          : `Add ${label} to your subscription to unlock this section.`}
      </p>
      <Button onClick={() => navigate("/plan")}>View plan options</Button>
    </div>
  );
};

export default RequireProduct;
