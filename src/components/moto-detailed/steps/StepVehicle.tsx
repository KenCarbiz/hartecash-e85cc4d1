import { useState } from "react";
import { Search, Loader2 } from "lucide-react";
import PrimaryCTA from "../PrimaryCTA";
import type { StepContext, JourneyValuation } from "../types";

/**
 * Stub: in production, replace with the bb-lookup edge function call.
 * Returns a believable range so the customer sees momentum immediately.
 */
const fakeLookup = async (year: string, make: string, model: string): Promise<JourneyValuation> => {
  await new Promise((r) => setTimeout(r, 900));
  const base = 18000 + (parseInt(year || "2020", 10) - 2015) * 600;
  return {
    low: Math.round(base * 0.92),
    high: Math.round(base * 1.08),
    confidence: "medium",
    marketStrength: "balanced",
    trend: [0.45, 0.5, 0.48, 0.55, 0.6, 0.58, 0.65, 0.7],
  };
};

const StepVehicle = ({ state, update, next }: StepContext) => {
  const [year, setYear] = useState(state.vehicle?.year ?? "");
  const [make, setMake] = useState(state.vehicle?.make ?? "");
  const [model, setModel] = useState(state.vehicle?.model ?? "");
  const [trim, setTrim] = useState(state.vehicle?.trim ?? "");
  const [busy, setBusy] = useState(false);

  const valid = year.length === 4 && make && model;

  const submit = async () => {
    if (!valid) return;
    setBusy(true);
    update({ vehicle: { year, make, model, trim } });
    const valuation = await fakeLookup(year, make, model);
    update({ valuation });
    setBusy(false);
    next();
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="Year" value={year} onChange={setYear} placeholder="2021" />
        <Field label="Make" value={make} onChange={setMake} placeholder="Toyota" />
        <Field label="Model" value={model} onChange={setModel} placeholder="Camry" />
        <Field label="Trim (optional)" value={trim} onChange={setTrim} placeholder="SE" />
      </div>

      <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-4 text-sm text-zinc-600">
        <div className="flex items-center gap-2">
          <Search className="h-4 w-4 text-zinc-400" />
          Prefer to use a VIN or license plate? Both work — and return the most accurate value.
        </div>
      </div>

      <PrimaryCTA onClick={submit} disabled={!valid || busy}>
        {busy ? (
          <span className="inline-flex items-center gap-2">
            <Loader2 className="h-4 w-4 animate-spin" /> Finding your value…
          </span>
        ) : (
          "Next"
        )}
      </PrimaryCTA>
    </div>
  );
};

const Field = ({
  label, value, onChange, placeholder,
}: {
  label: string; value: string; onChange: (v: string) => void; placeholder?: string;
}) => (
  <label className="block">
    <span className="mb-1.5 block text-sm font-medium text-zinc-700">{label}</span>
    <input
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className="w-full rounded-xl border border-zinc-200 bg-white px-4 py-3 text-base text-zinc-900 outline-none transition-all placeholder:text-zinc-400 focus:border-[hsl(262_83%_58%)] focus:ring-4 focus:ring-[hsl(262_83%_58%/0.1)]"
    />
  </label>
);

export default StepVehicle;
