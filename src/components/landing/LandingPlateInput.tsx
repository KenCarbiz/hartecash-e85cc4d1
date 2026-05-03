import { useState, type FormEvent } from "react";
import { ArrowRight, Loader2 } from "lucide-react";

const STATES = [
  "AL", "AK", "AZ", "AR", "CA", "CO", "CT", "DE", "FL", "GA",
  "HI", "ID", "IL", "IN", "IA", "KS", "KY", "LA", "ME", "MD",
  "MA", "MI", "MN", "MS", "MO", "MT", "NE", "NV", "NH", "NJ",
  "NM", "NY", "NC", "ND", "OH", "OK", "OR", "PA", "RI", "SC",
  "SD", "TN", "TX", "UT", "VT", "VA", "WA", "WV", "WI", "WY",
];

export interface LandingPlateInputValue {
  plate: string;
  state: string;
}

interface Props {
  /** Fired with the entered plate+state when the customer engages.
   *  Templates open the FullscreenWizard from this callback. */
  onEngage: (value: LandingPlateInputValue) => void;
  /** Visual variant. Tier C (Apple/Porsche white) is default. */
  theme?: "light" | "dark" | "warm";
  /** Override default state. Useful for IP-geo defaulting. */
  defaultState?: string;
  /** Optional CTA copy override. Defaults to "Get my offer". */
  ctaLabel?: string;
}

/**
 * Slim landing-page plate+state input — the only thing the customer
 * touches on the marketing landing. Submitting hands off the value to
 * the parent (which opens FullscreenWizard) so the marketing chrome
 * disappears and a focused premium flow takes over the viewport.
 *
 * Per the May-2026 sell-flow design audit: plate+state is the
 * universal premium first-input pattern (Carvana, CarMax, CarGurus,
 * AccuTrade). VIN is the secondary path and lives inside the wizard,
 * not on the landing.
 *
 * Inputs are styled with mobile-keyboard hints (autocapitalize,
 * inputmode, autocomplete=off on the plate to disable browser
 * autofill suggestions for license-plate text).
 */
const LandingPlateInput = ({
  onEngage,
  theme = "light",
  defaultState = "CT",
  ctaLabel = "Get my offer",
}: Props) => {
  const [plate, setPlate] = useState("");
  const [state, setState] = useState(defaultState);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    const cleaned = plate.trim().toUpperCase();
    if (!cleaned) return;
    setSubmitting(true);
    // Tiny synthetic delay so the fullscreen-wizard fade-in feels
    // intentional, not janky. The wizard does its own loading state
    // for the actual VIN lookup.
    setTimeout(() => {
      onEngage({ plate: cleaned, state });
      // Don't reset submitting — the wizard takes over the viewport,
      // this component animates out.
    }, 180);
  };

  // Theme tokens
  const t =
    theme === "dark"
      ? {
          fieldBg: "rgba(255,255,255,0.06)",
          fieldBorder: "rgba(255,255,255,0.10)",
          fieldText: "#FFFFFF",
          placeholder: "rgba(255,255,255,0.40)",
          ctaBg: "#FFFFFF",
          ctaText: "#0F0F12",
        }
      : theme === "warm"
      ? {
          fieldBg: "#FFFFFF",
          fieldBorder: "rgba(44,42,38,0.18)",
          fieldText: "#2C2A26",
          placeholder: "rgba(44,42,38,0.45)",
          ctaBg: "#1F4068",
          ctaText: "#FFFFFF",
        }
      : {
          fieldBg: "#F5F5F7",
          fieldBorder: "rgba(0,0,0,0.06)",
          fieldText: "#0A0A0A",
          placeholder: "rgba(0,0,0,0.40)",
          ctaBg: "#0A0A0A",
          ctaText: "#FFFFFF",
        };

  return (
    <form
      onSubmit={handleSubmit}
      className="w-full"
      aria-label="Get an instant offer on your car"
    >
      {/* Two-input row + CTA. Plate + state side-by-side, full-width
          CTA below on mobile, inline on desktop. */}
      <div className="flex flex-col sm:flex-row gap-2 sm:gap-2">
        <div className="flex gap-2 flex-1">
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
            className="flex-1 min-w-0 h-14 px-5 rounded-xl text-base font-medium tracking-[0.06em] uppercase border outline-none focus:ring-2 focus:ring-offset-0 transition-all"
            style={{
              background: t.fieldBg,
              borderColor: t.fieldBorder,
              color: t.fieldText,
            }}
          />
          <select
            value={state}
            onChange={(e) => setState(e.target.value)}
            disabled={submitting}
            aria-label="State"
            className="h-14 px-3 rounded-xl text-base font-semibold border outline-none focus:ring-2 focus:ring-offset-0 transition-all w-[88px]"
            style={{
              background: t.fieldBg,
              borderColor: t.fieldBorder,
              color: t.fieldText,
            }}
          >
            {STATES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>
        <button
          type="submit"
          disabled={submitting || !plate.trim()}
          className="h-14 px-7 rounded-xl text-base font-semibold inline-flex items-center justify-center gap-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          style={{
            background: t.ctaBg,
            color: t.ctaText,
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
              <ArrowRight className="w-4 h-4" aria-hidden="true" />
            </>
          )}
        </button>
      </div>

      {/* Tiny VIN fallback link — kept secondary, doesn't compete with
          the primary plate flow. Inside the wizard, full VIN/YMM tabs
          are available; here on the landing we keep things singular. */}
      <p
        className="text-[11px] text-center mt-3 opacity-60"
        style={{ color: t.fieldText }}
      >
        Don't have your plate? You can use your VIN inside.
      </p>
    </form>
  );
};

export default LandingPlateInput;
