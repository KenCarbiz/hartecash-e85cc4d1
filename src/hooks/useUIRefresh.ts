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
 */
export const useUIRefresh = (): boolean => {
  const { tenant } = useTenant();
  const dealershipId = tenant.dealership_id;

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

  return Boolean(data);
};
