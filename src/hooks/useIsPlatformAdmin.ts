import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

/**
 * Server-driven check for cross-tenant super-admin powers.
 *
 * Source of truth: `public.is_platform_admin(auth.uid())` — a SECURITY
 * DEFINER function that today reads the new `is_platform_admin` boolean
 * column on user_roles (added in 20260503190000_tier1_platform_admin_boolean.sql),
 * with a transitional fallback to the legacy `dealership_id = 'default'`
 * convention.
 *
 * Replaces the previous client-side derivation
 * (`tenant.dealership_id === "default" && userRole === "admin"`), which
 * was vulnerable to a single bad insert silently granting platform-admin
 * to a regular dealer if their user_roles row defaulted to dealership_id
 * 'default'. The new column is enforced by:
 *   - is_platform_admin = true REQUIRES role = 'admin' (CHECK constraint)
 *   - At most one is_platform_admin = true row per user_id (partial UNIQUE)
 *
 * This hook does *not* answer "am I currently viewing the platform tenant?"
 * — that's a tenant-view question, still answered by tenant.dealership_id
 * === "default" inside the TenantContext. A super-admin who is "viewing as"
 * Hartford should still get isPlatformAdmin=true here (their identity
 * hasn't changed) but tenant.dealership_id will be Hartford's, so feature
 * gates that depend on "the current view is the home tenant" continue to
 * work without modification.
 */
export function useIsPlatformAdmin(): {
  isPlatformAdmin: boolean;
  loading: boolean;
} {
  const { data, isLoading } = useQuery({
    queryKey: ["is_platform_admin"],
    queryFn: async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session?.user?.id) return false;
      const { data, error } = await supabase.rpc("is_platform_admin", {
        _user_id: session.user.id,
      });
      if (error) {
        console.error("useIsPlatformAdmin RPC error:", error);
        return false;
      }
      return data === true;
    },
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  });
  return { isPlatformAdmin: data ?? false, loading: isLoading };
}
