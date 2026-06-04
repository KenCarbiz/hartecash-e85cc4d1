// TradeWidget — the watered-down trade/sell experience body.
//
// Presentational container rendered by EmbedLanding when the embed is
// opened with ?template=widget (the lean alternative to the dealer's
// full landing template). EmbedLanding owns the iframe plumbing
// (resize / ready / close / state-change postMessage + sessionStorage
// embed attribution), so this component is display-only: it resolves
// the customer's existing firm offer for display and renders the VDP
// trade-in banner + the lean stepper.
//
// Surface decision (per Ken): extend /embed rather than a parallel
// /widget route — one embed surface, one set of plumbing.

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
  const { offer } = useFirmOffer(resumeToken);

  return (
    <>
      {vdp && <TradeInBanner vdp={vdp} offer={offer} zip={zip} />}
      <TradeWidgetFlow initialIntent={intent} resolvedOffer={offer} />
    </>
  );
}
