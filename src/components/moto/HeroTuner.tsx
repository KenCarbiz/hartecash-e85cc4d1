import { useEffect, useRef, useState } from "react";
import { useTenant } from "@/contexts/TenantContext";
import { supabase } from "@/integrations/supabase/client";
import { useTunerConfig } from "./useTunerConfig";

type LiveStatus = "idle" | "checking" | "ok" | "fail";
const LIVE_HOST = "hartecash.com";

function useLiveCheck(
  dealershipId: string | undefined | null,
  expectedHero: HeroTunerValues,
  lastUpdatedAt: number | null,
) {
  const [liveStatus, setLiveStatus] = useState<LiveStatus>("idle");
  const [liveCheckedAt, setLiveCheckedAt] = useState<number | null>(null);
  const [liveError, setLiveError] = useState<string | null>(null);
  const seen = useRef<number | null>(null);

  useEffect(() => {
    if (!dealershipId || !lastUpdatedAt) return;
    if (seen.current === lastUpdatedAt) return;
    seen.current = lastUpdatedAt;
    let cancelled = false;
    setLiveStatus("checking");
    setLiveError(null);

    (async () => {
      try {
        // 1. Round-trip the DB to confirm the save persisted.
        const { data, error } = await supabase
          .from("site_config")
          .select("hero_tuner_config")
          .eq("dealership_id", dealershipId)
          .maybeSingle();
        if (cancelled) return;
        if (error) throw new Error(error.message);
        const remoteHero = (data?.hero_tuner_config as { hero?: unknown })?.hero;
        const remoteSize = (remoteHero as { size?: number } | undefined)?.size;
        if (remoteSize !== expectedHero.size) {
          throw new Error(`DB hero.size=${remoteSize} ≠ local=${expectedHero.size}`);
        }
        // 2. Ping the public site (opaque — confirms reachability only).
        await fetch(`https://${LIVE_HOST}/?_tuner=${lastUpdatedAt}`, {
          method: "HEAD",
          mode: "no-cors",
          cache: "no-store",
        });
        if (cancelled) return;
        setLiveStatus("ok");
        setLiveCheckedAt(Date.now());
      } catch (e) {
        if (cancelled) return;
        setLiveStatus("fail");
        setLiveError(e instanceof Error ? e.message : String(e));
        setLiveCheckedAt(Date.now());
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [dealershipId, lastUpdatedAt, expectedHero.size]);

  return { liveStatus, liveCheckedAt, liveError };
}

export type HeroTunerValues = {
  // headline base
  size: number;
  weight: number;
  color: string;
  font: string;
  // vertical offset of the headline block (px). Negative = higher above the card.
  offsetY: number;
  // subline
  subSize: number;
  subColor: string;
  // gap (px) between subline and the top of the card below it
  subGap: number;
  // accent words ("Get an" + "Vehicle Valuation")
  accentColor: string;
  accentWeight: number;
  // middle action word ("instant")
  instantColor: string;
  instantWeight: number;
  // CTA color powering active tab + "valuation in 30 seconds" pill
  ctaColor: string;
  ctaTextColor: string;
  // Vertical thickness (padding-y, px) of the VIN/Plate tab buttons
  tabPadY: number;
};

const FONT_OPTIONS = [
  { label: "Inter (default)", value: "Inter, system-ui, sans-serif" },
  { label: "DM Serif Display", value: '"DM Serif Display", serif' },
  { label: "Georgia Serif", value: 'Georgia, "Times New Roman", serif' },
  { label: "System Sans", value: "system-ui, -apple-system, sans-serif" },
  { label: "Helvetica", value: '"Helvetica Neue", Helvetica, Arial, sans-serif' },
  { label: "Mono", value: '"JetBrains Mono", ui-monospace, monospace' },
];

// Default "yellow" matching the current --cta-offer brand color.
const BRAND_YELLOW = "#facc15";
const BRAND_YELLOW_INK = "#1f2937";

export const DEFAULTS: HeroTunerValues = {
  size: 36,
  weight: 300,
  color: "#18181b",
  font: FONT_OPTIONS[0].value,
  offsetY: 0,
  subSize: 16,
  subColor: "#71717a",
  subGap: 24,
  accentColor: BRAND_YELLOW,
  accentWeight: 600,
  instantColor: "#18181b",
  instantWeight: 300,
  ctaColor: BRAND_YELLOW,
  ctaTextColor: BRAND_YELLOW_INK,
  tabPadY: 9,
};

function merge(remote: unknown): HeroTunerValues {
  if (!remote || typeof remote !== "object") return DEFAULTS;
  return { ...DEFAULTS, ...(remote as Partial<HeroTunerValues>) };
}

export function useHeroTuner(): HeroTunerValues {
  const { tenant } = useTenant();
  const { config } = useTunerConfig(tenant.dealership_id);
  return merge(config.hero);
}

const HEX_RE = /^#[0-9a-fA-F]{6}$/;

function ColorField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (next: string) => void;
}) {
  const [draft, setDraft] = useState(value);
  useEffect(() => setDraft(value), [value]);
  const safe = HEX_RE.test(value) ? value : "#000000";
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="text-zinc-600">{label}</span>
      <div className="flex items-center gap-1">
        <input
          type="color"
          value={safe}
          onChange={(e) => onChange(e.target.value)}
          className="h-7 w-9 cursor-pointer rounded border border-zinc-300"
        />
        <input
          type="text"
          value={draft}
          onChange={(e) => {
            const v = e.target.value;
            setDraft(v);
            if (HEX_RE.test(v)) onChange(v);
          }}
          spellCheck={false}
          className="w-20 rounded border border-zinc-300 px-1.5 py-1 font-mono text-[11px] uppercase"
        />
      </div>
    </div>
  );
}

function WeightRow({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (n: number) => void;
}) {
  return (
    <label className="block">
      <div className="flex justify-between text-zinc-600">
        <span>{label}</span>
        <span>{value}</span>
      </div>
      <input
        type="range"
        min={100}
        max={900}
        step={100}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full"
      />
    </label>
  );
}

export default function HeroTuner() {
  const { tenant } = useTenant();
  const { config, update, status, realtime, lastUpdatedAt } = useTunerConfig(tenant.dealership_id);
  const values = merge(config.hero);
  const { liveStatus, liveCheckedAt, liveError } = useLiveCheck(
    tenant.dealership_id,
    values,
    lastUpdatedAt,
  );
  const [open, setOpen] = useState(false);

  // local optimistic state so sliders feel snappy
  const [local, setLocal] = useState<HeroTunerValues>(values);
  useEffect(() => {
    setLocal(values);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(values)]);

  const change = (patch: Partial<HeroTunerValues>) => {
    const next = { ...local, ...patch };
    setLocal(next);
    update("hero", next as unknown as Record<string, unknown>);
  };

  const reset = () => {
    setLocal(DEFAULTS);
    update("hero", DEFAULTS as unknown as Record<string, unknown>);
  };

  return (
    <div className="fixed bottom-4 right-20 z-[9999] font-sans text-xs">
      {open ? (
        <div className="max-h-[80vh] w-80 overflow-y-auto rounded-lg border border-zinc-200 bg-white p-4 shadow-2xl">
          <div className="mb-3 flex items-start justify-between gap-2">
            <div className="flex flex-col">
              <span className="font-semibold text-zinc-900">
                Hero Tuner{" "}
                <span
                  className={
                    status === "error"
                      ? "text-red-500"
                      : status === "saving"
                        ? "text-amber-500"
                        : status === "saved"
                          ? "text-emerald-600"
                          : "text-zinc-400"
                  }
                >
                  {status === "saving"
                    ? "(saving…)"
                    : status === "saved"
                      ? "(saved ✓ live)"
                      : status === "error"
                        ? "(save failed)"
                        : "(synced)"}
                </span>
              </span>
              <span className="mt-0.5 flex items-center gap-1.5 text-[10px] text-zinc-500">
                <span
                  className={
                    "inline-block h-1.5 w-1.5 rounded-full " +
                    (realtime === "live"
                      ? "bg-emerald-500 animate-pulse"
                      : realtime === "connecting"
                        ? "bg-amber-400"
                        : realtime === "error"
                          ? "bg-red-500"
                          : "bg-zinc-400")
                  }
                />
                <span>
                  realtime:{" "}
                  <span className="font-medium text-zinc-700">{realtime}</span>
                </span>
                <span className="text-zinc-300">·</span>
                <span>
                  updated:{" "}
                  <span className="font-medium text-zinc-700">
                    {lastUpdatedAt
                      ? new Date(lastUpdatedAt).toLocaleTimeString([], {
                          hour: "2-digit",
                          minute: "2-digit",
                          second: "2-digit",
                        })
                      : "—"}
                  </span>
                </span>
              </span>
              <span
                title={liveError ?? `Verifies ${LIVE_HOST} after each save`}
                className={
                  "mt-1 inline-flex w-fit items-center gap-1 rounded-full px-1.5 py-0.5 text-[10px] font-medium " +
                  (liveStatus === "ok"
                    ? "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200"
                    : liveStatus === "checking"
                      ? "bg-amber-50 text-amber-700 ring-1 ring-amber-200"
                      : liveStatus === "fail"
                        ? "bg-red-50 text-red-700 ring-1 ring-red-200"
                        : "bg-zinc-50 text-zinc-500 ring-1 ring-zinc-200")
                }
              >
                {liveStatus === "ok"
                  ? `✓ Live on ${LIVE_HOST}`
                  : liveStatus === "checking"
                    ? `… verifying ${LIVE_HOST}`
                    : liveStatus === "fail"
                      ? `✗ Live check failed`
                      : `· awaiting first save`}
                {liveCheckedAt && liveStatus !== "checking" ? (
                  <span className="opacity-60">
                    {" "}
                    ({new Date(liveCheckedAt).toLocaleTimeString([], {
                      hour: "2-digit",
                      minute: "2-digit",
                      second: "2-digit",
                    })})
                  </span>
                ) : null}
              </span>
            </div>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="text-zinc-400 hover:text-zinc-900"
            >
              ✕
            </button>
          </div>

          <div className="space-y-3">
            <div className="text-[10px] font-semibold uppercase tracking-wider text-zinc-400">
              Headline
            </div>

            <label className="block">
              <div className="flex justify-between text-zinc-600">
                <span>Size</span>
                <span>{local.size}px</span>
              </div>
              <input
                type="range"
                min={16}
                max={96}
                value={local.size}
                onChange={(e) => change({ size: Number(e.target.value) })}
                className="w-full"
              />
            </label>

            <WeightRow
              label="Base weight"
              value={local.weight}
              onChange={(weight) => change({ weight })}
            />

            <label className="block">
              <span className="text-zinc-600">Font</span>
              <select
                value={local.font}
                onChange={(e) => change({ font: e.target.value })}
                className="mt-1 w-full rounded border border-zinc-300 px-2 py-1"
              >
                {FONT_OPTIONS.map((f) => (
                  <option key={f.value} value={f.value}>
                    {f.label}
                  </option>
                ))}
              </select>
            </label>

            <ColorField
              label="Base color"
              value={local.color}
              onChange={(color) => change({ color })}
            />

            <label className="block">
              <div className="flex justify-between text-zinc-600">
                <span>Vertical offset</span>
                <span>{local.offsetY}px</span>
              </div>
              <input
                type="range"
                min={-200}
                max={200}
                step={1}
                value={local.offsetY}
                onChange={(e) => change({ offsetY: Number(e.target.value) })}
                className="w-full"
              />
              <div className="text-[10px] text-zinc-400">Negative = higher above the card.</div>
            </label>



            <hr className="border-zinc-200" />
            <div className="text-[10px] font-semibold uppercase tracking-wider text-zinc-400">
              Accent words ("Get an" / "Vehicle Valuation")
            </div>
            <ColorField
              label="Accent color"
              value={local.accentColor}
              onChange={(accentColor) => change({ accentColor })}
            />
            <WeightRow
              label="Accent weight"
              value={local.accentWeight}
              onChange={(accentWeight) => change({ accentWeight })}
            />

            <hr className="border-zinc-200" />
            <div className="text-[10px] font-semibold uppercase tracking-wider text-zinc-400">
              Action word ("instant")
            </div>
            <ColorField
              label="Instant color"
              value={local.instantColor}
              onChange={(instantColor) => change({ instantColor })}
            />
            <WeightRow
              label="Instant weight"
              value={local.instantWeight}
              onChange={(instantWeight) => change({ instantWeight })}
            />

            <hr className="border-zinc-200" />
            <div className="text-[10px] font-semibold uppercase tracking-wider text-zinc-400">
              Subline
            </div>
            <label className="block">
              <div className="flex justify-between text-zinc-600">
                <span>Size</span>
                <span>{local.subSize}px</span>
              </div>
              <input
                type="range"
                min={10}
                max={32}
                value={local.subSize}
                onChange={(e) => change({ subSize: Number(e.target.value) })}
                className="w-full"
              />
            </label>
            <ColorField
              label="Subline color"
              value={local.subColor}
              onChange={(subColor) => change({ subColor })}
            />
            <label className="block">
              <div className="flex justify-between text-zinc-600">
                <span>Gap to card</span>
                <span>{local.subGap}px</span>
              </div>
              <input
                type="range"
                min={0}
                max={200}
                step={1}
                value={local.subGap}
                onChange={(e) => change({ subGap: Number(e.target.value) })}
                className="w-full"
              />
              <div className="text-[10px] text-zinc-400">Space between subline and the box.</div>
            </label>


            <hr className="border-zinc-200" />
            <div className="text-[10px] font-semibold uppercase tracking-wider text-zinc-400">
              CTA color (tabs + valuation pill)
            </div>
            <ColorField
              label="Background"
              value={local.ctaColor}
              onChange={(ctaColor) => change({ ctaColor })}
            />
            <ColorField
              label="Text"
              value={local.ctaTextColor}
              onChange={(ctaTextColor) => change({ ctaTextColor })}
            />
            <label className="block">
              <div className="flex justify-between text-zinc-600">
                <span>Tab thickness</span>
                <span>{local.tabPadY}px</span>
              </div>
              <input
                type="range"
                min={4}
                max={32}
                step={1}
                value={local.tabPadY}
                onChange={(e) => change({ tabPadY: Number(e.target.value) })}
                className="w-full"
              />
              <div className="text-[10px] text-zinc-400">Vertical padding of VIN / Plate buttons.</div>
            </label>


            <button
              type="button"
              onClick={reset}
              className="w-full rounded border border-zinc-300 py-1.5 text-zinc-700 hover:bg-zinc-50"
            >
              Reset to defaults
            </button>

            <div className="text-[10px] leading-snug text-zinc-400">
              Changes save to the server and update for every visitor in real time.
            </div>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="rounded-full border border-zinc-200 bg-white px-3 py-2 shadow-lg hover:bg-zinc-50"
        >
          🎨 Hero Tuner
        </button>
      )}
    </div>
  );
}
