// Hooks that wire the Trade/Sell widget to its host iframe + backend.
//
// Three concerns, kept separate so the flow component stays presentational:
//   1. useTradeWidgetContext()  — parse route + URL params into context
//   2. useFirmOffer(token)      — resolve the customer's existing offer
//   3. useParentFrameSync()     — postMessage contract with embed.js
//
// The postMessage contract is intentionally identical to EmbedLanding /
// TradeIframe so any dealer site already running /public/embed.js gets
// this widget's resize + state-change events with zero changes.

import { useEffect, useMemo, useState } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import type { FirmOffer, TradeWidgetContext, WidgetIntent, WidgetMode } from "./widgetTypes";

/** Parse the route param + query string into a stable widget context. */
export function useTradeWidgetContext(): TradeWidgetContext {
  const { dealershipId } = useParams<{ dealershipId: string }>();
  const [params] = useSearchParams();

  return useMemo(() => {
    const mode = (params.get("mode") === "overlay" ? "overlay" : "inline") as WidgetMode;

    const vehicleLabel = params.get("vehicle_label") || "";
    const vehicleMsrp = Number(params.get("vehicle_msrp")) || 0;
    const onVdp = vehicleLabel.length > 0;

    // Intent precedence: explicit ?intent= wins; otherwise a detected
    // VDP promotes us to "trade" (apply offer toward this car), and the
    // bare floating button defaults to "sell".
    const explicitIntent = params.get("intent");
    const intent: WidgetIntent =
      explicitIntent === "trade" || explicitIntent === "sell"
        ? explicitIntent
        : onVdp
        ? "trade"
        : "sell";

    return {
      dealershipId: dealershipId || "",
      mode,
      intent,
      vdp: onVdp ? { vehicleLabel, vehicleMsrp } : null,
      resumeToken: params.get("t") || "",
      zip: params.get("zip") || "",
    };
  }, [dealershipId, params]);
}

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
          "progress_status, offered_price, estimated_offer_high, bb_tradein_avg, bb_wholesale_avg, vehicle_year, vehicle_make, vehicle_model",
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
      setOffer({ token, amount, status, vehicleLabel: ymm || null });
    })();
    return () => {
      cancelled = true;
    };
  }, [token]);

  return { offer, loading };
}

/**
 * Drive the cross-frame messaging contract with the parent embed.js:
 *   - hartecash-ready   once on mount
 *   - hartecash-resize  on every content height change
 *   - hartecash-close   helper returned for the close button
 *   - hartecash-state-change broadcast whenever the resolved offer changes
 *     (so the floating button copy swaps to "Apply your $X…").
 */
export function useParentFrameSync(opts: {
  dealershipId: string;
  offer: FirmOffer | null;
}): { close: () => void } {
  const { dealershipId, offer } = opts;

  // Resize + ready — identical to EmbedLanding so existing dealer
  // resize listeners keep working untouched.
  useEffect(() => {
    let lastHeight = 0;
    const sendHeight = () => {
      const height = document.documentElement.scrollHeight;
      if (Math.abs(height - lastHeight) < 4) return;
      lastHeight = height;
      window.parent.postMessage({ type: "hartecash-resize", height }, "*");
    };
    sendHeight();
    window.parent.postMessage({ type: "hartecash-ready", dealershipId }, "*");
    const observer = new ResizeObserver(sendHeight);
    observer.observe(document.body);
    const interval = setInterval(sendHeight, 500);
    return () => {
      observer.disconnect();
      clearInterval(interval);
    };
  }, [dealershipId]);

  // Broadcast resolved offer state up to the floating button.
  useEffect(() => {
    if (!offer) return;
    window.parent.postMessage(
      {
        type: "hartecash-state-change",
        token: offer.token,
        status: offer.status,
        offer: offer.amount,
      },
      "*",
    );
  }, [offer]);

  return {
    close: () => window.parent.postMessage({ type: "hartecash-close" }, "*"),
  };
}
