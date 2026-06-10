/**
 * Exact, full-book Command Center KPIs via the get_admin_kpis RPC.
 *
 * Progressive enhancement: if the RPC isn't deployed yet (the migration
 * is applied manually — see CLAUDE.md), this returns `data: undefined`
 * and the Command Center falls back to its loaded-page snapshot. Once
 * the function exists, the headline tiles, trend, and status
 * distribution become exact with no other code change.
 *
 * Scoping mirrors useAdminDashboard.fetchSubmissions exactly: by
 * dealership, plus the per-rep restriction for the sales_bdc role.
 */
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type AdminKpis = {
  total_leads: number;
  active_deals: number;
  pipeline_value: number;
  accepted: number;
  conversion_pct: number;
  appraiser_queue: number;
  by_status: { status: string; n: number }[];
  trend: { date: string; leads: number }[];
};

/** Replicates the sales_bdc rep-code derivation used for lead scoping. */
const repCodeFor = (userRole: string, userEmail?: string): string | null => {
  if (userRole === "sales_bdc" && userEmail) {
    return userEmail.split("@")[0].toLowerCase().replace(/[^a-z0-9]/g, "");
  }
  return null;
};

export function useAdminKpis(dealershipId: string | undefined, userRole: string, userEmail?: string) {
  const repCode = repCodeFor(userRole, userEmail);

  return useQuery<AdminKpis>({
    queryKey: ["admin-kpis", dealershipId, repCode],
    enabled: !!dealershipId,
    retry: false, // a missing RPC (pre-migration) shouldn't retry-spam
    staleTime: 60_000,
    queryFn: async () => {
      const rpc = supabase.rpc as unknown as (
        fn: string,
        args: Record<string, unknown>,
      ) => Promise<{ data: unknown; error: { message: string } | null }>;
      const { data, error } = await rpc("get_admin_kpis", {
        p_dealership_id: dealershipId,
        p_assigned_rep_email: repCode,
      });
      if (error) throw error;
      return data as AdminKpis;
    },
  });
}
