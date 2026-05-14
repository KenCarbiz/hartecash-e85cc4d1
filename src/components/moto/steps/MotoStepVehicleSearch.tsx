import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useSiteConfig } from "@/hooks/useSiteConfig";
import { useTenant } from "@/contexts/TenantContext";
import MotoCard from "../MotoCard";
import MotoFormField from "../MotoFormField";
import MotoPrimaryButton from "../MotoPrimaryButton";
import type { LookupMode, MotoFlowState } from "../types";
import type { BBVehicle } from "@/components/sell-form/types";
import { cn } from "@/lib/utils";

const US_STATES = [
  "AL","AK","AZ","AR","CA","CO","CT","DE","FL","GA","HI","ID","IL","IN","IA","KS","KY","LA","ME","MD","MA","MI","MN","MS","MO","MT","NE","NV","NH","NJ","NM","NY","NC","ND","OH","OK","OR","PA","RI","SC","SD","TN","TX","UT","VT","VA","WA","WV","WI","WY",
];

const TABS: { id: LookupMode; label: string }[] = [
  { id: "vin", label: "VIN" },
  { id: "plate", label: "License Plate" },
  { id: "ymm", label: "Year / Make / Model" },
];

const MotoStepVehicleSearch = ({
  state,
  onResolved,
}: {
  state: MotoFlowState;
  onResolved: (next: Partial<MotoFlowState>) => void;
}) => {
  const { config } = useSiteConfig();
  const { tenant } = useTenant();
  const dealershipId = tenant.dealership_id;
  const { toast } = useToast();
  const [mode, setMode] = useState<LookupMode>(state.lookupMode);
  const [vin, setVin] = useState(state.vin);
  const [plate, setPlate] = useState(state.plate);
  const [plateState, setPlateState] = useState(state.plateState || "");
  const [ymm, setYmm] = useState(state.ymm);
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    setLoading(true);
    try {
      if (mode === "vin") {
        const cleanVin = vin.trim().toUpperCase();
        if (cleanVin.length !== 17) {
          toast({ title: "VIN must be 17 characters", variant: "destructive" });
          return;
        }
        const { data, error } = await supabase.functions.invoke("bb-lookup", {
          body: {
            lookup_type: "vin",
            vin: cleanVin,
            dealership_id: dealershipId,
          },
        });
        if (error || data?.error || !data?.vehicles?.length) {
          toast({
            title: "Couldn't decode that VIN",
            description: "Double-check the VIN or try plate / year-make-model.",
            variant: "destructive",
          });
          return;
        }
        const bb = data.vehicles[0] as BBVehicle;
        onResolved({
          lookupMode: "vin",
          vin: cleanVin,
          bbVehicle: bb,
          step: "condition",
        });
      } else if (mode === "plate") {
        const cleanPlate = plate.trim().toUpperCase();
        if (!cleanPlate || !plateState) {
          toast({ title: "Plate + state required", variant: "destructive" });
          return;
        }
        const { data, error } = await supabase.functions.invoke("bb-lookup", {
          body: {
            lookup_type: "plate",
            plate: cleanPlate,
            state: plateState,
            dealership_id: dealershipId,
          },
        });
        if (error || data?.error || !data?.vehicles?.length) {
          toast({
            title: "Plate lookup unavailable",
            description: "Try VIN or year-make-model.",
            variant: "destructive",
          });
          return;
        }
        const bb = data.vehicles[0] as BBVehicle;
        onResolved({
          lookupMode: "plate",
          plate: cleanPlate,
          plateState,
          vin: bb.vin || "",
          bbVehicle: bb,
          step: "condition",
        });
      } else {
        if (!ymm.year || !ymm.make || !ymm.model) {
          toast({ title: "Year, make, and model required", variant: "destructive" });
          return;
        }
        // YMM has no BB lookup — synthesize a partial BBVehicle so
        // the rest of the flow still shows a hero image. The offer
        // step will route to AI photo appraisal because there's no
        // pricing baseline.
        const stub: BBVehicle = {
          uvc: "",
          vin: "",
          year: ymm.year,
          make: ymm.make,
          model: ymm.model,
          series: ymm.trim,
          style: "",
          class_name: "",
          msrp: 0,
          price_includes: "",
          drivetrain: "",
          transmission: "",
          engine: "",
          fuel_type: "",
          exterior_colors: [],
          mileage_adj: 0,
          regional_adj: 0,
          base_whole_avg: 0,
          add_deduct_list: [],
          wholesale: { xclean: 0, clean: 0, avg: 0, rough: 0 },
          tradein: { clean: 0, avg: 0, rough: 0 },
          retail: { xclean: 0, clean: 0, avg: 0, rough: 0 },
          _nhtsa: true,
        };
        onResolved({
          lookupMode: "ymm",
          ymm,
          bbVehicle: stub,
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
      <h1 className="mb-1 text-2xl font-bold tracking-tight text-zinc-900">
        Get your offer in 60 seconds
      </h1>
      <p className="mb-5 text-sm text-zinc-600">
        Start with VIN, license plate, or year-make-model. {config.dealership_name || "Your dealer"} handles
        the rest.
      </p>

      <div className="mb-4 grid grid-cols-3 rounded-lg border border-zinc-200 bg-zinc-100 p-1 text-sm font-medium">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setMode(t.id)}
            className={cn(
              "rounded-md py-2 transition",
              mode === t.id
                ? "bg-white text-zinc-900 shadow-sm"
                : "text-zinc-600 hover:text-zinc-800",
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      <MotoCard>
        {mode === "vin" && (
          <MotoFormField
            label="VIN"
            placeholder="17 characters"
            value={vin}
            onChange={(e) => setVin(e.target.value.toUpperCase())}
            maxLength={17}
            autoComplete="off"
            hint="Find your VIN on the dashboard near the windshield or on your registration."
          />
        )}
        {mode === "plate" && (
          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-2">
              <MotoFormField
                label="License Plate"
                value={plate}
                onChange={(e) => setPlate(e.target.value.toUpperCase())}
                autoComplete="off"
              />
            </div>
            <div>
              <label className="block">
                <span className="mb-1 block text-xs font-medium text-zinc-600">State</span>
                <select
                  value={plateState}
                  onChange={(e) => setPlateState(e.target.value)}
                  className="w-full rounded-md border border-zinc-300 bg-white px-3 py-3 text-base outline-none focus:border-[hsl(var(--cta-offer))] focus:ring-2 focus:ring-[hsl(var(--cta-offer)/0.15)]"
                >
                  <option value="">—</option>
                  {US_STATES.map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </label>
            </div>
          </div>
        )}
        {mode === "ymm" && (
          <div className="grid grid-cols-2 gap-3">
            <MotoFormField
              label="Year"
              inputMode="numeric"
              value={ymm.year}
              onChange={(e) => setYmm({ ...ymm, year: e.target.value.replace(/\D/g, "").slice(0, 4) })}
              maxLength={4}
              placeholder="2022"
            />
            <MotoFormField
              label="Make"
              value={ymm.make}
              onChange={(e) => setYmm({ ...ymm, make: e.target.value })}
              placeholder="Honda"
            />
            <MotoFormField
              label="Model"
              value={ymm.model}
              onChange={(e) => setYmm({ ...ymm, model: e.target.value })}
              placeholder="Accord"
            />
            <MotoFormField
              label="Trim (optional)"
              value={ymm.trim}
              onChange={(e) => setYmm({ ...ymm, trim: e.target.value })}
              placeholder="EX-L"
            />
          </div>
        )}
      </MotoCard>

      <div className="mt-5">
        <MotoPrimaryButton onClick={submit} loading={loading}>
          Get My Offer
        </MotoPrimaryButton>
      </div>
    </>
  );
};

export default MotoStepVehicleSearch;
