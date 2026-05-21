import { useState } from "react";
import { Search, Loader2 } from "lucide-react";
import PrimaryCTA from "../PrimaryCTA";
import type { StepContext } from "../types";
import { defaultBlackBookAdapter, buildVehicleFromInput, type ValuationAdapter } from "../blackbookAdapter";
import { trackCtaClicked } from "../analytics";

/**
 * Vehicle Search step. Calls a pluggable valuation adapter (default:
 * stub; production: bb-lookup edge function via blackbookAdapter).
 * Once a range returns it is written to state.valuation and surfaces
 * immediately in SummaryPanel + later steps.
 */
const StepVehicle = ({ state, update, next, lookup = defaultBlackBookAdapter }: StepContext & { lookup?: ValuationAdapter }) => {
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
