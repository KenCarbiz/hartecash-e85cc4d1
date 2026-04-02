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
  very_good: number;
  good: number;
  fair: number;
}

export interface ConditionBasisMap {
  excellent: string;
  very_good: string;
  good: string;
  fair: string;
}

export interface ConditionEquipmentMap {
  excellent: boolean;
  very_good: boolean;
  good: boolean;
  fair: boolean;
}

export interface AgeTier {
  min_years: number;
  max_years: number;
  adjustment_pct: number;
}

export interface MileageTier {
  min_miles: number;
  max_miles: number;
  adjustment_flat: number;
}

export interface LowMileageBonus {
  enabled: boolean;
  avg_miles_per_year: number;
  bonus_pct_per_step: number;
  step_size_pct: number;
  max_bonus_pct: number;
  min_miles_per_year: number;
}

export const DEFAULT_LOW_MILEAGE_BONUS: LowMileageBonus = {
  enabled: false,
  avg_miles_per_year: 12000,
  bonus_pct_per_step: 2,
  step_size_pct: 20,
  max_bonus_pct: 8,
  min_miles_per_year: 4000,
};

/** Calculate low-mileage bonus percentage */
export function calcLowMileageBonusPct(
  vehicleYear: string | undefined,
  mileage: number,
  bonus: LowMileageBonus
): number {
  if (!bonus.enabled || !vehicleYear) return 0;
  const age = Math.max(new Date().getFullYear() - Number(vehicleYear), 1);
  const milesPerYear = mileage / age;
  if (milesPerYear >= bonus.avg_miles_per_year || milesPerYear < bonus.min_miles_per_year) return 0;
  const pctBelow = ((bonus.avg_miles_per_year - milesPerYear) / bonus.avg_miles_per_year) * 100;
  const steps = Math.floor(pctBelow / bonus.step_size_pct);
  return Math.min(steps * bonus.bonus_pct_per_step, bonus.max_bonus_pct);
}

export interface OfferSettings {
  bb_value_basis: string;
  global_adjustment_pct: number;
  deductions_config: DeductionsConfig;
  deduction_amounts: DeductionAmounts;
  condition_multipliers: ConditionMultipliers;
  condition_basis_map: ConditionBasisMap;
  condition_equipment_map: ConditionEquipmentMap;
  recon_cost: number;
  offer_floor: number;
  offer_ceiling: number | null;
  age_tiers: AgeTier[];
  mileage_tiers: MileageTier[];
  regional_adjustment_pct: number;
  low_mileage_bonus: LowMileageBonus;
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
  excellent: 1.0,
  very_good: 1.0,
  good: 1.0,
  fair: 1.0,
};

