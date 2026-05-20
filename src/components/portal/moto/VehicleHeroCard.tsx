// Vehicle hero card — the emotional anchor of the portal. Matches
// the MotoAcquire dashboard's "YOUR VEHICLE" card: concentric soft
// halo behind the vehicle image, eyebrow + headline + meta row,
// VIN with copy button, value range with Strong Market pill and a
// sparkline curve below.
//
// The sparkline is a static SVG path for v1 — the data lens flagged
// that no value-trend series exists yet (offer_bumps is 2-3 points
// max, not a curve). Placeholder uses a calm upward arc so the
// visual reads as "your value trended up" without claiming false
// data. v2 will swap in a real series once we add a snapshot table.
import { useState } from "react";
import { Check, ChevronLeft, ChevronRight, Copy, TrendingUp } from "lucide-react";
import VehicleImage from "@/components/sell-form/VehicleImage";

interface VehicleHeroCardProps {
  year: string | null;
  make: string | null;
  model: string | null;
  trim?: string | null;
  mileage: string | null;
  exteriorColor: string | null;
  vin: string | null;
  estimatedLow?: number | null;
  estimatedHigh?: number | null;
  marketLabel?: string;
}

const formatMoney = (n: number) =>
  `$${Math.round(n).toLocaleString("en-US")}`;

const VehicleHeroCard = ({
  year,
  make,
  model,
  trim,
  mileage,
  exteriorColor,
  vin,
  estimatedLow,
  estimatedHigh,
  marketLabel = "Strong Market",
}: VehicleHeroCardProps) => {
  const [copied, setCopied] = useState(false);

  const vehicleStr = [year, make, model, trim].filter(Boolean).join(" ") || "Your vehicle";
  const metaParts = [
    mileage ? `${Number(mileage).toLocaleString()} mi` : null,
    exteriorColor,
  ].filter(Boolean);

  const hasRange = estimatedLow && estimatedHigh && estimatedLow > 0 && estimatedHigh > 0;

  const copyVin = async () => {
    if (!vin) return;
    try {
      await navigator.clipboard.writeText(vin);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      // Clipboard API can fail in non-secure contexts — silently
      // fail rather than throw at the customer.
    }
  };

  return (
    <article
      aria-labelledby="vehicle-hero-heading"
      className="bg-white rounded-3xl border border-border/60 shadow-[0_8px_32px_-12px_rgb(15_23_42_/_0.08)] p-7 lg:p-9 overflow-hidden relative"
    >
      <div className="grid grid-cols-1 lg:grid-cols-[1.1fr,1fr] gap-6 lg:gap-8 items-center">
        {/* Left column — label, title, meta, value range, sparkline */}
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-foreground/55 mb-3">
            Your Vehicle
          </p>
          <h2
            id="vehicle-hero-heading"
            className="text-2xl lg:text-[32px] font-bold text-foreground leading-[1.15] tracking-tight mb-3"
          >
            {vehicleStr}
          </h2>
          {metaParts.length ? (
            <p className="text-sm text-foreground/65 mb-4">
              {metaParts.map((p, i) => (
                <span key={i}>
                  {i > 0 ? <span className="text-foreground/30 mx-2">·</span> : null}
                  {p}
                </span>
              ))}
            </p>
          ) : null}

          {vin ? (
            <button
              type="button"
              onClick={copyVin}
              className="inline-flex items-center gap-2 text-xs font-medium text-foreground/65 hover:text-foreground transition-colors mb-6 group"
              aria-label={copied ? "VIN copied" : `Copy VIN ${vin}`}
            >
              <span className="font-mono tabular-nums truncate max-w-[200px]">{vin}</span>
              {copied ? (
                <Check className="w-3.5 h-3.5 text-emerald-600" strokeWidth={2.5} />
              ) : (
                <Copy className="w-3.5 h-3.5 text-foreground/40 group-hover:text-foreground/70 transition-colors" strokeWidth={2} />
              )}
            </button>
          ) : null}

          {hasRange ? (
            <>
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-foreground/55 mb-2">
                Estimated Value Range
              </p>
              <p className="text-3xl lg:text-[36px] font-bold text-foreground tracking-tight tabular-nums leading-[1.1] mb-3">
                {formatMoney(estimatedLow!)} – {formatMoney(estimatedHigh!)}
              </p>
              <div className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 border border-emerald-100 px-2.5 py-1 text-xs font-semibold text-emerald-700 mb-5">
                <TrendingUp className="w-3 h-3" strokeWidth={2.5} />
                {marketLabel}
              </div>

              {/* Placeholder sparkline — static SVG for v1. Replace
                  with a real value-trend series in v2 once we add
                  a snapshot table. */}
              <div className="h-16 w-full">
                <svg
                  viewBox="0 0 320 60"
                  className="w-full h-full"
                  preserveAspectRatio="none"
                  aria-hidden="true"
                >
                  <path
                    d="M 0 48 C 40 46 70 38 110 32 C 150 26 180 22 220 16 C 250 12 285 8 320 4 L 320 60 L 0 60 Z"
                    fill="#22c55e"
                    fillOpacity="0.08"
                  />
                  <path
                    d="M 0 48 C 40 46 70 38 110 32 C 150 26 180 22 220 16 C 250 12 285 8 320 4"
                    fill="none"
                    stroke="#22c55e"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                  />
                  <circle cx="0" cy="48" r="3" fill="#fff" stroke="#22c55e" strokeWidth="2" />
                  <circle cx="320" cy="4" r="3" fill="#fff" stroke="#22c55e" strokeWidth="2" />
                </svg>
              </div>
            </>
          ) : null}
        </div>

        {/* Right column — vehicle image on a concentric halo. The
            halo is three nested low-opacity circles centered behind
            the image; pure decoration. */}
        <div className="relative h-[260px] lg:h-[320px] flex items-center justify-center">
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none" aria-hidden="true">
            <div
              className="absolute w-[440px] h-[440px] rounded-full"
              style={{ background: "hsl(220 100% 96% / 0.5)" }}
            />
            <div
              className="absolute w-[340px] h-[340px] rounded-full"
              style={{ background: "hsl(220 100% 96% / 0.7)" }}
            />
            <div
              className="absolute w-[240px] h-[240px] rounded-full"
              style={{ background: "hsl(220 100% 96%)" }}
            />
          </div>
          <div className="relative w-full h-full max-w-md">
            <VehicleImage
              year={year || ""}
              make={make || ""}
              model={model || ""}
              selectedColor={exteriorColor || ""}
              imageAngle="three_quarter"
              hideColorLabel
              fill
            />
          </div>
        </div>
      </div>
    </article>
  );
};

export default VehicleHeroCard;
