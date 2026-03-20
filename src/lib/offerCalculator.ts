import type { FormData, BBVehicle } from "@/components/sell-form/types";

export interface OfferEstimate {
  low: number;
  high: number;
  baseValue: number;
  totalDeductions: number;
  reconCost: number;
  matchedRuleIds: string[];
  isHotLead: boolean;
}

export interface DeductionsConfig {
  accidents: boolean;
  exterior_damage: boolean;
  interior_damage: boolean;
  windshield_damage: boolean;
  engine_issues: boolean;
  mechanical_issues: boolean;
  tech_issues: boolean;
  not_drivable: boolean;
  smoked_in: boolean;
  tires_not_replaced: boolean;
  missing_keys: boolean;
}

export interface DeductionAmounts {
  accidents_1: number;
  accidents_2: number;
  accidents_3plus: number;
  exterior_damage_per_item: number;
  interior_damage_per_item: number;
  windshield_cracked: number;
  windshield_chipped: number;
  engine_issue_per_item: number;
  mechanical_issue_per_item: number;
  tech_issue_per_item: number;
  not_drivable: number;
  smoked_in: number;
  tires_not_replaced: number;
  missing_keys_1: number;
  missing_keys_0: number;
}

export interface ConditionMultipliers {
  excellent: number;
  good: number;
  fair: number;
  rough: number;
}

export interface AgeTier {
  min_years: number;
  max_years: number;
  adjustment_pct: number;
}

export interface OfferSettings {
  bb_value_basis: string;
  global_adjustment_pct: number;
  deductions_config: DeductionsConfig;
  deduction_amounts: DeductionAmounts;
  condition_multipliers: ConditionMultipliers;
  recon_cost: number;
  offer_floor: number;
  offer_ceiling: number | null;
  age_tiers: AgeTier[];
}

export interface OfferRule {
  id: string;
  rule_type: string;
  criteria: {
    year_min?: number;
    year_max?: number;
    mileage_min?: number;
    mileage_max?: number;
    makes?: string[];
    models?: string[];
    conditions?: string[];
  };
  adjustment_pct: number;
  adjustment_type: "pct" | "flat"; // "pct" = percentage, "flat" = dollar amount
  is_active: boolean;
  flag_in_dashboard: boolean;
}

const DEFAULT_DEDUCTION_AMOUNTS: DeductionAmounts = {
  accidents_1: 800,
  accidents_2: 1800,
  accidents_3plus: 3000,
  exterior_damage_per_item: 300,
  interior_damage_per_item: 200,
  windshield_cracked: 400,
  windshield_chipped: 150,
  engine_issue_per_item: 500,
  mechanical_issue_per_item: 350,
  tech_issue_per_item: 150,
  not_drivable: 1500,
  smoked_in: 500,
  tires_not_replaced: 400,
  missing_keys_1: 200,
  missing_keys_0: 400,
};

const DEFAULT_CONDITION_MULTIPLIERS: ConditionMultipliers = {
  excellent: 1.05,
  good: 1.0,
  fair: 0.90,
  rough: 0.78,
};

const DEFAULT_DEDUCTIONS: DeductionsConfig = {
  accidents: true,
  exterior_damage: true,
  interior_damage: true,
  windshield_damage: true,
  engine_issues: true,
  mechanical_issues: true,
  tech_issues: true,
  not_drivable: true,
  smoked_in: true,
  tires_not_replaced: true,
  missing_keys: true,
};

const DEFAULT_SETTINGS: OfferSettings = {
  bb_value_basis: "tradein_avg",
  global_adjustment_pct: 0,
  deductions_config: DEFAULT_DEDUCTIONS,
  deduction_amounts: DEFAULT_DEDUCTION_AMOUNTS,
  condition_multipliers: DEFAULT_CONDITION_MULTIPLIERS,
  recon_cost: 0,
  offer_floor: 500,
  offer_ceiling: null,
  age_tiers: [],
};

/** Extract the correct BB value based on the configured basis */
function getBBValue(bbVehicle: BBVehicle, basis: string): number {
  const [category, tier] = basis.split("_");
  const tierKey = tier === "xclean" ? "xclean" : tier;
  if (category === "wholesale") return bbVehicle.wholesale?.[tierKey as keyof typeof bbVehicle.wholesale] || 0;
  if (category === "tradein") return bbVehicle.tradein?.[tierKey as keyof typeof bbVehicle.tradein] || 0;
  if (category === "retail") return bbVehicle.retail?.[tierKey as keyof typeof bbVehicle.retail] || 0;
  return bbVehicle.tradein?.avg || 0;
}

/** Check if a submission matches a rule's criteria */
function matchesRule(
  rule: OfferRule,
  vehicleYear: string | undefined,
  vehicleMake: string | undefined,
  vehicleModel: string | undefined,
  mileage: number,
  condition: string | undefined
): boolean {
  const c = rule.criteria;
  if (c.year_min && Number(vehicleYear) < c.year_min) return false;
  if (c.year_max && Number(vehicleYear) > c.year_max) return false;
  if (c.mileage_min && mileage < c.mileage_min) return false;
  if (c.mileage_max && mileage > c.mileage_max) return false;
  if (c.makes?.length) {
    const makeLower = (vehicleMake || "").toLowerCase();
    if (!c.makes.some((m) => makeLower.includes(m.toLowerCase()))) return false;
  }
  if (c.models?.length) {
    const modelLower = (vehicleModel || "").toLowerCase();
    if (!c.models.some((m) => modelLower.includes(m.toLowerCase()))) return false;
  }
  if (c.conditions?.length) {
    if (!condition || !c.conditions.includes(condition.toLowerCase())) return false;
  }
  return true;
}

