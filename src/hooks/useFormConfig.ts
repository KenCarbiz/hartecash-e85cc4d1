import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useTenant } from "@/contexts/TenantContext";

export interface FormConfig {
  step_vehicle_build: boolean;
  step_condition_history: boolean;
  // AI photo upload step (between Condition and History). Customer-facing
  // value: "Get a higher offer with AI condition scoring." Skip is always
  // available inside the step itself.
  step_ai_photos: boolean;
  ai_photos_min_required: number;
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

/**
 * Lean defaults — only the fields that meaningfully change the BB offer
 * math start enabled. The rest (color, drivetrain, mods, moonroof,
 * windshield, interior/tech/engine/mech issues, smoked-in, tires
 * replaced, key count) are verified during inspection anyway, so
 * asking them up front is friction without offer-math payoff.
 *
 * Existing dealers with explicit values in their form_config row are
 * unchanged — fetchFormConfig only overwrites a default when the DB
 * column has a non-null value. New tenants get the lean form; any
 * dealer who wants the exhaustive flow back can flip the toggles in
 * Setup · Dealer · Lead Form.
 */
const DEFAULTS: FormConfig = {
  // Skip Step 2 by default — color, drivetrain, and modifications all
  // live in the Black Book lookup data already pulled in Step 1.
  step_vehicle_build: false,
  // Condition + history step still on by default; offer math needs
  // the overall condition tier and accident count.
  step_condition_history: true,
  // Photos step is our differentiator vs Carvana — keep on.
  step_ai_photos: true,
  ai_photos_min_required: 4,
  offer_before_details: false,
  // Offer-math drivers — keep on.
  q_overall_condition: true,
  q_drivable: true,
  q_accidents: true,
  // Major-damage gate — kept on as a single yes/no proxy for the old
  // five-checkbox list. Inspectors verify the specifics.
  q_exterior_damage: true,
  // Trade / lease buy-out branch matters for the offer; keep on.
  q_loan_details: true,
  q_next_step: true,
  // Off by default — verified at inspection, low offer-math impact.
  q_windshield_damage: false,
  q_moonroof: false,
  q_interior_damage: false,
  q_tech_issues: false,
  q_engine_issues: false,
  q_mechanical_issues: false,
  q_smoked_in: false,
  q_tires_replaced: false,
  q_num_keys: false,
  q_exterior_color: false,
  q_drivetrain: false,
  q_modifications: false,
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
