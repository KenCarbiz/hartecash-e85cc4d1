import { createContext, useContext, useEffect, useMemo, useState, useCallback, ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useTenant } from "@/contexts/TenantContext";
import {
  resolveEntitledTierIds,
  hasProductAccess,
  getActiveTier,
  type PlatformProduct,
  type PlatformBundle,
  type PlatformProductTier,
  type DealerSubscription,
} from "@/lib/entitlements";

// Re-export the shared types so existing imports from the context keep working.
export type { PlatformProduct, PlatformBundle, PlatformProductTier, DealerSubscription };

interface PlatformContextValue {
  products: PlatformProduct[];
  bundles: PlatformBundle[];
  tiers: PlatformProductTier[];
  activeProducts: string[];
  entitledTierIds: Set<string>;
  currentProduct: string;
  hasProduct: (productId: string) => boolean;
  getActiveTier: (productId: string) => PlatformProductTier | null;
  subscription: DealerSubscription | null;
  /** Dealer's architecture type — single_store, multi_location, dealer_group, etc. */
  architecture: string | undefined;
  loading: boolean;
  /** Re-fetch the catalog. Used by PlatformCatalogManager after a
   *  super-admin toggles visibility on a product/bundle. */
  refreshCatalog: () => Promise<void>;
}

const PlatformContext = createContext<PlatformContextValue>({
  products: [],
  bundles: [],
  tiers: [],
  activeProducts: [],
  entitledTierIds: new Set(),
  currentProduct: "autocurb",
  hasProduct: () => false,
  getActiveTier: () => null,
  subscription: null,
  architecture: undefined,
  loading: true,
  refreshCatalog: async () => {},
});

export const usePlatform = () => useContext(PlatformContext);

export const PlatformProvider = ({ children }: { children: ReactNode }) => {
  const { tenant } = useTenant();
  const [products, setProducts] = useState<PlatformProduct[]>([]);
  const [bundles, setBundles] = useState<PlatformBundle[]>([]);
  const [tiers, setTiers] = useState<PlatformProductTier[]>([]);
  const [subscription, setSubscription] = useState<DealerSubscription | null>(null);
  const [architecture, setArchitecture] = useState<string | undefined>(undefined);
  const [loading, setLoading] = useState(true);

  const fetchPlatformData = useCallback(async () => {
    try {
      // Fetch products, bundles, tiers, and the dealer subscription in parallel.
      // Tier / visibility column lookups are tolerated-missing so older
      // environments that haven't run the relevant migration yet still
      // render the rest of the app.
      // Architecture query is best-effort — if the table or column
      // doesn't exist yet (pre-migration), swallow the error so the
      // rest of the app still renders.
      const accountQuery = supabase
        .from("dealer_accounts")
        .select("architecture")
        .eq("dealership_id", tenant.dealership_id)
        .maybeSingle()
        .then((res) => res)
        .catch(() => ({ data: null, error: null }));

      const [productsRes, bundlesRes, tiersRes, subRes, accountRes] = await Promise.all([
        supabase
          .from("platform_products")
          .select("id, name, description, icon_name, base_url, is_active, sort_order, is_available_for_new_subs")
          .order("sort_order"),
        supabase
          .from("platform_bundles")
          .select("id, name, description, monthly_price, annual_price, product_ids, is_featured, sort_order, is_enterprise, is_available_for_new_subs")
          .order("sort_order"),
        supabase
          .from("platform_product_tiers" as unknown as "platform_bundles")
          .select("id, product_id, name, description, monthly_price, annual_price, features, inventory_limit, included_with_product_ids, is_introductory, is_active, sort_order, allow_overage, overage_price_per_unit")
          .order("sort_order"),
        supabase
          .from("dealer_subscriptions")
          .select("id, bundle_id, product_ids, tier_ids, status, trial_ends_at, billing_cycle, monthly_amount, rooftop_count")
          .eq("dealership_id", tenant.dealership_id)
          .maybeSingle(),
        accountQuery,
      ]);

      if (productsRes.data) {
        setProducts(productsRes.data as PlatformProduct[]);
      }
      if (bundlesRes.data) {
        setBundles(bundlesRes.data as PlatformBundle[]);
      }
      if (tiersRes.data && !tiersRes.error) {
        setTiers(tiersRes.data as unknown as PlatformProductTier[]);
      }
      if (subRes.data) {
        // Default legacy subscription rows that predate the v2 columns.
        const row = subRes.data as Record<string, unknown>;
        setSubscription({
          ...(row as unknown as DealerSubscription),
          tier_ids: (row.tier_ids as string[]) ?? [],
          rooftop_count: (row.rooftop_count as number) ?? 1,
        });
      }
      if (accountRes?.data) {
        const acct = accountRes.data as Record<string, unknown>;
        setArchitecture((acct.architecture as string) ?? undefined);
      }
    } catch (err) {
      console.error("Failed to fetch platform data:", err);
    } finally {
      setLoading(false);
    }
  }, [tenant.dealership_id]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      await fetchPlatformData();
      void cancelled;
    })();
    return () => { cancelled = true; };
  }, [fetchPlatformData]);

  const entitledTierIds = useMemo(
    () => resolveEntitledTierIds({ subscription, bundles, tiers }),
    [subscription, bundles, tiers],
  );

  const activeProducts = useMemo(() => {
    // Union of: legacy subscription.product_ids, product_ids derived from
    // entitled tiers, and complimentary inclusions (already baked into
    // resolveEntitledTierIds).
    const set = new Set<string>(subscription?.product_ids ?? []);
    for (const id of entitledTierIds) {
      const t = tiers.find((x) => x.id === id);
      if (t) set.add(t.product_id);
    }
    return Array.from(set);
  }, [subscription, entitledTierIds, tiers]);

  const hasProduct = useCallback(
    (productId: string) => {
      if (subscription?.product_ids?.includes(productId)) return true;
      return hasProductAccess(productId, { subscription, bundles, tiers });
    },
    [subscription, bundles, tiers],
  );

  const getActiveTierFor = useCallback(
    (productId: string) => getActiveTier(productId, { subscription, bundles, tiers }),
    [subscription, bundles, tiers],
  );

  return (
    <PlatformContext.Provider
      value={{
        products,
        bundles,
        tiers,
        activeProducts,
        entitledTierIds,
        currentProduct: "autocurb",
        hasProduct,
        getActiveTier: getActiveTierFor,
        subscription,
        architecture,
        loading,
        refreshCatalog: fetchPlatformData,
      }}
    >
      {children}
    </PlatformContext.Provider>
  );
};
