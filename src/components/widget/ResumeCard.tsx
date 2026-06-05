// ResumeCard — returning-customer welcome shown when the embed resolves
// an existing locked-in offer (the customer already got a number on a
// prior visit). Two things matter here:
//
//   1. Continuity of intent — "do you still want to apply this toward a
//      trade?" and, on a VDP, "toward THIS vehicle or a different one?"
//   2. Urgency — how much time is left on the locked-in offer
//      (price_guarantee_days from when the offer was made).
//
// Choosing "Start a new appraisal" drops them into the fresh flow.

import { useState } from "react";
import { Clock, ArrowRight, Check } from "lucide-react";
import MotoCard from "@/components/moto/MotoCard";
import MotoPrimaryButton from "@/components/moto/MotoPrimaryButton";
import { markApplied } from "./widgetData";
import type { FirmOffer, VdpContext, WidgetIntent } from "./widgetTypes";

const usd = (n: number) => `$${Math.round(n).toLocaleString("en-US")}`;

/** Whole days left on the locked-in offer (clamped at 0). */
function daysLeft(madeAt: string | null, guaranteeDays: number): number | null {
  if (!madeAt) return null;
  const made = new Date(madeAt).getTime();
  if (Number.isNaN(made)) return null;
  const elapsedDays = (Date.now() - made) / 86_400_000;
  return Math.max(0, Math.ceil(guaranteeDays - elapsedDays));
}

export default function ResumeCard({
  offer,
  vdp,
  intent,
  guaranteeDays,
  onStartNew,
}: {
  offer: FirmOffer;
  vdp: VdpContext | null;
  intent: WidgetIntent;
  guaranteeDays: number;
  onStartNew: () => void;
}) {
  const [accepted, setAccepted] = useState(false);
  const [busy, setBusy] = useState(false);
  const left = daysLeft(offer.madeAt, guaranteeDays);
  const vehicle = offer.vehicleLabel || "your vehicle";

  // Apply the existing offer — records the (possibly new) VDP target and
  // tells the parent so the floating button flips to the accepted state.
  const apply = async (target: VdpContext | null) => {
    setBusy(true);
    await markApplied(offer.token, intent, target);
    try {
      window.parent.postMessage(
        { type: "hartecash-state-change", token: offer.token, status: "deal_accepted", offer: offer.amount },
        "*",
      );
    } catch {
      /* not in an iframe — ignore */
    }
    setBusy(false);
    setAccepted(true);
  };

  if (accepted) {
    return (
      <div className="mx-auto w-full max-w-[420px] px-4 py-5">
        <MotoCard title="You're all set">
          <div className="mb-2 inline-flex h-10 w-10 items-center justify-center rounded-full bg-[hsl(var(--cta-offer)/0.12)]">
            <Check className="h-5 w-5 text-[hsl(var(--cta-offer))]" aria-hidden="true" />
          </div>
          <p className="text-sm text-zinc-600">
            Your {usd(offer.amount)} offer is saved
            {vdp ? ` toward the ${vdp.vehicleLabel}` : ""}. A specialist will reach out to finalize.
          </p>
        </MotoCard>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-[420px] px-4 py-5">
      <MotoCard>
        <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Welcome back</p>
        <p className="mt-1 text-sm text-zinc-600">You have a locked-in offer for {vehicle}.</p>
        <p className="mt-2 text-4xl font-bold tabular-nums text-zinc-900">{usd(offer.amount)}</p>

        {left != null && (
          <p className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-700">
            <Clock className="h-3.5 w-3.5" aria-hidden="true" />
            {left === 0 ? "Expires today" : `${left} day${left === 1 ? "" : "s"} left to lock it in`}
          </p>
        )}

        <div className="mt-4 grid gap-2">
          {/* On a VDP, the primary action is applying toward the car they're
              looking at; the secondary keeps the trade generic. */}
          {vdp ? (
            <>
              <MotoPrimaryButton loading={busy} onClick={() => apply(vdp)}>
                Apply toward this {vdp.vehicleLabel}
              </MotoPrimaryButton>
              <button
                type="button"
                disabled={busy}
                onClick={() => apply(null)}
                className="text-center text-sm font-medium text-zinc-500 hover:underline disabled:opacity-50"
              >
                Use it toward a different vehicle
              </button>
            </>
          ) : (
            <MotoPrimaryButton loading={busy} onClick={() => apply(null)}>
              Continue with this offer
            </MotoPrimaryButton>
          )}

          <button
            type="button"
            onClick={onStartNew}
            className="mt-1 inline-flex items-center justify-center gap-1 text-center text-sm font-medium text-[hsl(var(--cta-offer))] hover:underline"
          >
            Start a new appraisal <ArrowRight className="h-3.5 w-3.5" />
          </button>
        </div>
      </MotoCard>
    </div>
  );
}