/**
 * Calculate an offer using admin-configured settings, rules, and BB data.
 */
export function calculateOffer(
  bbVehicle: BBVehicle | null,
  formData: FormData,
  selectedAddDeducts: string[],
  settings?: OfferSettings | null,
  rules?: OfferRule[] | null
): OfferEstimate | null {
  if (!bbVehicle) return null;

  const cfg = settings || DEFAULT_SETTINGS;
  const ded = cfg.deductions_config || DEFAULT_DEDUCTIONS;
  const amt = cfg.deduction_amounts || DEFAULT_DEDUCTION_AMOUNTS;
  const condMults = cfg.condition_multipliers || DEFAULT_CONDITION_MULTIPLIERS;

  // 1. Get base value from configured BB source
  const baseValue = getBBValue(bbVehicle, cfg.bb_value_basis);
  if (baseValue <= 0) return null;

  // 2. Condition multiplier (now configurable)
  const condMult = condMults[formData.overallCondition as keyof ConditionMultipliers] ?? 1.0;
  let adjusted = baseValue * condMult;

  // 3. Apply selected add/deduct adjustments from BB equipment list
  for (const ad of bbVehicle.add_deduct_list) {
    if (selectedAddDeducts.includes(ad.uoc)) {
      adjusted += ad.avg || 0;
    }
  }

  // 4. Condition-based deductions (configurable amounts)
  let deductions = 0;

  if (ded.accidents) {
    if (formData.accidents === "1") deductions += amt.accidents_1;
    else if (formData.accidents === "2") deductions += amt.accidents_2;
    else if (formData.accidents === "3+") deductions += amt.accidents_3plus;
  }
  if (ded.exterior_damage) {
    deductions += formData.exteriorDamage.filter((d) => d !== "none").length * amt.exterior_damage_per_item;
  }
  if (ded.interior_damage) {
    deductions += formData.interiorDamage.filter((d) => d !== "none").length * amt.interior_damage_per_item;
  }
  if (ded.windshield_damage) {
    if (formData.windshieldDamage === "cracked") deductions += amt.windshield_cracked;
    else if (formData.windshieldDamage === "chipped") deductions += amt.windshield_chipped;
  }
  if (ded.engine_issues) {
    deductions += formData.engineIssues.filter((d) => d !== "none").length * amt.engine_issue_per_item;
  }
  if (ded.mechanical_issues) {
    deductions += formData.mechanicalIssues.filter((d) => d !== "none").length * amt.mechanical_issue_per_item;
  }
  if (ded.tech_issues) {
    deductions += formData.techIssues.filter((d) => d !== "none").length * amt.tech_issue_per_item;
  }
  if (ded.not_drivable && formData.drivable === "no") deductions += amt.not_drivable;
  if (ded.smoked_in && formData.smokedIn === "yes") deductions += amt.smoked_in;
  if (ded.tires_not_replaced && formData.tiresReplaced === "no") deductions += amt.tires_not_replaced;
  if (ded.missing_keys) {
    if (formData.numKeys === "1") deductions += amt.missing_keys_1;
    else if (formData.numKeys === "0") deductions += amt.missing_keys_0;
  }

  // 5. Subtract deductions and recon cost
  const reconCost = cfg.recon_cost || 0;
  let high = Math.round(adjusted - deductions - reconCost);

  // 6. Apply global adjustment %
  if (cfg.global_adjustment_pct !== 0) {
    high = Math.round(high * (1 + cfg.global_adjustment_pct / 100));
  }

  // 7. Apply age-based tier adjustments
  const ageTiers = cfg.age_tiers || [];
  if (ageTiers.length > 0 && bbVehicle.year) {
    const currentYear = new Date().getFullYear();
    const vehicleAge = currentYear - Number(bbVehicle.year);
    for (const tier of ageTiers) {
      if (vehicleAge >= tier.min_years && vehicleAge <= tier.max_years) {
        high = Math.round(high * (1 + tier.adjustment_pct / 100));
        break; // Only apply the first matching tier
      }
    }
  }

  // 8. Apply matching rules
  const mileage = parseInt(formData.mileage.replace(/[^0-9]/g, "")) || 0;
  const vehicleYear = bbVehicle.year;
  const vehicleMake = bbVehicle.make;
  const vehicleModel = bbVehicle.model;
  const condition = formData.overallCondition;

  const activeRules = (rules || []).filter((r) => r.is_active);
  const matchedRuleIds: string[] = [];
  let isHotLead = false;

  for (const rule of activeRules) {
    if (matchesRule(rule, vehicleYear, vehicleMake, vehicleModel, mileage, condition)) {
      matchedRuleIds.push(rule.id);
      if (rule.adjustment_type === "flat") {
        // Flat dollar adjustment (positive = boost, negative = penalty)
        high = Math.round(high + (rule.adjustment_pct || 0));
      } else {
        // Percentage adjustment (default)
        if (rule.adjustment_pct !== 0) {
          high = Math.round(high * (1 + rule.adjustment_pct / 100));
        }
      }
      if (rule.flag_in_dashboard) {
        isHotLead = true;
      }
    }
  }

  // 8. Apply floor & ceiling
  const floor = cfg.offer_floor || 500;
  high = Math.max(high, floor);
  if (cfg.offer_ceiling && cfg.offer_ceiling > 0) {
    high = Math.min(high, cfg.offer_ceiling);
  }

  const low = Math.max(Math.round(high * 0.90), floor);

  return {
    low,
    high,
    baseValue: Math.round(baseValue),
    totalDeductions: Math.round(deductions),
    reconCost: Math.round(reconCost),
    matchedRuleIds,
    isHotLead,
  };
}
