import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export type TriggerMoment = "pre_acceptance" | "post_acceptance";
export type InventoryScope = "all" | "new_only" | "used_only" | "certified_only";

export interface TradeUpIncentive {
  id: string;
  dealership_id: string;
  trigger_moment: TriggerMoment;
  headline: string;
  description: string | null;
  bonus_amount: number;
  inventory_scope: InventoryScope;
  inventory_price_floor: number | null;
  inventory_price_ceiling: number | null;
  inventory_url: string | null;
  is_active: boolean;
  active_until: string | null;
  disclaimer: string | null;
  sort_order: number;
}

/**
 * Per-dealer trade-up incentive config. Two trigger moments:
 *
 *   pre_acceptance  — shown on the OfferPage + decline-winback emails
 *                     as a "trade us your car, take an extra $X off
 *                     any vehicle" reason to accept.
 *   post_acceptance — shown on the DealAccepted page + acceptance
 *                     email as a sweetener ("your offer goes up $X
 *                     if you take a vehicle today").
 *
 * Both can be active simultaneously with different amounts.
 *
 * Soft-falls-back to an empty list when the migration hasn't been
 * applied yet — the offer/acceptance pages just render without the
 * incentive block.
 */
export const useTradeUpIncentives = (
  dealershipId: string | null | undefined,
  moment?: TriggerMoment,
) => {
  const [incentives, setIncentives] = useState<TradeUpIncentive[]>([]);
  const [loading, setLoading] = useState(true);
  const [missing, setMissing] = useState(false);

  useEffect(() => {
    if (!dealershipId) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    (async () => {
      setLoading(true);
      let q = supabase
        .from("trade_up_incentives" as never)
        .select("*")
        .eq("dealership_id", dealershipId)
        .eq("is_active", true)
        .order("sort_order");
      const { data, error } = await q;
      if (cancelled) return;
      if (error) {
        const msg = error.message?.toLowerCase() || "";
        if (msg.includes("does not exist") || msg.includes("schema cache")) {
          setMissing(true);
          setLoading(false);
          return;
        }
      }
      let rows = ((data as unknown as TradeUpIncentive[]) || [])
        .filter((r) => !r.active_until || new Date(r.active_until) > new Date());
      if (moment) rows = rows.filter((r) => r.trigger_moment === moment);
      setIncentives(rows);
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [dealershipId, moment]);

  return { incentives, loading, missing };
};
