// WidgetTrade — iframe host for the watered-down Trade/Sell slide-out.
//
// Mounted at /widget/:dealershipId. This is the lean sibling of
// EmbedLanding (/embed/:dealershipId): same embed plumbing (resize /
// ready / close / state-change postMessage, sessionStorage embed
// context) but it renders the stripped-down TradeWidgetFlow instead of
// the dealer's full landing template — and leads with the VDP trade-in
// banner when the customer is looking at a specific car.
//
// The parent /public/embed.js opens this URL inside the drawer overlay
// it already provides, passing detected vehicle context + any resume
// token as query params. See src/components/widget/README.md.
//
// URL params (superset shared with EmbedLanding):
//   ?mode=inline|overlay      chrome behavior (close button in overlay)
//   ?t=<submission_token>      resume an existing offer ("follow me")
//   ?vehicle_label=...         VDP vehicle the customer is viewing
//   ?vehicle_msrp=<number>     VDP sticker price (for effective-price math)
//   ?intent=trade|sell         force intent (else VDP ⇒ trade, bare ⇒ sell)
//   ?zip=<zip>                 customer ZIP (state tax credit)

import { useEffect } from "react";
import { X } from "lucide-react";
import TradeWidgetFlow from "@/components/widget/TradeWidgetFlow";
import TradeInBanner from "@/components/widget/TradeInBanner";
import {
  useFirmOffer,
  useParentFrameSync,
  useTradeWidgetContext,
} from "@/components/widget/useTradeWidget";

export default function WidgetTrade() {
  const ctx = useTradeWidgetContext();
  const { offer } = useFirmOffer(ctx.resumeToken);
  const { close } = useParentFrameSync({ dealershipId: ctx.dealershipId, offer });

  // Stash embed attribution for the submission insert, exactly like
  // EmbedLanding — so the lead is tagged inventory_embed and carries the
  // VDP vehicle the customer was on. SellFlow children read these without
  // prop-drilling. Cleared automatically when the tab closes.
  useEffect(() => {
    try {
      sessionStorage.setItem("__embed_lead_source", "inventory_embed");
      if (ctx.vdp?.vehicleLabel) {
        sessionStorage.setItem("__embed_vehicle_label", ctx.vdp.vehicleLabel);
      } else {
        sessionStorage.removeItem("__embed_vehicle_label");
      }
      if (ctx.vdp && ctx.vdp.vehicleMsrp > 0) {
        sessionStorage.setItem("__embed_vehicle_msrp", String(ctx.vdp.vehicleMsrp));
      } else {
        sessionStorage.removeItem("__embed_vehicle_msrp");
      }
    } catch {
      /* Safari private mode — submission falls back to default source. */
    }
  }, [ctx.vdp]);

  return (
    <div className="min-h-screen bg-white">
      {ctx.mode === "overlay" && (
        <button
          type="button"
          onClick={close}
          aria-label="Close"
          className="fixed right-4 top-4 z-50 inline-flex h-10 w-10 items-center justify-center rounded-full border border-zinc-200 bg-white/95 shadow-md backdrop-blur transition-colors hover:bg-zinc-50"
        >
          <X className="h-4 w-4 text-zinc-700" aria-hidden="true" />
        </button>
      )}

      {ctx.vdp && <TradeInBanner vdp={ctx.vdp} offer={offer} zip={ctx.zip} />}

      <TradeWidgetFlow initialIntent={ctx.intent} resolvedOffer={offer} />
    </div>
  );
}
