// Offer resolution for the embeddable Trade/Sell widget.
//
// The widget body (TradeWidget) is rendered INSIDE EmbedLanding, which
// already owns the iframe plumbing (resize / ready / close /
// state-change postMessage) and the URL-param parsing. So all this hook
// needs to do is resolve the customer's existing firm offer for display.

import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { FirmOffer } from "./widgetTypes";

/**
 * Resolve the customer's existing firm offer from a resume token.
 * Mirrors EmbedLanding's offer-resolution select so the "follow the
 * customer" behavior is consistent across both embed surfaces.
 *
 * Returns null until a token is present and the row loads.
 */
export function useFirmOffer(token: string): { offer: FirmOffer | null; loading: boolean } {
  const [offer, setOffer] = useState<FirmOffer | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!token) {
      setOffer(null);
      return;
    }
    let cancelled = false;
    setLoading(true);
    (async () => {
       
      const { data } = await (supabase
        .from("submissions")
        .select(
          "progress_status, offered_price, estimated_offer_high, bb_tradein_avg, bb_wholesale_avg, vehicle_year, vehicle_make, vehicle_model, offer_made_at, created_at",
        )
        .eq("token", token)
        .maybeSingle() as any);
      if (cancelled) return;
      setLoading(false);
      if (!data) {
        setOffer(null);
        return;
      }
      const amount =
        Number(data.offered_price) ||
        Number(data.estimated_offer_high) ||
        Number(data.bb_tradein_avg) ||
        Number(data.bb_wholesale_avg) ||
        0;
      const status: FirmOffer["status"] =
        data.progress_status === "deal_accepted" || data.progress_status === "scheduled"
          ? "deal_accepted"
          : amount > 0
          ? "offer_made"
          : "in_progress";
      const ymm = [data.vehicle_year, data.vehicle_make, data.vehicle_model]
        .filter(Boolean)
        .join(" ")
        .trim();
      setOffer({
        token,
        amount,
        status,
        vehicleLabel: ymm || null,
        madeAt: data.offer_made_at || data.created_at || null,
      });
    })();
    return () => {
      cancelled = true;
    };
  }, [token]);

  return { offer, loading };
}
