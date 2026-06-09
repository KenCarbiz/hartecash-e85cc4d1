/**
 * Analytics row fetch for the V2 Analytics surface.
 *
 * Pulls the columns needed for funnel / source / cohort / store
 * analysis across the whole book of business (paged, capped), scoped
 * exactly like useAdminDashboard.fetchSubmissions — by dealership, plus
 * the sales_bdc per-rep restriction. This mirrors the existing
 * client-side reporting components (ReportsExport / ExecutiveKPIHub),
 * which also read full submission sets directly.
 *
 * Capped at MAX_ROWS to bound payload; the surface notes when the cap is
 * hit. A future get_admin_analytics RPC can replace this with exact
 * server-side aggregates (see docs/admin-v2/implementation-plan.md).
 */
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type AnalyticsRow = {
  progress_status: string;
  offered_price: number | null;
  created_at: string;
  lead_source: string | null;
  store_location_id: string | null;
};

const PAGE = 1000;
const MAX_ROWS = 8000;
const COLS = "progress_status, offered_price, created_at, lead_source, store_location_id";

const repCodeFor = (userRole: string, userEmail?: string): string | null =>
  userRole === "sales_bdc" && userEmail
    ? userEmail.split("@")[0].toLowerCase().replace(/[^a-z0-9]/g, "")
    : null;

export type AnalyticsData = { rows: AnalyticsRow[]; capped: boolean };

export function useAnalyticsData(
  dealershipId: string | undefined,
  userRole: string,
  userEmail?: string,
) {
  const repCode = repCodeFor(userRole, userEmail);

  return useQuery<AnalyticsData>({
    queryKey: ["v2-analytics-rows", dealershipId, repCode],
    enabled: !!dealershipId,
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const rows: AnalyticsRow[] = [];
      for (let page = 0; page * PAGE < MAX_ROWS; page++) {
        let q = supabase
          .from("submissions")
          .select(COLS)
          .eq("dealership_id", dealershipId as string)
          .order("created_at", { ascending: false })
          .range(page * PAGE, page * PAGE + PAGE - 1);
        if (repCode) q = q.eq("assigned_rep_email", repCode);
        const { data, error } = await q;
        if (error) throw error;
        const batch = (data || []) as unknown as AnalyticsRow[];
        rows.push(...batch);
        if (batch.length < PAGE) return { rows, capped: false };
      }
      return { rows, capped: true };
    },
  });
}
