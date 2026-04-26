import { createContext, createElement, useContext, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useTenant } from "@/contexts/TenantContext";

/**
 * Per-tenant kill switch for the refreshed admin UI.
 *
 * This intentionally reads the single flag directly instead of piggybacking
 * on useSiteConfig's longer-lived cache, so platform-admin data flips are
 * picked up on mount/focus without waiting for the full site config cache to
 * expire.
 *
 * When wrapped in <UIRefreshOverrideProvider value={true}>, the hook returns
 * the override unconditionally — used by the /admin2 bypass route to render
 * the refreshed UI regardless of database state.
 */

const UIRefreshOverrideContext = createContext<boolean | null>(null);

/**
 * Forces every consumer of useUIRefresh() inside the subtree to a fixed
 * boolean (true = always refreshed, false = always legacy). Bypasses the
 * site_config flag entirely. Intended for the /admin2 preview route and
 * for tests; do NOT use in the main admin shell.
 */
export const UIRefreshOverrideProvider = ({
  value,
  children,
}: {
  value: boolean;
  children: ReactNode;
}) =>
  createElement(UIRefreshOverrideContext.Provider, { value }, children);

export const useUIRefresh = (): boolean => {
  const override = useContext(UIRefreshOverrideContext);
  const { tenant } = useTenant();
  const dealershipId = tenant.dealership_id;

  // Always run the query — even when overridden — so React's hook order
  // stays consistent across renders. The result is just ignored when an
  // override is active.
  const { data } = useQuery({
    queryKey: ["ui_refresh_enabled", dealershipId],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("site_config")
        .select("ui_refresh_enabled")
        .eq("dealership_id", dealershipId)
        .maybeSingle();

      if (error) throw error;
      return Boolean(data?.ui_refresh_enabled);
    },
    staleTime: 0,
    gcTime: 5 * 60 * 1000,
    refetchOnMount: "always",
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
  });

  if (override !== null) return override;
  return Boolean(data);
};
