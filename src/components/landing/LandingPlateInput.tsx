import { useState, type FormEvent } from "react";
import { ArrowRight, Loader2 } from "lucide-react";

const STATES = [
  "AL", "AK", "AZ", "AR", "CA", "CO", "CT", "DE", "FL", "GA",
  "HI", "ID", "IL", "IN", "IA", "KS", "KY", "LA", "ME", "MD",
  "MA", "MI", "MN", "MS", "MO", "MT", "NE", "NV", "NH", "NJ",
  "NM", "NY", "NC", "ND", "OH", "OK", "OR", "PA", "RI", "SC",
  "SD", "TN", "TX", "UT", "VT", "VA", "WA", "WV", "WI", "WY",
];

/** What the landing input emits. Either a plate+state pair OR a VIN —
 *  never both. The downstream wizard branches on which keys are
 *  present and runs the appropriate Black Book lookup. */
export type LandingPlateInputValue =
  | { plate: string; state: string; vin?: undefined }
  | { vin: string; plate?: undefined; state?: undefined };

interface Props {
  /** Fired with the entered plate+state OR VIN when the customer
   *  engages. Templates open the FullscreenWizard from this callback. */
  onEngage: (value: LandingPlateInputValue) => void;
  /** Visual variant. Tier C (Apple/Porsche white) is default. */
  theme?: "light" | "dark" | "warm";
  /** Override default state. Useful for IP-geo defaulting. */
  defaultState?: string;
  /** Optional CTA copy override. Defaults to "Get my offer". */
  ctaLabel?: string;
  /** Optional CTA background color override (hex). When omitted the
   *  cluster uses the SaaS-grade saturated yellow #FACC15. */
  ctaColor?: string;
  /** Optional inline trust line shown directly under the card. */
  trustLine?: string;
  /** Which lookup tab opens by default. */
  defaultLookup?: "plate" | "vin";
}

/**
 * Landing plate / VIN cluster — the single most important interaction
 * on the customer landing. Designed against the visual language of
 * the three national sell-flow brands (CarMax Max Offer, Carvana
 * Sell-Us-Your-Car, CarGurus Sell My Car):
 *
 *   1. ONE unified card containing the entire cluster (toggle + input
 *      row + CTA + trust line). Soft shadow + 1px hairline border so
 *      the cluster reads as a single elevated surface rather than a
 *      collection of floating inputs.
 *   2. Plate + State merged into a single bordered pill — state sits
 *      flush against the plate field separated by a hairline divider,
 *      not floating with a gap. Carvana / CarMax pattern.
 *   3. Inline yellow CTA at the right end of the row on desktop.
 *      Yellow (#FFC72C — calibrated for AA against black copy) is
 *      the universal sell-flow conversion accent. Mobile collapses
 *      the CTA to a full-width button under the input row.
 *   4. Plate / VIN segmented control sits ABOVE the input row in a
 *      compact pill so the customer's eye lands on lookup type → input
 *      → submit, top-to-bottom.
 *   5. Trust line directly under the card (optional, dealer-driven).
 */
/**
 * Adjust an arbitrary hex color into a darker hover variant by
 * dropping each channel by 12 / 256. Cheap-and-cheerful — fine for
 * the admin-driven CTA color where we just want a visible response
 * on hover regardless of which yellow / orange / red the dealer picks.
 */
const darkenHex = (hex: string, amount = 12): string => {
  if (!hex.startsWith("#") || hex.length !== 7) return hex;
  const r = Math.max(0, parseInt(hex.slice(1, 3), 16) - amount);
  const g = Math.max(0, parseInt(hex.slice(3, 5), 16) - amount);
  const b = Math.max(0, parseInt(hex.slice(5, 7), 16) - amount);
  return `#${[r, g, b].map((v) => v.toString(16).padStart(2, "0")).join("")}`;
};

/** Convert a hex color to an rgb() string so we can compose subtle
 *  alpha shadows from it without locking to specific tints. */
