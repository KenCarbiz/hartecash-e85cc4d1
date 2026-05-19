import { useEffect, useState } from "react";
import { useTenant } from "@/contexts/TenantContext";
import { useTunerConfig } from "./useTunerConfig";

export type HeroTunerValues = {
  size: number; // px
  weight: number; // 100-900
  color: string; // hex
  subSize: number; // px
  subColor: string; // hex
  font: string; // css font-family value
};

const FONT_OPTIONS = [
  { label: "Inter (default)", value: "Inter, system-ui, sans-serif" },
  { label: "DM Serif Display", value: '"DM Serif Display", serif' },
  { label: "Georgia Serif", value: 'Georgia, "Times New Roman", serif' },
  { label: "System Sans", value: "system-ui, -apple-system, sans-serif" },
  { label: "Helvetica", value: '"Helvetica Neue", Helvetica, Arial, sans-serif' },
  { label: "Mono", value: '"JetBrains Mono", ui-monospace, monospace' },
];

const DEFAULTS: HeroTunerValues = {
  size: 36,
  weight: 300,
  color: "#18181b",
  subSize: 16,
  subColor: "#71717a",
  font: FONT_OPTIONS[0].value,
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

export default function HeroTuner() {
  const { tenant } = useTenant();
  const { config, update } = useTunerConfig(tenant.dealership_id);
  const values = merge(config.hero);
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
        <div className="w-72 rounded-lg border border-zinc-200 bg-white p-4 shadow-2xl">
          <div className="mb-3 flex items-center justify-between">
            <span className="font-semibold text-zinc-900">
              Hero Tuner <span className="text-zinc-400">(synced)</span>
            </span>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="text-zinc-400 hover:text-zinc-900"
            >
              ✕
            </button>
          </div>

          <div className="space-y-3">
            <label className="block">
              <div className="flex justify-between text-zinc-600">
                <span>Headline size</span>
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

            <label className="block">
              <div className="flex justify-between text-zinc-600">
                <span>Headline weight</span>
                <span>{local.weight}</span>
              </div>
              <input
                type="range"
                min={100}
                max={900}
                step={100}
                value={local.weight}
                onChange={(e) => change({ weight: Number(e.target.value) })}
                className="w-full"
              />
            </label>

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

            <label className="flex items-center justify-between">
              <span className="text-zinc-600">Headline color</span>
              <input
                type="color"
                value={local.color}
                onChange={(e) => change({ color: e.target.value })}
                className="h-7 w-12 cursor-pointer rounded border border-zinc-300"
              />
            </label>

            <hr className="border-zinc-200" />

            <label className="block">
              <div className="flex justify-between text-zinc-600">
                <span>Subline size</span>
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

            <label className="flex items-center justify-between">
              <span className="text-zinc-600">Subline color</span>
              <input
                type="color"
                value={local.subColor}
                onChange={(e) => change({ subColor: e.target.value })}
                className="h-7 w-12 cursor-pointer rounded border border-zinc-300"
              />
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
