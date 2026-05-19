import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useTenant } from "@/contexts/TenantContext";
import MotoCard from "../MotoCard";
import MotoPrimaryButton from "../MotoPrimaryButton";
import { MotoOutlinedInput, MotoOutlinedSelect } from "../MotoOutlinedField";
import type { LookupMode, MotoFlowState } from "../types";
import type { BBVehicle } from "@/components/sell-form/types";
import { fetchModelsForMakeYear, MAKE_OPTIONS, YEAR_OPTIONS } from "../ymmData";
import { cn } from "@/lib/utils";

const US_STATES = [
  "AL","AK","AZ","AR","CA","CO","CT","DE","FL","GA","HI","ID","IL","IN","IA","KS","KY","LA","ME","MD","MA","MI","MN","MS","MO","MT","NE","NV","NH","NJ","NM","NY","NC","ND","OH","OK","OR","PA","RI","SC","SD","TN","TX","UT","VT","VA","WA","WV","WI","WY",
].map((s) => ({ value: s, label: s }));

const TABS: { id: Exclude<LookupMode, "ymm">; label: string }[] = [
  { id: "vin", label: "Vehicle Search" },
  { id: "plate", label: "License Plate" },
];

const MotoStepVehicleSearch = ({
  state,
  onResolved,
}: {
  state: MotoFlowState;
  onResolved: (next: Partial<MotoFlowState>) => void;
}) => {
  const { tenant } = useTenant();
  const dealershipId = tenant.dealership_id;
  const { toast } = useToast();

  const [tab, setTab] = useState<Exclude<LookupMode, "ymm">>(
    state.lookupMode === "plate" ? "plate" : "vin",
  );
  const [year, setYear] = useState(state.ymm.year);
  const [make, setMake] = useState(state.ymm.make);
  const [model, setModel] = useState(state.ymm.model);
  const [trim, setTrim] = useState(state.ymm.trim);
  const [modelOptions, setModelOptions] = useState<{ value: string; label: string }[]>([]);
  const [modelsLoading, setModelsLoading] = useState(false);

  const [vin, setVin] = useState(state.vin);
  const [plate, setPlate] = useState(state.plate);
  const [plateState, setPlateState] = useState(state.plateState || "");
  const [loading, setLoading] = useState(false);

  // Load model options whenever Year + Make change.
  useEffect(() => {
    let cancelled = false;
    if (!year || !make) {
      setModelOptions([]);
      return;
    }
    setModelsLoading(true);
    fetchModelsForMakeYear(make, year).then((opts) => {
      if (cancelled) return;
      setModelOptions(opts);
      setModelsLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [year, make]);

  const vinClean = vin.trim().toUpperCase();
  const plateClean = plate.trim().toUpperCase();

  const ymmReady = !!year && !!make && !!model;
  const vinReady = vinClean.length === 17;
  const plateReady = plateClean.length >= 2 && !!plateState;
  const canSubmit = tab === "vin" ? vinReady || ymmReady : plateReady;

  const submit = async () => {
    setLoading(true);
    try {
      if (tab === "vin" && vinReady) {
        const { data, error } = await supabase.functions.invoke("bb-lookup", {
          body: { lookup_type: "vin", vin: vinClean, dealership_id: dealershipId },
        });
        if (error || data?.error || !data?.vehicles?.length) {
          toast({
            title: "Couldn't decode that VIN",
            description: "Double-check the VIN or use Year / Make / Model.",
            variant: "destructive",
          });
          return;
        }
        const bb = data.vehicles[0] as BBVehicle;
        onResolved({ lookupMode: "vin", vin: vinClean, bbVehicle: bb, step: "condition" });
        return;
      }

      if (tab === "vin" && ymmReady) {
        const stub: BBVehicle = {
          uvc: "", vin: "",
          year, make, model, series: trim, style: "", class_name: "",
          msrp: 0, price_includes: "",
          drivetrain: "", transmission: "", engine: "", fuel_type: "",
          exterior_colors: [],
          mileage_adj: 0, regional_adj: 0, base_whole_avg: 0,
          add_deduct_list: [],
          wholesale: { xclean: 0, clean: 0, avg: 0, rough: 0 },
          tradein: { clean: 0, avg: 0, rough: 0 },
          retail: { xclean: 0, clean: 0, avg: 0, rough: 0 },
          _nhtsa: true,
        };
        onResolved({
          lookupMode: "ymm",
          ymm: { year, make, model, trim },
          bbVehicle: stub,
          step: "condition",
        });
        return;
      }

      if (tab === "plate") {
        const { data, error } = await supabase.functions.invoke("bb-lookup", {
          body: { lookup_type: "plate", plate: plateClean, state: plateState, dealership_id: dealershipId },
        });
        if (error || data?.error || !data?.vehicles?.length) {
          toast({
            title: "Plate lookup unavailable",
            description: "Try VIN or Year / Make / Model.",
            variant: "destructive",
          });
          return;
        }
        const bb = data.vehicles[0] as BBVehicle;
        onResolved({
          lookupMode: "plate",
          plate: plateClean,
          plateState,
          vin: bb.vin || "",
          bbVehicle: bb,
          step: "condition",
        });
      }
    } catch (e) {
      console.error(e);
      toast({ title: "Something went wrong", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <h1 className="mt-1 text-4xl font-extrabold leading-[1.05] tracking-tight text-zinc-900">
        Get an Instant{" "}
        <span className="text-[hsl(var(--cta-offer))]">Vehicle Valuation</span>
      </h1>
      <p className="mt-3 text-base text-zinc-500">
        Get an instant valuation &amp; then add more info to get a firm offer.
      </p>

      <MotoCard className="mt-6">
        <div className="mb-5 grid grid-cols-2 gap-3 text-sm font-semibold">
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={cn(
                "rounded-lg py-3 border transition",
                tab === t.id
                  ? "bg-[hsl(var(--cta-offer))] text-[color:var(--cta-offer-text)] border-transparent shadow-sm"
                  : "bg-white text-zinc-700 border-zinc-200 hover:bg-zinc-50",
              )}
            >
              {t.label}
            </button>
          ))}
        </div>

        {tab === "vin" && (
          <div className="space-y-4">
            <MotoOutlinedSelect
              label="Vehicle Year"
              value={year}
              onChange={(e) => {
                setYear(e.target.value);
                setMake("");
                setModel("");
                setTrim("");
              }}
              options={YEAR_OPTIONS}
            />
            {year && (
              <MotoOutlinedSelect
                label="Vehicle Make"
                value={make}
                onChange={(e) => {
                  setMake(e.target.value);
                  setModel("");
                  setTrim("");
                }}
                options={MAKE_OPTIONS}
              />
            )}
            {year && make && (
              <MotoOutlinedSelect
                label={modelsLoading ? "Vehicle Model (loading…)" : "Vehicle Model"}
                value={model}
                onChange={(e) => {
                  setModel(e.target.value);
                  setTrim("");
                }}
                options={modelOptions}
                disabled={modelsLoading || modelOptions.length === 0}
              />
            )}
            {year && make && model && (
              <MotoOutlinedInput
                label="Vehicle Trim"
                value={trim}
                onChange={(e) => setTrim(e.target.value)}
                placeholder="e.g. EX-L, Sport, Premium Luxury"
              />
            )}
            <div className="flex items-center gap-3 text-xs font-semibold uppercase tracking-wider text-zinc-400">
              <span className="h-px flex-1 bg-zinc-200" />
              OR
              <span className="h-px flex-1 bg-zinc-200" />
            </div>
            <MotoOutlinedInput
              label="VIN"
              value={vin}
              onChange={(e) => setVin(e.target.value.toUpperCase())}
              maxLength={17}
              autoComplete="off"
              placeholder="17-character VIN"
            />
          </div>
        )}

        {tab === "plate" && (
          <div className="space-y-4">
            <MotoOutlinedInput
              label="License Plate*"
              value={plate}
              onChange={(e) => setPlate(e.target.value.toUpperCase())}
              autoComplete="off"
            />
            <MotoOutlinedSelect
              label="State*"
              value={plateState}
              onChange={(e) => setPlateState(e.target.value)}
              options={US_STATES}
            />
          </div>
        )}

        <div className="mt-5 flex justify-center">
          <MotoPrimaryButton
            className="w-auto px-10 py-2.5 rounded-lg text-sm"
            onClick={submit}
            disabled={!canSubmit}
            loading={loading}
          >
            Next
          </MotoPrimaryButton>
        </div>
      </MotoCard>

      <div className="mt-4 rounded-md bg-zinc-50 py-3 text-center text-sm font-semibold text-[hsl(var(--cta-offer))]">
        Get a valuation in less than 30 seconds!
      </div>
    </>
  );
};

export default MotoStepVehicleSearch;
