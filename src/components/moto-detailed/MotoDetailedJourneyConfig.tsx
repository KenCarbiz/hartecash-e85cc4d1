import { useEffect, useMemo, useState } from "react";
import { Monitor, Smartphone, AlertTriangle, Info, ShieldAlert, Check, Loader2, Save, Sparkles } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useTenant } from "@/contexts/TenantContext";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
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
 * Dealer-facing config panel for the customer acquisition journey.
 *
 * Persists four columns on site_config:
 *   - customer_journey_template      ('moto' | 'moto_detailed')
 *   - moto_detailed_preset           (preset id)
 *   - moto_detailed_offer_display_mode
 *   - moto_detailed_custom_config    (reserved for future overrides)
 *
 * When the dealer flips customer_journey_template we also sync
 * landing_template to the same value so the public /sell route
 * picks up the correct engine without a second click. The original
 * "moto" flow remains the safe fallback if any of the new columns
 * are missing.
 */

const SEEDED_VALUATION: JourneyValuation = {
  low: 19250,
  high: 21450,
  firm: 20150,
  confidence: "high",
  marketStrength: "hot",
  trend: [0.4, 0.45, 0.55, 0.5, 0.6, 0.65, 0.7, 0.78],
};

type Template = "moto" | "moto_detailed";

interface State {
  customer_journey_template: Template;
  moto_detailed_preset: JourneyPresetId;
  moto_detailed_offer_display_mode: OfferDisplayMode;
}

const DEFAULTS: State = {
  customer_journey_template: "moto",
  moto_detailed_preset: "moto_detailed",
  moto_detailed_offer_display_mode: "after_contact_info",
};

