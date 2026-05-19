import { useEffect, useState } from "react";

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

const STORAGE_KEY = "moto-hero-tuner-v1";

export function useHeroTuner(): HeroTunerValues {
  const [values, setValues] = useState<HeroTunerValues>(DEFAULTS);
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) setValues({ ...DEFAULTS, ...JSON.parse(raw) });
    } catch {}
    const handler = (e: Event) => {
      const detail = (e as CustomEvent<HeroTunerValues>).detail;
      if (detail) setValues(detail);
    };
    window.addEventListener("hero-tuner:change", handler);
    return () => window.removeEventListener("hero-tuner:change", handler);
  }, []);
  return values;
}

export default function HeroTuner() {
  const [open, setOpen] = useState(false);
  const [values, setValues] = useState<HeroTunerValues>(DEFAULTS);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) setValues({ ...DEFAULTS, ...JSON.parse(raw) });
    } catch {}
  }, []);

  const update = (patch: Partial<HeroTunerValues>) => {
    const next = { ...values, ...patch };
    setValues(next);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {}
    window.dispatchEvent(new CustomEvent("hero-tuner:change", { detail: next }));
  };

  const reset = () => {
    setValues(DEFAULTS);
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {}
    window.dispatchEvent(new CustomEvent("hero-tuner:change", { detail: DEFAULTS }));
  };

  return (
    <div className="fixed bottom-4 right-4 z-[9999] font-sans text-xs">
      {open ? (
        <div className="w-72 rounded-lg border border-zinc-200 bg-white p-4 shadow-2xl">
          <div className="mb-3 flex items-center justify-between">
            <span className="font-semibold text-zinc-900">Hero Tuner</span>
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
                <span>{values.size}px</span>
              </div>
              <input
                type="range"
                min={16}
                max={96}
                value={values.size}
                onChange={(e) => update({ size: Number(e.target.value) })}
                className="w-full"
              />
            </label>

            <label className="block">
              <div className="flex justify-between text-zinc-600">
                <span>Headline weight</span>
                <span>{values.weight}</span>
              </div>
              <input
                type="range"
                min={100}
                max={900}
                step={100}
                value={values.weight}
                onChange={(e) => update({ weight: Number(e.target.value) })}
                className="w-full"
              />
            </label>

            <label className="block">
              <span className="text-zinc-600">Font</span>
              <select
                value={values.font}
                onChange={(e) => update({ font: e.target.value })}
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
                value={values.color}
                onChange={(e) => update({ color: e.target.value })}
                className="h-7 w-12 cursor-pointer rounded border border-zinc-300"
              />
            </label>

            <hr className="border-zinc-200" />

            <label className="block">
              <div className="flex justify-between text-zinc-600">
                <span>Subline size</span>
                <span>{values.subSize}px</span>
              </div>
              <input
                type="range"
                min={10}
                max={32}
                value={values.subSize}
                onChange={(e) => update({ subSize: Number(e.target.value) })}
                className="w-full"
              />
            </label>

            <label className="flex items-center justify-between">
              <span className="text-zinc-600">Subline color</span>
              <input
                type="color"
                value={values.subColor}
                onChange={(e) => update({ subColor: e.target.value })}
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
