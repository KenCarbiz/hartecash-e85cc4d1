import { useState } from "react";
import { Loader2, CheckCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import FormField from "./FormField";
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
  const [activeTab, setActiveTab] = useState<"vin" | "plate">("vin");
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

  // Get BB options from selected vehicle
  const bbOptions = bbSelectedVehicle?.add_deduct_list || [];
  const detectedOptions = bbOptions.filter(o => o.auto !== "N");
  const availableAddOns = bbOptions.filter(o => o.auto === "N");

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
          onClick={() => setActiveTab("vin")}
          className={`flex-1 py-3 text-[15px] font-semibold border-b-[3px] -mb-[2px] transition-all ${
            activeTab === "vin" ? "text-accent border-accent" : "text-muted-foreground border-transparent"
          }`}
        >
          VIN Number
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
        </>
      ) : (
        <>
          <FormField label="VIN Number">
            <div className="flex gap-2">
              <Input
                placeholder="Enter 17-character VIN"
                value={formData.vin}
                onChange={(e) => {
                  update("vin", e.target.value.toUpperCase());
                  setVehicleInfo(null);
                  setVinError("");
                }}
                maxLength={17}
                className="py-3.5 px-4 text-base border-2 border-input focus:border-accent focus:ring-accent/10 flex-1"
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

          {/* Show rich vehicle card when BB data is available */}
          {bbSelectedVehicle ? (
            <div className="mb-5 p-4 bg-success/10 border border-success/30 rounded-xl space-y-3">
              <div className="flex items-center gap-2">
                <CheckCircle className="w-5 h-5 text-success" />
                <span className="text-sm font-bold text-card-foreground">Vehicle Found</span>
              </div>

              <div>
                <p className="text-base font-semibold text-card-foreground">
                  {bbSelectedVehicle.year} {bbSelectedVehicle.make} {bbSelectedVehicle.model}
                </p>
                {(bbSelectedVehicle.series || bbSelectedVehicle.style) && (
                  <p className="text-sm text-muted-foreground">
                    {bbSelectedVehicle.series}{bbSelectedVehicle.series && bbSelectedVehicle.style ? " • " : ""}{bbSelectedVehicle.style}
                  </p>
                )}
              </div>

              {bbSelectedVehicle.tradein?.avg ? (
                <p className="text-sm text-success">
                  Estimated value: <span className="font-bold">${bbSelectedVehicle.tradein.avg.toLocaleString()}</span>
                </p>
              ) : null}

              {detectedOptions.length > 0 && (
                <div>
                  <p className="text-[11px] font-semibold text-muted-foreground mb-1.5 uppercase tracking-wider">
                    Factory Options Detected
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {detectedOptions.slice(0, 12).map((opt) => (
                      <span
                        key={opt.uoc}
                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-primary/10 border border-primary/20 text-primary"
                      >
                        <CheckCircle className="w-3 h-3" />
                        {opt.name}
                      </span>
                    ))}
                    {detectedOptions.length > 12 && (
                      <span className="px-2 py-0.5 rounded-full text-[11px] text-muted-foreground">
                        +{detectedOptions.length - 12} more
                      </span>
                    )}
                  </div>
                  {availableAddOns.length > 0 && (
                    <details className="mt-2">
                      <summary className="text-[11px] text-muted-foreground/70 cursor-pointer hover:text-muted-foreground transition-colors">
                        View {availableAddOns.length} available add-ons
                      </summary>
                      <div className="flex flex-wrap gap-1.5 mt-1.5">
                        {availableAddOns.map((opt) => (
                          <span
                            key={opt.uoc}
                            className="px-2 py-0.5 rounded-full text-[11px] bg-muted border border-border text-muted-foreground"
                          >
                            {opt.name}
                          </span>
                        ))}
                      </div>
                    </details>
                  )}
                </div>
              )}
            </div>
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

      {/* Also show BB card for plate lookups */}
      {activeTab === "plate" && bbSelectedVehicle && (
        <div className="mb-5 p-4 bg-success/10 border border-success/30 rounded-xl space-y-3">
          <div className="flex items-center gap-2">
            <CheckCircle className="w-5 h-5 text-success" />
            <span className="text-sm font-bold text-card-foreground">Vehicle Found</span>
          </div>

          <div>
            <p className="text-base font-semibold text-card-foreground">
              {bbSelectedVehicle.year} {bbSelectedVehicle.make} {bbSelectedVehicle.model}
            </p>
            {(bbSelectedVehicle.series || bbSelectedVehicle.style) && (
              <p className="text-sm text-muted-foreground">
                {bbSelectedVehicle.series}{bbSelectedVehicle.series && bbSelectedVehicle.style ? " • " : ""}{bbSelectedVehicle.style}
              </p>
            )}
          </div>

          {bbSelectedVehicle.tradein?.avg ? (
            <p className="text-sm text-success">
              Estimated value: <span className="font-bold">${bbSelectedVehicle.tradein.avg.toLocaleString()}</span>
            </p>
          ) : null}

          {detectedOptions.length > 0 && (
            <div>
              <p className="text-[11px] font-semibold text-muted-foreground mb-1.5 uppercase tracking-wider">
                Factory Options Detected
              </p>
              <div className="flex flex-wrap gap-1.5">
                {detectedOptions.slice(0, 12).map((opt) => (
                  <span
                    key={opt.uoc}
                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-primary/10 border border-primary/20 text-primary"
                  >
                    <CheckCircle className="w-3 h-3" />
                    {opt.name}
                  </span>
                ))}
                {detectedOptions.length > 12 && (
                  <span className="px-2 py-0.5 rounded-full text-[11px] text-muted-foreground">
                    +{detectedOptions.length - 12} more
                  </span>
                )}
              </div>
              {availableAddOns.length > 0 && (
                <details className="mt-2">
                  <summary className="text-[11px] text-muted-foreground/70 cursor-pointer hover:text-muted-foreground transition-colors">
                    View {availableAddOns.length} available add-ons
                  </summary>
                  <div className="flex flex-wrap gap-1.5 mt-1.5">
                    {availableAddOns.map((opt) => (
                      <span
                        key={opt.uoc}
                        className="px-2 py-0.5 rounded-full text-[11px] bg-muted border border-border text-muted-foreground"
                      >
                        {opt.name}
                      </span>
                    ))}
                  </div>
                </details>
              )}
            </div>
          )}
        </div>
      )}
    </>
  );
};

export default StepVehicleInfo;
