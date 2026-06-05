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

import { Clock, ArrowRight } from "lucide-react";
import MotoCard from "@/components/moto/MotoCard";
import MotoPrimaryButton from "@/components/moto/MotoPrimaryButton";
import type { FirmOffer, VdpContext } from "./widgetTypes";

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
  guaranteeDays,
  onStartNew,
}: {
  offer: FirmOffer;
  vdp: VdpContext | null;
  guaranteeDays: number;
  onStartNew: () => void;
}) {
  const left = daysLeft(offer.madeAt, guaranteeDays);
  const vehicle = offer.vehicleLabel || "your vehicle";

  return (
    <div className="mx-auto w-full max-w-[420px] px-4 py-5">
      <MotoCard>
        <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Welcome back</p>
        <p className="mt-1 text-sm text-zinc-600">
          You have a locked-in offer for {vehicle}.
        </p>
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
              <MotoPrimaryButton>
                Apply toward this {vdp.vehicleLabel}
              </MotoPrimaryButton>
              <button
                type="button"
                className="text-center text-sm font-medium text-zinc-500 hover:underline"
              >
                Use it toward a different vehicle
              </button>
            </>
          ) : (
            <MotoPrimaryButton>Continue with this offer</MotoPrimaryButton>
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