const hexToRgb = (hex: string): string => {
  if (!hex.startsWith("#") || hex.length !== 7) return "0,0,0";
  return `${parseInt(hex.slice(1, 3), 16)},${parseInt(hex.slice(3, 5), 16)},${parseInt(hex.slice(5, 7), 16)}`;
};

const LandingPlateInput = ({
  onEngage,
  theme = "light",
  defaultState = "CT",
  ctaLabel = "Get my offer",
  ctaColor,
  trustLine,
  defaultLookup = "plate",
}: Props) => {
  const [mode, setMode] = useState<"plate" | "vin">(defaultLookup);
  const [plate, setPlate] = useState("");
  const [state, setState] = useState(defaultState);
  const [vin, setVin] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (mode === "plate") {
      const cleaned = plate.trim().toUpperCase();
      if (!cleaned) return;
      setSubmitting(true);
      setTimeout(() => onEngage({ plate: cleaned, state }), 180);
    } else {
      const cleaned = vin.trim().toUpperCase();
      if (cleaned.length !== 17) return;
      setSubmitting(true);
      setTimeout(() => onEngage({ vin: cleaned }), 180);
    }
  };

  // Theme tokens. The card surface is always near-white so the
  // shadow / border read clearly even on a dark hero — that's the
  // pattern Carvana and CarMax use on their bright color hero
  // backgrounds. The cluster is the "lit" element on the page.
  const t =
    theme === "dark"
      ? {
          card: "#FFFFFF",
          cardBorder: "rgba(0,0,0,0.06)",
          cardShadow: "0 18px 50px -10px rgba(0,0,0,0.40), 0 0 0 1px rgba(255,255,255,0.04)",
          fieldText: "#0A0A0A",
          fieldDivider: "rgba(0,0,0,0.10)",
          placeholder: "rgba(0,0,0,0.40)",
          tabBg: "#F4F4F5",
          tabBorder: "rgba(0,0,0,0.06)",
          tabActiveBg: "#FFFFFF",
          tabIdleText: "rgba(0,0,0,0.55)",
          trustText: "rgba(255,255,255,0.85)",
          stateBg: "#FAFAFA",
        }
      : theme === "warm"
      ? {
          card: "#FFFFFF",
          cardBorder: "rgba(44,42,38,0.10)",
          cardShadow: "0 12px 40px -10px rgba(44,42,38,0.20), 0 0 0 1px rgba(44,42,38,0.04)",
          fieldText: "#2C2A26",
          fieldDivider: "rgba(44,42,38,0.12)",
          placeholder: "rgba(44,42,38,0.45)",
          tabBg: "#F4EFE6",
          tabBorder: "rgba(44,42,38,0.10)",
          tabActiveBg: "#FFFFFF",
          tabIdleText: "rgba(44,42,38,0.55)",
          trustText: "rgba(44,42,38,0.65)",
          stateBg: "#FAF8F4",
        }
      : {
          card: "#FFFFFF",
          cardBorder: "rgba(0,0,0,0.07)",
          cardShadow: "0 10px 36px -10px rgba(0,0,0,0.18), 0 0 0 1px rgba(0,0,0,0.04)",
          fieldText: "#0A0A0A",
          fieldDivider: "rgba(0,0,0,0.10)",
          placeholder: "rgba(0,0,0,0.40)",
          tabBg: "#F4F4F5",
          tabBorder: "rgba(0,0,0,0.06)",
          tabActiveBg: "#FFFFFF",
          tabIdleText: "rgba(0,0,0,0.55)",
          trustText: "rgba(0,0,0,0.55)",
          stateBg: "#FAFAFA",
        };

  // SaaS-grade saturated yellow. #FACC15 is Tailwind yellow-400 —
  // the punchy yellow used across Linear, Substack, modern fintech
  // CTAs. Reads bright and confident against a white card without
  // tipping into amber. Earlier #FFD500 with a yellow-halo glow read
  // washed-out because the halo diluted the perceived saturation;
  // we now use a clean dark elevation shadow + a tighter inset
  // highlight, so the button itself stays maximally saturated.
  // Dealer can override via site_config.landing_cta_color.
  const ctaBg = ctaColor || "#FACC15";
  const ctaBgHover = darkenHex(ctaBg, 16);
  const ctaText = "#0A0A0A";
  const ctaShadow =
    "0 4px 12px -2px rgba(0,0,0,0.18), 0 2px 4px -1px rgba(0,0,0,0.10), inset 0 1px 0 rgba(255,255,255,0.30)";
  const ctaShadowHover = `0 8px 18px -3px rgba(${hexToRgb(ctaBg)},0.45), 0 3px 6px -1px rgba(0,0,0,0.16), inset 0 1px 0 rgba(255,255,255,0.30)`;

  const submitDisabled =
    submitting ||
    (mode === "plate" ? !plate.trim() : vin.trim().length !== 17);

  return (
    <div className="w-full max-w-[640px] mx-auto">
      <form
        onSubmit={handleSubmit}
        className="w-full"
        aria-label="Get an instant offer on your car"
      >
        {/* The unified card — every interactive element lives inside
            so the cluster reads as ONE elevated surface. */}
        <div
          className="rounded-[20px] p-3 sm:p-4"
          style={{
            background: t.card,
            border: `1px solid ${t.cardBorder}`,
            boxShadow: t.cardShadow,
          }}
        >
          {/* Plate / VIN segmented control — pinned top-left so the
              eye lands on lookup type before the input. */}
          <div
            role="tablist"
            aria-label="Choose lookup method"
            className="inline-grid grid-cols-2 gap-1 mb-3 p-1 rounded-full text-center"
            style={{
              background: t.tabBg,
              border: `1px solid ${t.tabBorder}`,
            }}
          >
            <button
              type="button"
              role="tab"
              aria-selected={mode === "plate"}
              onClick={() => setMode("plate")}
              disabled={submitting}
              className="font-sans px-5 py-1.5 rounded-full text-[12px] font-semibold tracking-wide transition-all"
              style={{
                background: mode === "plate" ? t.tabActiveBg : "transparent",
                color: mode === "plate" ? t.fieldText : t.tabIdleText,
                boxShadow:
                  mode === "plate"
                    ? "0 1px 2px rgba(0,0,0,0.10), 0 0 0 1px rgba(0,0,0,0.04)"
                    : "none",
              }}
            >
              Plate &amp; State
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={mode === "vin"}
              onClick={() => setMode("vin")}
              disabled={submitting}
              className="font-sans px-5 py-1.5 rounded-full text-[12px] font-semibold tracking-wide transition-all"
              style={{
                background: mode === "vin" ? t.tabActiveBg : "transparent",
                color: mode === "vin" ? t.fieldText : t.tabIdleText,
                boxShadow:
                  mode === "vin"
                    ? "0 1px 2px rgba(0,0,0,0.10), 0 0 0 1px rgba(0,0,0,0.04)"
                    : "none",
              }}
            >
              VIN
            </button>
          </div>

          {/* Input row + inline CTA. On desktop everything sits on a
              single row inside a single bordered pill; on mobile the
              CTA collapses to a full-width button below. */}
          <div className="flex flex-col sm:flex-row gap-3">
            {/* Unified input pill — Plate & State share one bordered
                container separated by a hairline; VIN takes the whole
                row. The pill itself is the "input" the customer sees,
                not the individual fields. */}
            <div
              className="flex-1 flex items-center min-w-0 rounded-2xl overflow-hidden"
              style={{
                border: `1.5px solid ${t.fieldDivider}`,
                background: "#FFFFFF",
              }}
            >
              {mode === "plate" ? (
                <>
                  <input
                    type="text"
                    value={plate}
                    onChange={(e) => setPlate(e.target.value)}
                    placeholder="License plate"
                    inputMode="text"
                    autoCapitalize="characters"
                    autoComplete="off"
                    spellCheck={false}
                    enterKeyHint="next"
                    disabled={submitting}
                    aria-label="License plate"
                    className="flex-1 min-w-0 h-14 sm:h-16 px-5 text-base sm:text-lg font-semibold tracking-[0.10em] uppercase border-none outline-none bg-transparent"
                    style={{ color: t.fieldText }}
                  />
                  {/* Hairline divider between plate and state */}
                  <div
                    className="self-stretch w-px"
                    style={{ background: t.fieldDivider }}
                    aria-hidden
                  />
                  <select
                    value={state}
                    onChange={(e) => setState(e.target.value)}
                    disabled={submitting}
                    aria-label="State"
                    className="h-14 sm:h-16 pl-3 pr-7 text-base sm:text-lg font-bold tracking-wide border-none outline-none appearance-none cursor-pointer"
                    style={{
                      color: t.fieldText,
                      background: t.stateBg,
                      backgroundImage:
                        "url(\"data:image/svg+xml;charset=UTF-8,%3csvg xmlns='http://www.w3.org/2000/svg' width='10' height='6' viewBox='0 0 10 6'%3e%3cpath d='M1 1l4 4 4-4' stroke='%231F2937' stroke-width='1.5' fill='none' stroke-linecap='round' stroke-linejoin='round'/%3e%3c/svg%3e\")",
                      backgroundRepeat: "no-repeat",
                      backgroundPosition: "right 10px center",
                    }}
                  >
                    {STATES.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                </>
              ) : (
                <input
                  type="text"
                  value={vin}
                  onChange={(e) =>
                    setVin(
                      e.target.value.replace(/[^A-Za-z0-9]/g, "").slice(0, 17),
                    )
                  }
                  placeholder="17-character VIN"
                  inputMode="text"
                  autoCapitalize="characters"
                  autoComplete="off"
                  spellCheck={false}
                  enterKeyHint="go"
                  disabled={submitting}
                  aria-label="Vehicle Identification Number"
                  maxLength={17}
                  className="flex-1 min-w-0 h-14 sm:h-16 px-5 text-base sm:text-lg font-semibold tracking-[0.14em] uppercase border-none outline-none bg-transparent"
                  style={{ color: t.fieldText }}
                />
              )}
            </div>

            {/* Inline CTA — Carvana-yellow pill, weighty, the loudest
                element on the page. */}
            <button
              type="submit"
              disabled={submitDisabled}
              className="font-sans h-14 sm:h-16 px-7 rounded-2xl text-base sm:text-[17px] font-bold inline-flex items-center justify-center gap-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed sm:flex-shrink-0"
              style={{ background: ctaBg, color: ctaText, boxShadow: ctaShadow }}
              onMouseEnter={(e) => {
                if (!submitDisabled) {
                  e.currentTarget.style.background = ctaBgHover;
                  e.currentTarget.style.boxShadow = ctaShadowHover;
                }
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = ctaBg;
                e.currentTarget.style.boxShadow = ctaShadow;
              }}
            >
              {submitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
                  <span>Looking it up</span>
                </>
              ) : (
                <>
                  <span>{ctaLabel}</span>
                  <ArrowRight className="w-[18px] h-[18px]" aria-hidden="true" strokeWidth={2.4} />
                </>
              )}
            </button>
          </div>
        </div>

        {/* Trust line — sits OUTSIDE the card, smaller, secondary so
            the card stays the visual anchor. Optional; only renders
            when the template passes a string. */}
        {trustLine && (
          <p
            className="font-sans text-[12px] sm:text-[13px] text-center mt-3 leading-relaxed"
            style={{ color: t.trustText }}
          >
            {trustLine}
          </p>
        )}
      </form>
    </div>
  );
};

export default LandingPlateInput;
