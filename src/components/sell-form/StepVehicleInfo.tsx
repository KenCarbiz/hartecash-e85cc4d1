import { useState } from "react";
import { Loader2, CheckCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import FormField from "./FormField";
import BBVehicleCard from "./BBVehicleCard";
import type { FormData, VehicleInfo, BBVehicle } from "./types";

interface Props {
  formData: FormData;
  update: (field: string, value: string) => void;
  vehicleInfo: VehicleInfo | null;
  setVehicleInfo: (v: VehicleInfo | null) => void;
  bbSelectedVehicle?: BBVehicle | null;
}

const decodeVin = async (vin: string): Promise<VehicleInfo | null> => {
  try {
    const res = await fetch(
      `https://vpic.nhtsa.dot.gov/api/vehicles/decodevin/${encodeURIComponent(vin)}?format=json`
    );
    const data = await res.json();
    const results = data.Results as { Variable: string; Value: string | null }[];
    const get = (name: string) =>
      results.find((r) => r.Variable === name)?.Value || "";
    const year = get("Model Year");
    const make = get("Make");
    const model = get("Model");
    if (year && make && model) return { year, make, model };
    return null;
  } catch {
    return null;
  }
};

const StepVehicleInfo = ({ formData, update, vehicleInfo, setVehicleInfo, bbSelectedVehicle }: Props) => {
  const [activeTab, setActiveTab] = useState<"vin" | "plate" | "ymm">("vin");
  const [vinLoading, setVinLoading] = useState(false);
  const [vinError, setVinError] = useState("");

  const handleVinLookup = async () => {
    const vin = formData.vin.trim();
    if (vin.length !== 17) {
      setVinError("VIN must be exactly 17 characters.");
      return;
    }
    setVinError("");
    setVinLoading(true);
    setVehicleInfo(null);
    const info = await decodeVin(vin);
    setVinLoading(false);
    if (info) setVehicleInfo(info);
    else setVinError("Could not decode this VIN. Please check and try again.");
  };

  return (
    <>
      <div className="flex gap-2 mb-6 border-b-2 border-muted">
        <button
          type="button"
          onClick={() => { setActiveTab("plate"); setVehicleInfo(null); setVinError(""); }}
          className={`flex-1 py-3 text-[15px] font-semibold border-b-[3px] -mb-[2px] transition-all ${
            activeTab === "plate" ? "text-accent border-accent" : "text-muted-foreground border-transparent"
          }`}
        >
          License Plate
        </button>
        <button
          type="button"
          onClick={() => { setActiveTab("vin"); setVehicleInfo(null); setVinError(""); }}
          className={`flex-1 py-3 text-[15px] font-semibold border-b-[3px] -mb-[2px] transition-all ${
            activeTab === "vin" ? "text-accent border-accent" : "text-muted-foreground border-transparent"
          }`}
        >
          VIN Number
        </button>
        <button
          type="button"
          onClick={() => { setActiveTab("ymm"); setVehicleInfo(null); setVinError(""); }}
          className={`flex-1 py-3 text-[15px] font-semibold border-b-[3px] -mb-[2px] transition-all ${
            activeTab === "ymm" ? "text-accent border-accent" : "text-muted-foreground border-transparent"
          }`}
        >
          Year / Make
        </button>
      </div>

      {activeTab === "plate" ? (
        <>
          <FormField label="License Plate Number">
            <Input
              placeholder="Enter plate number"
              value={formData.plate}
              onChange={(e) => update("plate", e.target.value)}
              className="py-3.5 px-4 text-base border-2 border-input focus:border-accent focus:ring-accent/10"
            />
          </FormField>
          <FormField label="State">
            <Input
              placeholder="e.g. CT"
              value={formData.state}
              onChange={(e) => update("state", e.target.value)}
              className="py-3.5 px-4 text-base border-2 border-input focus:border-accent focus:ring-accent/10"
            />
          </FormField>
          {bbSelectedVehicle && <BBVehicleCard vehicle={bbSelectedVehicle} />}
        </>
      ) : activeTab === "ymm" ? (
        <>
          <p className="text-sm text-muted-foreground mb-4">
            Don't have your VIN or plate handy? Enter your vehicle details manually.
          </p>
          <FormField label="Year">
            <Input
              placeholder="e.g. 2021"
              value={formData.manualYear || ""}
              onChange={(e) => {
                const val = e.target.value.replace(/\D/g, "").slice(0, 4);
                update("manualYear", val);
                if (val.length === 4 && formData.manualMake && formData.manualModel) {
                  setVehicleInfo({ year: val, make: formData.manualMake, model: formData.manualModel });
                }
              }}
              maxLength={4}
              className="py-3.5 px-4 text-base border-2 border-input focus:border-accent focus:ring-accent/10"
            />
          </FormField>
          <FormField label="Make">
            <Input
              placeholder="e.g. Toyota"
              value={formData.manualMake || ""}
              onChange={(e) => {
                update("manualMake", e.target.value);
                if (formData.manualYear?.length === 4 && e.target.value && formData.manualModel) {
                  setVehicleInfo({ year: formData.manualYear, make: e.target.value, model: formData.manualModel });
                }
              }}
              className="py-3.5 px-4 text-base border-2 border-input focus:border-accent focus:ring-accent/10"
            />
          </FormField>
          <FormField label="Model">
            <Input
              placeholder="e.g. Camry"
              value={formData.manualModel || ""}
              onChange={(e) => {
                update("manualModel", e.target.value);
                if (formData.manualYear?.length === 4 && formData.manualMake && e.target.value) {
                  setVehicleInfo({ year: formData.manualYear, make: formData.manualMake, model: e.target.value });
                }
              }}
              className="py-3.5 px-4 text-base border-2 border-input focus:border-accent focus:ring-accent/10"
            />
          </FormField>
          {vehicleInfo && (
            <div className="mb-5 p-4 bg-success/10 border border-success/30 rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                <CheckCircle className="w-5 h-5 text-success" />
                <span className="text-sm font-bold text-card-foreground">Vehicle Set</span>
              </div>
              <p className="text-base font-semibold text-card-foreground">
                {vehicleInfo.year} {vehicleInfo.make} {vehicleInfo.model}
              </p>
              <p className="text-[11px] text-muted-foreground mt-1">
                For the most accurate offer, try using your VIN instead.
              </p>
            </div>
          )}
        </>
      ) : (
        <>
          <FormField label="VIN Number">
            <div className="flex gap-2">
              <Input
                placeholder="Enter 17-character VIN"
                value={formData.vin}
                onChange={(e) => {
                  const val = e.target.value.toUpperCase();
                  update("vin", val);
                  setVehicleInfo(null);
                  setVinError("");
                  if (val.trim().length === 17 && !vinLoading) {
                    setTimeout(async () => {
                      setVinLoading(true);
                      setVehicleInfo(null);
                      const info = await decodeVin(val.trim());
                      setVinLoading(false);
                      if (info) setVehicleInfo(info);
                      else setVinError("Could not decode this VIN. Please check and try again.");
                    }, 0);
                  }
                }}
                maxLength={17}
                className={`py-3.5 px-4 text-base border-2 border-input focus:border-accent focus:ring-accent/10 flex-1 transition-all duration-300 ${
                  formData.vin.trim().length === 17 ? "vin-glow" : ""
                }`}
              />
              <Button
                type="button"
                onClick={handleVinLookup}
                disabled={vinLoading || formData.vin.trim().length === 0}
                className="bg-primary hover:bg-primary/90 text-primary-foreground px-4 shrink-0"
              >
                {vinLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Lookup"}
              </Button>
            </div>
            {vinError && <p className="text-destructive text-sm mt-2">{vinError}</p>}
          </FormField>

          {bbSelectedVehicle ? (
            <BBVehicleCard vehicle={bbSelectedVehicle} />
          ) : vehicleInfo ? (
            <div className="mb-5 p-4 bg-success/10 border border-success/30 rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                <CheckCircle className="w-5 h-5 text-success" />
                <span className="text-sm font-bold text-card-foreground">Vehicle Found</span>
              </div>
              <p className="text-base font-semibold text-card-foreground">
                {vehicleInfo.year} {vehicleInfo.make} {vehicleInfo.model}
              </p>
            </div>
          ) : null}
        </>
      )}
    </>
  );
};

export default StepVehicleInfo;
