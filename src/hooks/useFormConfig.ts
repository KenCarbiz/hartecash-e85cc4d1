import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useTenant } from "@/contexts/TenantContext";

export interface FormConfig {
  step_vehicle_build: boolean;
  step_condition_history: boolean;
  offer_before_details: boolean;
  q_overall_condition: boolean;
  q_exterior_damage: boolean;
  q_windshield_damage: boolean;
  q_moonroof: boolean;
  q_interior_damage: boolean;
  q_tech_issues: boolean;
  q_engine_issues: boolean;
  q_mechanical_issues: boolean;
  q_drivable: boolean;
  q_accidents: boolean;
  q_smoked_in: boolean;
  q_tires_replaced: boolean;
  q_num_keys: boolean;
  q_exterior_color: boolean;
  q_drivetrain: boolean;
  q_modifications: boolean;
  q_loan_details: boolean;
  q_next_step: boolean;
}

const DEFAULTS: FormConfig = {
  step_vehicle_build: true,
  step_condition_history: true,
  offer_before_details: false,
  q_overall_condition: true,
  q_exterior_damage: true,
  q_windshield_damage: true,
  q_moonroof: true,
  q_interior_damage: true,
  q_tech_issues: true,
  q_engine_issues: true,
  q_mechanical_issues: true,
  q_drivable: true,
  q_accidents: true,
  q_smoked_in: true,
  q_tires_replaced: true,
  q_num_keys: true,
  q_exterior_color: true,
  q_drivetrain: true,
  q_modifications: true,
  q_loan_details: true,
  q_next_step: true,
};

async function fetchFormConfig(dealershipId: string): Promise<FormConfig> {
  const { data } = await supabase
    .from("form_config" as any)
    .select("*")
    .eq("dealership_id", dealershipId)
    .maybeSingle();
  if (data) {
    const d = data as any;
    const merged: FormConfig = { ...DEFAULTS };
    for (const key of Object.keys(DEFAULTS)) {
      if (d[key] !== undefined && d[key] !== null) {
        (merged as any)[key] = d[key];
      }
    }
    return merged;
  }
  return DEFAULTS;
}

export function useFormConfig() {
  const { tenant } = useTenant();
  const dealershipId = tenant.dealership_id;

  const { data, isLoading } = useQuery({
    queryKey: ["form_config", dealershipId],
    queryFn: () => fetchFormConfig(dealershipId),
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  });

  return { formConfig: data ?? DEFAULTS, loading: isLoading };
}

export function clearFormConfigCache() {
  // No-op now — React Query handles cache invalidation
}
