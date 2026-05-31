import { useMemo, useState } from "react";
import { Monitor, Smartphone, AlertTriangle, Info, ShieldAlert, Check } from "lucide-react";
import JourneyEngine from "./JourneyEngine";
import {
  PRESET_LIST,
  buildPresetConfig,
  evaluateGuardrails,
  GUARDRAILS,
  type JourneyPresetId,
} from "./presets";
import type { OfferDisplayMode, JourneyValuation } from "./types";

/**
 * Dealer-facing Journey Preview.
 *
 * Used inside dealer onboarding + settings to let dealers:
 *   - pick a preset (Moto, Moto Detailed, Instant Offer, etc.)
 *   - toggle offer timing (before vs after contact)
 *   - inspect step order
 *   - preview the customer flow on desktop AND mobile
 *
 * The engine runs in `preview` mode so analytics events don't fire.
 * Steps are seeded with a fake valuation so dealers see what the
 * customer would see post-lookup.
 */

const SEEDED_VALUATION: JourneyValuation = {
  low: 19250,
  high: 21450,
  firm: 20150,
  confidence: "high",
  marketStrength: "hot",
  trend: [0.4, 0.45, 0.55, 0.5, 0.6, 0.65, 0.7, 0.78],
};

const DealerJourneyPreview = () => {
  const [presetId, setPresetId] = useState<JourneyPresetId>("moto_detailed");
  const [offerMode, setOfferMode] = useState<OfferDisplayMode>("after_contact_info");
  const [device, setDevice] = useState<"desktop" | "mobile">("desktop");

  const preset = PRESET_LIST.find((p) => p.id === presetId)!;
  const config = useMemo(
    () => buildPresetConfig(presetId, { offerDisplayMode: offerMode }),
    [presetId, offerMode],
  );
  const warnings = useMemo(() => evaluateGuardrails(config), [config]);

  const isMoto = presetId === "moto";

  return (
    <div className="space-y-6">
      {/* ── Preset picker ───────────────────────────────────────── */}
      <div>
        <p className="text-sm font-medium text-zinc-700">Journey template</p>
        <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {PRESET_LIST.map((p) => {
            const active = p.id === presetId;
            return (
              <button
                key={p.id}
                onClick={() => setPresetId(p.id)}
                className={`rounded-xl border p-4 text-left transition-all ${
                  active
                    ? "border-[hsl(263_70%_50%)] bg-[hsl(263_70%_50%/0.04)] shadow-[0_0_0_3px_hsl(263_70%_50%/0.08)]"
                    : "border-zinc-200 bg-white hover:border-zinc-300"
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <p className="text-sm font-semibold text-zinc-900">{p.label}</p>
                  {active && (
                    <span className="rounded-full bg-[hsl(263_70%_50%)] p-0.5 text-white">
                      <Check className="h-3 w-3" />
                    </span>
                  )}
                </div>
                <p className="mt-0.5 text-xs text-zinc-500">{p.tagline}</p>
                <p className="mt-2 text-[11px] text-zinc-400">
                  ~{p.estimatedSeconds}s · {p.build().steps.length} steps
                </p>
              </button>
            );
          })}
        </div>
        <p className="mt-2 text-xs text-zinc-500">{preset.description}</p>
      </div>

      {/* ── Controls row ────────────────────────────────────────── */}
      <div className="flex flex-wrap items-end justify-between gap-4 rounded-xl border border-zinc-200 bg-zinc-50/50 p-4">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">Offer timing</p>
          <div className="mt-2 inline-flex rounded-lg border border-zinc-200 bg-white p-0.5">
            {(["after_contact_info", "before_contact_info"] as const).map((mode) => {
              const active = offerMode === mode;
              return (
                <button
                  key={mode}
                  onClick={() => setOfferMode(mode)}
                  className={`rounded-md px-3 py-1.5 text-xs font-medium transition-all ${
                    active ? "bg-zinc-900 text-white" : "text-zinc-600 hover:text-zinc-900"
                  }`}
                >
                  {mode === "after_contact_info" ? "After contact info" : "Before contact info"}
                </button>
              );
            })}
          </div>
        </div>

        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">Device</p>
          <div className="mt-2 inline-flex rounded-lg border border-zinc-200 bg-white p-0.5">
            {(["desktop", "mobile"] as const).map((d) => {
              const active = device === d;
              const Icon = d === "desktop" ? Monitor : Smartphone;
              return (
                <button
                  key={d}
                  onClick={() => setDevice(d)}
                  className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-all ${
                    active ? "bg-zinc-900 text-white" : "text-zinc-600 hover:text-zinc-900"
                  }`}
                >
                  <Icon className="h-3.5 w-3.5" /> {d === "desktop" ? "Desktop" : "Mobile"}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* ── Guardrail warnings ──────────────────────────────────── */}
      {warnings.length > 0 && (
        <div className="space-y-2">
          {warnings.map((w, i) => {
            const styles =
              w.level === "block"
                ? "border-rose-200 bg-rose-50 text-rose-800"
                : w.level === "warn"
                ? "border-amber-200 bg-amber-50 text-amber-800"
                : "border-zinc-200 bg-zinc-50 text-zinc-700";
            const Icon = w.level === "block" ? ShieldAlert : w.level === "warn" ? AlertTriangle : Info;
            return (
              <div key={i} className={`flex items-start gap-2 rounded-lg border px-3 py-2 text-sm ${styles}`}>
                <Icon className="mt-0.5 h-4 w-4 shrink-0" />
                <span>{w.message}</span>
              </div>
            );
          })}
          <p className="text-[11px] text-zinc-400">
            Recommended max: {GUARDRAILS.recommendedMaxSteps} steps · one primary action per screen.
          </p>
        </div>
      )}

      {/* ── Step-order summary ──────────────────────────────────── */}
      <div className="rounded-xl border border-zinc-200 bg-white p-4">
        <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">Step order</p>
        <ol className="mt-3 flex flex-wrap gap-2">
          {config.steps.map((s, i) => (
            <li
              key={s.id}
              className="inline-flex items-center gap-1.5 rounded-full border border-zinc-200 bg-zinc-50 px-3 py-1 text-xs text-zinc-700"
            >
              <span className="font-semibold text-zinc-900">{i + 1}.</span> {s.title}
            </li>
          ))}
        </ol>
      </div>

      {/* ── Live preview ────────────────────────────────────────── */}
      <div className="rounded-2xl border border-zinc-200 bg-zinc-100/60 p-4">
        <p className="mb-3 text-xs font-medium uppercase tracking-wide text-zinc-500">
          Live preview ({device})
        </p>

        {isMoto ? (
          <div className="rounded-xl border border-dashed border-zinc-300 bg-white p-8 text-center text-sm text-zinc-500">
            The classic <span className="font-medium text-zinc-700">Moto</span> flow runs in its own
            8-step shell — preview it directly on your /sell route.
          </div>
        ) : (
          <div
            className={`mx-auto overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-sm transition-all ${
              device === "mobile" ? "max-w-[390px]" : "max-w-full"
            }`}
            style={device === "mobile" ? { height: 720 } : { height: 720 }}
          >
            <div className="h-full overflow-y-auto">
              <JourneyEngine
                key={`${presetId}-${offerMode}-${device}`}
                config={config}
                preview
                initialState={{
                  vehicle: { year: "2021", make: "Toyota", model: "Camry", trim: "SE" },
                  valuation: SEEDED_VALUATION,
                }}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default DealerJourneyPreview;