const MotoDetailedJourneyConfig = () => {
  const { tenant } = useTenant();
  const dealershipId = tenant.dealership_id;
  const { toast } = useToast();
  const qc = useQueryClient();

  const [state, setState] = useState<State>(DEFAULTS);
  const [saved, setSaved] = useState<State>(DEFAULTS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [device, setDevice] = useState<"desktop" | "mobile">("desktop");

  useEffect(() => {
    (async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from("site_config")
        .select(
          "customer_journey_template, moto_detailed_preset, moto_detailed_offer_display_mode",
        )
        .eq("dealership_id", dealershipId)
        .maybeSingle();
      if (!error && data) {
        const next: State = {
          customer_journey_template:
            ((data as any).customer_journey_template as Template) ||
            DEFAULTS.customer_journey_template,
          moto_detailed_preset:
            ((data as any).moto_detailed_preset as JourneyPresetId) ||
            DEFAULTS.moto_detailed_preset,
          moto_detailed_offer_display_mode:
            ((data as any).moto_detailed_offer_display_mode as OfferDisplayMode) ||
            DEFAULTS.moto_detailed_offer_display_mode,
        };
        setState(next);
        setSaved(next);
      }
      setLoading(false);
    })();
  }, [dealershipId]);

  const isDetailed = state.customer_journey_template === "moto_detailed";
  const previewPresetId: JourneyPresetId = isDetailed
    ? state.moto_detailed_preset
    : "moto";

  const config = useMemo(
    () =>
      buildPresetConfig(previewPresetId, {
        offerDisplayMode: state.moto_detailed_offer_display_mode,
      }),
    [previewPresetId, state.moto_detailed_offer_display_mode],
  );
  const warnings = useMemo(() => evaluateGuardrails(config), [config]);
  const preset = PRESET_LIST.find((p) => p.id === previewPresetId)!;

  const dirty =
    state.customer_journey_template !== saved.customer_journey_template ||
    state.moto_detailed_preset !== saved.moto_detailed_preset ||
    state.moto_detailed_offer_display_mode !== saved.moto_detailed_offer_display_mode;

  const handleSave = async () => {
    setSaving(true);
    const payload: Record<string, unknown> = {
      customer_journey_template: state.customer_journey_template,
      moto_detailed_preset: state.moto_detailed_preset,
      moto_detailed_offer_display_mode: state.moto_detailed_offer_display_mode,
      // Keep landing_template in sync so the public route renders
      // the correct engine immediately. Dealers who want a different
      // landing template can still pick one explicitly afterward.
      landing_template: state.customer_journey_template,
      updated_at: new Date().toISOString(),
    };
    const { error } = await supabase
      .from("site_config")
      .update(payload)
      .eq("dealership_id", dealershipId);
    setSaving(false);
    if (error) {
      toast({
        title: "Save failed",
        description: error.message,
        variant: "destructive",
      });
      return;
    }
    setSaved(state);
    qc.invalidateQueries({ queryKey: ["site_config"] });
    toast({ title: "Journey saved", description: "Your customer flow is now live." });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center rounded-2xl border border-zinc-200 bg-white p-12">
        <Loader2 className="h-5 w-5 animate-spin text-zinc-400" />
      </div>
    );
  }

  return (
    <section className="space-y-6 rounded-2xl border border-zinc-200 bg-white p-6">
      {/* ── Header ───────────────────────────────────────────────── */}
      <header className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold text-zinc-900">Customer Journey</h2>
          <p className="mt-1 text-sm text-zinc-500">
            Choose how customers experience your valuation flow. Preview both
            desktop and mobile before saving.
          </p>
        </div>
        <Button onClick={handleSave} disabled={!dirty || saving} className="shrink-0">
          {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
          Save journey
        </Button>
      </header>

      {/* ── Top-level template toggle ─────────────────────────── */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {([
          {
            id: "moto" as Template,
            label: "Moto",
            tagline: "Ultra-minimal · fastest conversion",
            description:
              "The original 8-step MotoAcquire flow. Single white card, no journey rail, mobile-first.",
          },
          {
            id: "moto_detailed" as Template,
            label: "Moto Detailed",
            tagline: "Premium guided · national-brand feel",
            description:
              "Two-phase experience: minimal landing → guided multi-step journey with desktop rail and live valuation.",
          },
        ]).map((t) => {
          const active = state.customer_journey_template === t.id;
          return (
            <button
              key={t.id}
              type="button"
              onClick={() =>
                setState((s) => ({ ...s, customer_journey_template: t.id }))
              }
              className={`rounded-xl border p-4 text-left transition-all ${
                active
                  ? "border-[hsl(263_70%_50%)] bg-[hsl(263_70%_50%/0.04)] shadow-[0_0_0_3px_hsl(263_70%_50%/0.08)]"
                  : "border-zinc-200 bg-white hover:border-zinc-300"
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-semibold text-zinc-900">{t.label}</p>
                {active && (
                  <span className="rounded-full bg-[hsl(263_70%_50%)] p-0.5 text-white">
                    <Check className="h-3 w-3" />
                  </span>
                )}
              </div>
              <p className="mt-0.5 text-xs font-medium text-zinc-500">{t.tagline}</p>
              <p className="mt-2 text-xs text-zinc-500">{t.description}</p>
            </button>
          );
        })}
      </div>

      {/* ── Detailed-only sub-options ───────────────────────────── */}
      {isDetailed && (
        <div className="space-y-5 rounded-xl border border-zinc-200 bg-zinc-50/40 p-5">
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">
              Preset
            </p>
            <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {PRESET_LIST.filter((p) => p.id !== "moto").map((p) => {
                const active = p.id === state.moto_detailed_preset;
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() =>
                      setState((s) => ({ ...s, moto_detailed_preset: p.id }))
                    }
                    className={`rounded-xl border p-3 text-left transition-all ${
                      active
                        ? "border-[hsl(263_70%_50%)] bg-white shadow-[0_0_0_3px_hsl(263_70%_50%/0.08)]"
                        : "border-zinc-200 bg-white hover:border-zinc-300"
                    }`}
                  >
                    <p className="text-sm font-semibold text-zinc-900">{p.label}</p>
                    <p className="mt-0.5 text-xs text-zinc-500">{p.tagline}</p>
                    <p className="mt-1.5 text-[11px] text-zinc-400">
                      ~{p.estimatedSeconds}s · {p.build().steps.length} steps
                    </p>
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">
              Offer timing
            </p>
            <div className="mt-2 inline-flex rounded-lg border border-zinc-200 bg-white p-0.5">
              {(["after_contact_info", "before_contact_info"] as const).map((mode) => {
                const active = state.moto_detailed_offer_display_mode === mode;
                return (
                  <button
                    key={mode}
                    type="button"
                    onClick={() =>
                      setState((s) => ({ ...s, moto_detailed_offer_display_mode: mode }))
                    }
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
        </div>
      )}

      {/* ── Guardrail warnings ──────────────────────────────────── */}
      {isDetailed && warnings.length > 0 && (
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
              <div
                key={i}
                className={`flex items-start gap-2 rounded-lg border px-3 py-2 text-sm ${styles}`}
              >
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

      {/* ── Step order ──────────────────────────────────────────── */}
      {isDetailed && (
        <div className="rounded-xl border border-zinc-200 bg-white p-4">
          <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">
            Step order ({preset.label})
          </p>
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
      )}

      {/* ── Preview ─────────────────────────────────────────────── */}
      <div className="rounded-2xl border border-zinc-200 bg-zinc-100/60 p-4">
        <div className="mb-3 flex items-center justify-between">
          <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">
            Live preview
          </p>
          <div className="inline-flex rounded-lg border border-zinc-200 bg-white p-0.5">
            {(["desktop", "mobile"] as const).map((d) => {
              const active = device === d;
              const Icon = d === "desktop" ? Monitor : Smartphone;
              return (
                <button
                  key={d}
                  type="button"
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

        {!isDetailed ? (
          <div className="flex items-center gap-3 rounded-xl border border-dashed border-zinc-300 bg-white p-8 text-sm text-zinc-500">
            <Sparkles className="h-4 w-4 text-zinc-400" />
            The classic <span className="font-medium text-zinc-700">Moto</span> flow runs in its own
            8-step shell — preview it directly on your <code className="rounded bg-zinc-100 px-1.5 py-0.5 text-xs">/sell</code> route.
          </div>
        ) : (
          <div
            className={`mx-auto overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-sm transition-all ${
              device === "mobile" ? "max-w-[390px]" : "max-w-full"
            }`}
            style={{ height: 720 }}
          >
            <div className="h-full overflow-y-auto">
              <JourneyEngine
                key={`${previewPresetId}-${state.moto_detailed_offer_display_mode}-${device}`}
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
    </section>
  );
};

export default MotoDetailedJourneyConfig;
