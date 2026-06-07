// VDP trade-in banner — the "follow the customer onto the car they're
// looking at" moment. Shown at the top of the widget when:
//   (a) the embed engine detected a VDP vehicle, AND
//   (b) the customer already has a firm offer.
//
// It reframes their cash offer as a TRADE value (cash + state tax
// credit) applied against the vehicle they're viewing, and shows the
// resulting effective price. This is the lean cousin of EmbedLanding's
// InventoryAwareBanner — same math (calcTradeInValue / getTaxRateFromZip),
// stripped of the full-template chrome.

import { TrendingUp } from "lucide-react";
import { calcTradeInValue, getTaxRateFromZip } from "@/lib/salesTax";
import type { FirmOffer, VdpContext } from "./widgetTypes";

const usd = (n: number) => `$${Math.round(n).toLocaleString("en-US")}`;

export default function TradeInBanner({
  vdp,
  offer,
  zip,
}: {
  vdp: VdpContext;
  offer: FirmOffer | null;
  zip: string;
}) {
  // Rate is driven by the customer's ZIP and the price of the vehicle being
  // viewed (CT: 6.35% ≤ $50k, 7.75% > $50k). Fall back to CT rates with the
  // same threshold when the ZIP isn't known yet (default dealer market).
  const { state, rate: zipRate } = getTaxRateFromZip(zip, vdp.vehicleMsrp);
  const rate = state ? zipRate : vdp.vehicleMsrp > 50000 ? 0.0775 : 0.0635;

  // No offer yet → soft prompt to get one; the flow below starts from
  // VIN entry and the value lands on this vehicle once computed.
  if (!offer || offer.amount <= 0) {
    return (
      <section className="bg-zinc-900 px-5 py-3 text-white">
        <p className="text-sm leading-tight">
          <span className="font-semibold">Looking at the {vdp.vehicleLabel}?</span>{" "}
          <span className="text-white/70">
            Get your trade value first — it applies straight to this vehicle.
          </span>
        </p>
      </section>
    );
  }

  const tradeValue = calcTradeInValue(offer.amount, rate);
  const taxCredit = offer.amount * rate;
  const effectivePrice =
    vdp.vehicleMsrp > 0 ? Math.max(0, vdp.vehicleMsrp - tradeValue) : 0;

  return (
    <section className="bg-gradient-to-br from-emerald-600 to-emerald-700 px-5 py-4 text-white">
      <p className="mb-1 inline-flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.2em] text-white/70">
        <TrendingUp className="h-3 w-3" aria-hidden="true" />
        Apply your trade
      </p>
      <p className="text-base font-semibold leading-tight">Toward this {vdp.vehicleLabel}</p>

      <div className="mt-3 grid grid-cols-2 gap-3">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-white/70">
            Your trade value
          </p>
          <p className="text-2xl font-bold leading-tight tabular-nums">{usd(tradeValue)}</p>
          <p className="text-[10px] text-white/70">
            includes {usd(taxCredit)} tax credit{state ? ` (${state})` : ""}
          </p>
        </div>
        {vdp.vehicleMsrp > 0 && (
          <div className="text-right">
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-white/70">
              Effective price
            </p>
            <p className="text-2xl font-bold leading-tight tabular-nums">{usd(effectivePrice)}</p>
            <p className="text-[10px] text-white/70">
              {usd(vdp.vehicleMsrp)} − {usd(tradeValue)} trade
            </p>
          </div>
        )}
      </div>
    </section>
  );
}
