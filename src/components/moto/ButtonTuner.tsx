import { useEffect, useState } from "react";
import { useTenant } from "@/contexts/TenantContext";
import { useTunerConfig } from "./useTunerConfig";

export type ButtonTunerValues = {
  // tab buttons (Vehicle Search / License Plate)
  tabActiveBg: string;
  tabActiveText: string;
  tabInactiveText: string;
  tabRadius: number;
  tabFontSize: number;
  tabFontWeight: number;
  // primary submit button (Next)
  nextBg: string;
  nextText: string;
  nextRadius: number;
  nextFontSize: number;
  nextFontWeight: number;
  // valuation badge ("Get a valuation in less than 30 seconds!")
  badgeBg: string;
  badgeText: string;
  badgeRadius: number;
  badgeFontSize: number;
  badgeFontWeight: number;
};

export const BUTTON_DEFAULTS: ButtonTunerValues = {
  tabActiveBg: "#0c5ce8",
  tabActiveText: "#ffffff",
  tabInactiveText: "#3f3f46",
  tabRadius: 6,
  tabFontSize: 14,
  tabFontWeight: 600,

  nextBg: "#f4f4f5",
  nextText: "#3f3f46",
  nextRadius: 9999,
  nextFontSize: 14,
  nextFontWeight: 600,

  badgeBg: "#f4f4f5",
  badgeText: "#3f3f46",
  badgeRadius: 6,
  badgeFontSize: 14,
  badgeFontWeight: 600,
};

function merge(remote: unknown): ButtonTunerValues {
  if (!remote || typeof remote !== "object") return BUTTON_DEFAULTS;
  return { ...BUTTON_DEFAULTS, ...(remote as Partial<ButtonTunerValues>) };
}

export function useButtonTuner(): ButtonTunerValues {
  const { tenant } = useTenant();
  const { config } = useTunerConfig(tenant.dealership_id);
  return merge(config.buttons);
}

type FieldKey = keyof ButtonTunerValues;

const SECTIONS: {
  title: string;
  rows: { key: FieldKey; label: string; type: "color" | "range"; min?: number; max?: number; step?: number }[];
}[] = [
  {
    title: "Tab buttons",
    rows: [
      { key: "tabActiveBg", label: "Active bg", type: "color" },
      { key: "tabActiveText", label: "Active text", type: "color" },
      { key: "tabInactiveText", label: "Inactive text", type: "color" },
      { key: "tabRadius", label: "Radius", type: "range", min: 0, max: 32 },
      { key: "tabFontSize", label: "Font size", type: "range", min: 10, max: 22 },
      { key: "tabFontWeight", label: "Weight", type: "range", min: 100, max: 900, step: 100 },
    ],
  },
  {
    title: "Next button",
    rows: [
      { key: "nextBg", label: "Bg", type: "color" },
      { key: "nextText", label: "Text", type: "color" },
      { key: "nextRadius", label: "Radius", type: "range", min: 0, max: 9999 },
      { key: "nextFontSize", label: "Font size", type: "range", min: 10, max: 22 },
      { key: "nextFontWeight", label: "Weight", type: "range", min: 100, max: 900, step: 100 },
    ],
  },
  {
    title: "Valuation badge",
    rows: [
      { key: "badgeBg", label: "Bg", type: "color" },
      { key: "badgeText", label: "Text", type: "color" },
      { key: "badgeRadius", label: "Radius", type: "range", min: 0, max: 32 },
      { key: "badgeFontSize", label: "Font size", type: "range", min: 10, max: 22 },
      { key: "badgeFontWeight", label: "Weight", type: "range", min: 100, max: 900, step: 100 },
    ],
  },
];

export default function ButtonTuner() {
  const { tenant } = useTenant();
  const { config, update } = useTunerConfig(tenant.dealership_id);
  const values = merge(config.buttons);
  const [open, setOpen] = useState(false);
  const [local, setLocal] = useState<ButtonTunerValues>(values);

  useEffect(() => {
    setLocal(values);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(values)]);

  const change = (patch: Partial<ButtonTunerValues>) => {
    const next = { ...local, ...patch };
    setLocal(next);
    update("buttons", next as unknown as Record<string, unknown>);
  };

  const reset = () => {
    setLocal(BUTTON_DEFAULTS);
    update("buttons", BUTTON_DEFAULTS as unknown as Record<string, unknown>);
  };

  return (
    <div className="fixed bottom-4 right-[22rem] z-[9999] font-sans text-xs">
      {open ? (
        <div className="max-h-[80vh] w-72 overflow-y-auto rounded-lg border border-zinc-200 bg-white p-4 shadow-2xl">
          <div className="mb-3 flex items-center justify-between">
            <span className="font-semibold text-zinc-900">
              Button Tuner <span className="text-zinc-400">(synced)</span>
            </span>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="text-zinc-400 hover:text-zinc-900"
            >
              ✕
            </button>
          </div>

          <div className="space-y-4">
            {SECTIONS.map((section) => (
              <div key={section.title}>
                <div className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
                  {section.title}
                </div>
                <div className="space-y-2">
                  {section.rows.map((row) =>
                    row.type === "color" ? (
                      <label key={row.key} className="flex items-center justify-between">
                        <span className="text-zinc-600">{row.label}</span>
                        <input
                          type="color"
                          value={local[row.key] as string}
                          onChange={(e) => change({ [row.key]: e.target.value } as Partial<ButtonTunerValues>)}
                          className="h-7 w-12 cursor-pointer rounded border border-zinc-300"
                        />
                      </label>
                    ) : (
                      <label key={row.key} className="block">
                        <div className="flex justify-between text-zinc-600">
                          <span>{row.label}</span>
                          <span>{local[row.key] as number}</span>
                        </div>
                        <input
                          type="range"
                          min={row.min}
                          max={row.max}
                          step={row.step ?? 1}
                          value={local[row.key] as number}
                          onChange={(e) =>
                            change({ [row.key]: Number(e.target.value) } as Partial<ButtonTunerValues>)
                          }
                          className="w-full"
                        />
                      </label>
                    ),
                  )}
                </div>
              </div>
            ))}

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
          🔘 Button Tuner
        </button>
      )}
    </div>
  );
}
