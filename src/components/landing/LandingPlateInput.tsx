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
}

/**
 * Slim landing-page lookup input — the only thing the customer touches
 * on the marketing landing. Submitting hands off the value to the
 * parent (which opens FullscreenWizard) so the marketing chrome
 * disappears and a focused premium flow takes over the viewport.
 *
 * Per the May-2026 sell-flow design audit: plate+state is the default
 * because it's the universal premium first-input pattern (Carvana,
 * CarMax, CarGurus, AccuTrade), but the customer can switch to VIN
 * via a small tab — some sellers don't have plates handy (in transit,
 * dealer plates, etc.) and forcing them to dig increases drop-off.
 */
const LandingPlateInput = ({
  onEngage,
  theme = "light",
  defaultState = "CT",
  ctaLabel = "Get my offer",
}: Props) => {
  const [mode, setMode] = useState<"plate" | "vin">("plate");
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
      // VINs are 17 alphanumeric chars (no I/O/Q). Light client check
      // only — the server validates strictly.
      if (cleaned.length !== 17) return;
      setSubmitting(true);
      setTimeout(() => onEngage({ vin: cleaned }), 180);
    }
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
          tabActiveBg: "rgba(255,255,255,0.12)",
          tabIdleText: "rgba(255,255,255,0.55)",
        }
      : theme === "warm"
      ? {
          fieldBg: "#FFFFFF",
          fieldBorder: "rgba(44,42,38,0.18)",
          fieldText: "#2C2A26",
          placeholder: "rgba(44,42,38,0.45)",
          ctaBg: "#1F4068",
          ctaText: "#FFFFFF",
          tabActiveBg: "rgba(44,42,38,0.08)",
          tabIdleText: "rgba(44,42,38,0.55)",
        }
      : {
          fieldBg: "#F5F5F7",
          fieldBorder: "rgba(0,0,0,0.06)",
          fieldText: "#0A0A0A",
          placeholder: "rgba(0,0,0,0.40)",
          ctaBg: "#0A0A0A",
          ctaText: "#FFFFFF",
          tabActiveBg: "rgba(0,0,0,0.06)",
          tabIdleText: "rgba(0,0,0,0.45)",
        };

  const submitDisabled =
    submitting ||
    (mode === "plate" ? !plate.trim() : vin.trim().length !== 17);

  return (
    <form
      onSubmit={handleSubmit}
      className="w-full"
      aria-label="Get an instant offer on your car"
    >
      {/* Plate / VIN tab toggle */}
      <div
        role="tablist"
        aria-label="Choose lookup method"
        className="inline-flex items-center gap-1 mb-3 p-1 rounded-lg"
        style={{ background: t.fieldBg, border: `1px solid ${t.fieldBorder}` }}
      >
        <button
          type="button"
          role="tab"
          aria-selected={mode === "plate"}
          onClick={() => setMode("plate")}
          disabled={submitting}
          className="px-4 py-1.5 rounded-md text-xs font-semibold tracking-wide uppercase transition-colors"
          style={{
            background: mode === "plate" ? t.tabActiveBg : "transparent",
            color: mode === "plate" ? t.fieldText : t.tabIdleText,
          }}
        >
          Plate + State
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={mode === "vin"}
          onClick={() => setMode("vin")}
          disabled={submitting}
          className="px-4 py-1.5 rounded-md text-xs font-semibold tracking-wide uppercase transition-colors"
          style={{
            background: mode === "vin" ? t.tabActiveBg : "transparent",
            color: mode === "vin" ? t.fieldText : t.tabIdleText,
          }}
        >
          VIN
        </button>
      </div>

      {/* Inputs row + CTA */}
      <div className="flex flex-col sm:flex-row gap-2 sm:gap-2">
        {mode === "plate" ? (
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
        ) : (
          <input
            type="text"
            value={vin}
            onChange={(e) => setVin(e.target.value.replace(/[^A-Za-z0-9]/g, "").slice(0, 17))}
            placeholder="17-character VIN"
            inputMode="text"
            autoCapitalize="characters"
            autoComplete="off"
            spellCheck={false}
            enterKeyHint="go"
            disabled={submitting}
            aria-label="Vehicle Identification Number"
            maxLength={17}
            className="flex-1 min-w-0 h-14 px-5 rounded-xl text-base font-medium tracking-[0.08em] uppercase border outline-none focus:ring-2 focus:ring-offset-0 transition-all"
            style={{
              background: t.fieldBg,
              borderColor: t.fieldBorder,
              color: t.fieldText,
            }}
          />
        )}
        <button
          type="submit"
          disabled={submitDisabled}
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
    </form>
  );
};

export default LandingPlateInput;
