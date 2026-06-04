// TradeWidget — the watered-down MotoAcquire-style trade/sell body.
//
// Presentational container rendered by EmbedLanding when the embed is
// opened with ?template=widget. EmbedLanding owns the iframe plumbing
// (resize / ready / state-change postMessage + sessionStorage embed
// attribution); this component owns the branded slide-out chrome
// (dealer logo header + close ×) and the lean flow.
//
// Slide-out geometry (right-side panel, ~1/3 width, dim backdrop that
// preserves page context) is provided by the parent /public/embed.js
// drawer — this renders the panel CONTENTS.

import { X } from "lucide-react";
import { useSiteConfig } from "@/hooks/useSiteConfig";
import { tenantLogoSrc } from "@/lib/tenantLogo";
import TradeInBanner from "./TradeInBanner";
import TradeWidgetFlow from "./TradeWidgetFlow";
import { useFirmOffer } from "./useTradeWidget";
import type { VdpContext, WidgetIntent } from "./widgetTypes";

export default function TradeWidget({
  intent,
  vdp,
  resumeToken,
  zip,
}: {
  intent: WidgetIntent;
  vdp: VdpContext | null;
  resumeToken: string;
  zip: string;
}) {
  const { config } = useSiteConfig();
  const { offer } = useFirmOffer(resumeToken);

  const dealerName = (config.dealership_name || "").trim();
  const logo = tenantLogoSrc(config);

  return (
    <div className="flex min-h-screen flex-col bg-zinc-50">
      {/* Branded panel header — sticky, like the MotoAcquire slide-out. */}
      <header className="sticky top-0 z-20 flex items-center justify-between border-b border-zinc-200 bg-white px-4 py-3">
        {logo ? (
          <img src={logo} alt={dealerName || "Dealer"} className="h-8 w-auto object-contain" />
        ) : (
          <span className="text-sm font-bold tracking-tight text-zinc-900">
            {dealerName || "Value My Trade"}
          </span>
        )}
        <button
          type="button"
          onClick={() => window.parent.postMessage({ type: "hartecash-close" }, "*")}
          aria-label="Close"
          className="inline-flex h-8 w-8 items-center justify-center rounded-full text-zinc-500 transition-colors hover:bg-zinc-100 hover:text-zinc-700"
        >
          <X className="h-4 w-4" aria-hidden="true" />
        </button>
      </header>

      {vdp && <TradeInBanner vdp={vdp} offer={offer} zip={zip} />}

      <div className="flex-1">
        <TradeWidgetFlow initialIntent={intent} resolvedOffer={offer} />
      </div>
    </div>
  );
}
