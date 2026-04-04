import { useEffect, useState } from "react";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import FormField from "./FormField";
import RadioOption from "./RadioOption";
import VehicleSummaryBar from "./VehicleSummaryBar";
import type { FormData, BBVehicle, VehicleInfo } from "./types";
import type { FormConfig } from "@/hooks/useFormConfig";
import { supabase } from "@/integrations/supabase/client";
import { useSiteConfig } from "@/hooks/useSiteConfig";

interface DealerLocation {
  id: string;
  name: string;
  city: string;
  state: string;
}

interface Props {
  formData: FormData;
  update: (field: string, value: string) => void;
  formConfig?: FormConfig;
  bbVehicle?: BBVehicle | null;
  vehicleInfo?: VehicleInfo | null;
  leadSource?: string;
}

const StepHistory = ({ formData, update, formConfig, bbVehicle, vehicleInfo, leadSource }: Props) => {
  const { config } = useSiteConfig();
  const isTrade = leadSource === "trade";
  const showLocationPicker = isTrade || (config as any).assign_customer_picks === true;
  const showLoanSection = !formConfig || formConfig.q_loan_details;

  const [locations, setLocations] = useState<DealerLocation[]>([]);

  useEffect(() => {
    if (showLocationPicker) {
      supabase
        .from("dealership_locations")
        .select("id, name, city, state")
        .eq("is_active", true)
        .eq("show_in_scheduling", true)
        .order("sort_order")
        .then(({ data }) => { if (data) setLocations(data); });
    }
  }, [showLocationPicker]);

  return (
    <>
      <VehicleSummaryBar vehicleInfo={vehicleInfo} bbVehicle={bbVehicle} />

      <FormField label="How many total miles are on your vehicle?">
        <Input
          placeholder="e.g. 45,000"
          value={formData.mileage}
          onChange={(e) => update("mileage", e.target.value)}
          className="py-3.5 px-4 text-base border-2 border-input focus:border-accent focus:ring-accent/10"
        />
      </FormField>

      {(!formConfig || formConfig.q_accidents) && (
        <FormField label="Has your vehicle been in an accident?">
          <div className="grid gap-2">
            {["No accidents", "1 accident", "2+ accidents"].map((opt) => (
              <RadioOption key={opt} label={opt} selected={formData.accidents === opt} onClick={() => update("accidents", opt)} />
            ))}
          </div>
        </FormField>
      )}

      {(!formConfig || formConfig.q_smoked_in) && (
        <FormField label="Has your vehicle been smoked in?">
          <div className="grid grid-cols-2 gap-2">
            <RadioOption label="Not smoked in" selected={formData.smokedIn === "No"} onClick={() => update("smokedIn", "No")} />
            <RadioOption label="Smoked in" selected={formData.smokedIn === "Yes"} onClick={() => update("smokedIn", "Yes")} />
          </div>
        </FormField>
      )}

      {(!formConfig || formConfig.q_tires_replaced) && (
        <FormField label="How many tires replaced in the past 12 months?">
          <div className="grid grid-cols-3 gap-2">
            {["None", "1", "2", "3", "4"].map((opt) => (
              <RadioOption key={opt} label={opt === "None" ? "None" : `${opt} tire${opt !== "1" ? "s" : ""}`} selected={formData.tiresReplaced === opt} onClick={() => update("tiresReplaced", opt)} />
            ))}
          </div>
        </FormField>
      )}

      {(!formConfig || formConfig.q_num_keys) && (
        <FormField label="How many keys do you have?">
          <div className="grid grid-cols-2 gap-2">
            <RadioOption label="1 key" selected={formData.numKeys === "1"} onClick={() => update("numKeys", "1")} />
            <RadioOption label="2+ keys" selected={formData.numKeys === "2+"} onClick={() => update("numKeys", "2+")} />
          </div>
        </FormField>
      )}

      {/* ZIP + Intent section — moved here from Finalize */}
      <div className="border-t-2 border-muted pt-5 mt-3">
        <FormField label="Where is your vehicle located?">
          <Input
            placeholder="ZIP code"
            value={formData.zip}
            onChange={(e) => update("zip", e.target.value)}
            className="py-3.5 px-4 text-base border-2 border-input focus:border-accent focus:ring-accent/10"
          />
        </FormField>

        {showLocationPicker && locations.length > 0 && (
          <FormField label={isTrade ? "Which location are you working with?" : "Preferred dealership location"}>
            <Select
              value={formData.preferredLocationId || ""}
              onValueChange={v => update("preferredLocationId", v)}
            >
              <SelectTrigger className="py-3.5 px-4 text-base border-2 border-input focus:border-accent focus:ring-accent/10">
                <SelectValue placeholder="Select a location..." />
              </SelectTrigger>
              <SelectContent>
                {locations.map(loc => (
                  <SelectItem key={loc.id} value={loc.id}>{loc.name} — {loc.city}, {loc.state}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FormField>
        )}

        {isTrade && (
          <FormField label="Salesperson or contact you're working with" hint="Enter the name of the person at the dealership (optional).">
            <Input
              placeholder="e.g. Mike S."
              value={formData.salespersonName}
              onChange={(e) => update("salespersonName", e.target.value)}
              className="py-3.5 px-4 text-base border-2 border-input focus:border-accent focus:ring-accent/10"
            />
          </FormField>
        )}

        {showLoanSection && (
          <FormField label="What would you like to do?" hint="Sell outright, trade in, or buy out your lease.">
            <div className="grid grid-cols-2 gap-2">
              {["Sell", "Trade-In", "Lease Buyout", "Not Sure"].map((opt) => (
                <RadioOption key={opt} label={opt} selected={formData.loanStatus === opt} onClick={() => update("loanStatus", opt)} />
              ))}
            </div>
          </FormField>
        )}
      </div>
    </>
  );
};

export default StepHistory;