const DEFAULT_CONDITION_BASIS_MAP: ConditionBasisMap = {
  excellent: "retail_xclean",
  very_good: "tradein_clean",
  good: "tradein_avg",
  fair: "wholesale_rough",
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

const DEFAULT_CONDITION_EQUIPMENT_MAP: ConditionEquipmentMap = {
  excellent: true,
  very_good: true,
  good: true,
  fair: true,
};

const DEFAULT_SETTINGS: OfferSettings = {
  bb_value_basis: "tradein_avg",
  global_adjustment_pct: 0,
  deductions_config: DEFAULT_DEDUCTIONS,
  deduction_amounts: DEFAULT_DEDUCTION_AMOUNTS,
  condition_multipliers: DEFAULT_CONDITION_MULTIPLIERS,
  condition_basis_map: DEFAULT_CONDITION_BASIS_MAP,
  condition_equipment_map: DEFAULT_CONDITION_EQUIPMENT_MAP,
  recon_cost: 0,
  offer_floor: 500,
  offer_ceiling: null,
  age_tiers: [],
  mileage_tiers: [],
  regional_adjustment_pct: 0,
  low_mileage_bonus: DEFAULT_LOW_MILEAGE_BONUS,
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

  const condBasisMap = cfg.condition_basis_map || DEFAULT_CONDITION_BASIS_MAP;

  // 1. Get base value from condition-mapped BB source (or fallback to single basis)
  const conditionKey = formData.overallCondition as keyof ConditionBasisMap;
  const effectiveBasis = condBasisMap[conditionKey] || cfg.bb_value_basis;
  const baseValue = getBBValue(bbVehicle, effectiveBasis);
  if (baseValue <= 0) return null;

  // 2. Condition multiplier (now configurable)
  const condMult = condMults[formData.overallCondition as keyof ConditionMultipliers] ?? 1.0;
  let adjusted = baseValue * condMult;

  // 3. Apply selected add/deduct adjustments from BB equipment list (if enabled for this condition)
  const condEquipMap = cfg.condition_equipment_map || DEFAULT_CONDITION_EQUIPMENT_MAP;
  const includeEquipment = condEquipMap[formData.overallCondition as keyof ConditionEquipmentMap] ?? true;
  if (includeEquipment) {
    for (const ad of bbVehicle.add_deduct_list) {
      if (selectedAddDeducts.includes(ad.uoc)) {
        adjusted += ad.avg || 0;
      }
    }
  }

  // 4. Condition-based deductions (configurable amounts)
  let deductions = 0;

  // Normalize form values for comparison (form uses labels like "1 accident", calculator needs to match)
  const accidentsLower = (formData.accidents || "").toLowerCase();
  if (ded.accidents) {
    if (accidentsLower === "1" || accidentsLower === "1 accident") deductions += amt.accidents_1;
    else if (accidentsLower === "2" || accidentsLower === "2 accidents" || accidentsLower === "2+ accidents") deductions += amt.accidents_2;
    else if (accidentsLower === "3+" || accidentsLower === "3+ accidents") deductions += amt.accidents_3plus;
  }
  if (ded.exterior_damage) {
    deductions += formData.exteriorDamage.filter((d) => d !== "none").length * amt.exterior_damage_per_item;
  }
  if (ded.interior_damage) {
    deductions += formData.interiorDamage.filter((d) => d !== "none").length * amt.interior_damage_per_item;
  }
  const windshieldLower = (formData.windshieldDamage || "").toLowerCase();
  if (ded.windshield_damage) {
    if (windshieldLower === "cracked" || windshieldLower.includes("major crack")) deductions += amt.windshield_cracked;
    else if (windshieldLower === "chipped" || windshieldLower.includes("minor chip")) deductions += amt.windshield_chipped;
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
  const drivableLower = (formData.drivable || "").toLowerCase();
  if (ded.not_drivable && (drivableLower === "no" || drivableLower === "not drivable")) deductions += amt.not_drivable;
  const smokedLower = (formData.smokedIn || "").toLowerCase();
  if (ded.smoked_in && (smokedLower === "yes" || smokedLower === "smoked in")) deductions += amt.smoked_in;
  const tiresLower = (formData.tiresReplaced || "").toLowerCase();
  if (ded.tires_not_replaced && (!formData.tiresReplaced || tiresLower === "no" || tiresLower === "none" || tiresLower === "0")) deductions += amt.tires_not_replaced;
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

  // 6b. Apply regional adjustment %
  const regionalPct = cfg.regional_adjustment_pct || 0;
  if (regionalPct !== 0) {
    high = Math.round(high * (1 + regionalPct / 100));
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

  // 7b. Apply mileage-based tier adjustments (flat dollar)
  const mileage = parseInt(formData.mileage.replace(/[^0-9]/g, "")) || 0;
  const mileageTiers = cfg.mileage_tiers || [];
  if (mileageTiers.length > 0) {
    for (const tier of mileageTiers) {
      if (mileage >= tier.min_miles && mileage <= tier.max_miles) {
        high = Math.round(high + tier.adjustment_flat);
        break;
      }
    }
  }

  // 7c. Apply low-mileage bonus
  const lmb = cfg.low_mileage_bonus || DEFAULT_LOW_MILEAGE_BONUS;
  const lmBonusPct = calcLowMileageBonusPct(bbVehicle.year, mileage, lmb);
  if (lmBonusPct > 0) {
    high = Math.round(high * (1 + lmBonusPct / 100));
  }

  // 8. Apply matching rules
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

  // Firm offer — no range
  const low = high;

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
