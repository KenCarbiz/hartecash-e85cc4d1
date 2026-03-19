import type { FormData, BBVehicle } from "@/components/sell-form/types";

export interface OfferEstimate {
  low: number;
  high: number;
  baseValue: number;
  totalDeductions: number;
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

export interface OfferSettings {
  bb_value_basis: string;
  global_adjustment_pct: number;
  deductions_config: DeductionsConfig;
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
  is_active: boolean;
  flag_in_dashboard: boolean;
}

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
};

/**
 * Extract the correct BB value based on the configured basis
 */
function getBBValue(bbVehicle: BBVehicle, basis: string): number {
  const [category, tier] = basis.split("_");
  const tierKey = tier === "xclean" ? "xclean" : tier;

  if (category === "wholesale") return bbVehicle.wholesale?.[tierKey as keyof typeof bbVehicle.wholesale] || 0;
  if (category === "tradein") return bbVehicle.tradein?.[tierKey as keyof typeof bbVehicle.tradein] || 0;
  if (category === "retail") return bbVehicle.retail?.[tierKey as keyof typeof bbVehicle.retail] || 0;

  return bbVehicle.tradein?.avg || 0;
}

/**
 * Check if a submission matches a rule's criteria
 */
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

  // 1. Get base value from configured BB source
  const baseValue = getBBValue(bbVehicle, cfg.bb_value_basis);
  if (baseValue <= 0) return null;

  // 2. Condition multiplier
  const conditionMultipliers: Record<string, number> = {
    excellent: 1.05,
    good: 1.0,
    fair: 0.90,
    rough: 0.78,
  };
  const condMult = conditionMultipliers[formData.overallCondition] ?? 1.0;
  let adjusted = baseValue * condMult;

  // 3. Apply selected add/deduct adjustments from BB equipment list
  for (const ad of bbVehicle.add_deduct_list) {
    if (selectedAddDeducts.includes(ad.uoc)) {
      adjusted += ad.avg || 0;
    }
  }

  // 4. Condition-based deductions (only if enabled in config)
  let deductions = 0;

  if (ded.accidents) {
    if (formData.accidents === "1") deductions += 800;
    else if (formData.accidents === "2") deductions += 1800;
    else if (formData.accidents === "3+") deductions += 3000;
  }

  if (ded.exterior_damage) {
    const items = formData.exteriorDamage.filter((d) => d !== "none");
    deductions += items.length * 300;
  }

  if (ded.interior_damage) {
    const items = formData.interiorDamage.filter((d) => d !== "none");
    deductions += items.length * 200;
  }

  if (ded.windshield_damage) {
    if (formData.windshieldDamage === "cracked") deductions += 400;
    else if (formData.windshieldDamage === "chipped") deductions += 150;
  }

  if (ded.engine_issues) {
    const items = formData.engineIssues.filter((d) => d !== "none");
    deductions += items.length * 500;
  }

  if (ded.mechanical_issues) {
    const items = formData.mechanicalIssues.filter((d) => d !== "none");
    deductions += items.length * 350;
  }

  if (ded.tech_issues) {
    const items = formData.techIssues.filter((d) => d !== "none");
    deductions += items.length * 150;
  }

  if (ded.not_drivable && formData.drivable === "no") deductions += 1500;
  if (ded.smoked_in && formData.smokedIn === "yes") deductions += 500;
  if (ded.tires_not_replaced && formData.tiresReplaced === "no") deductions += 400;

  if (ded.missing_keys) {
    if (formData.numKeys === "1") deductions += 200;
    else if (formData.numKeys === "0") deductions += 400;
  }

  let high = Math.max(Math.round(adjusted - deductions), 500);

  // 5. Apply global adjustment %
  if (cfg.global_adjustment_pct !== 0) {
    high = Math.round(high * (1 + cfg.global_adjustment_pct / 100));
  }

  // 6. Apply matching rules
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
      if (rule.adjustment_pct !== 0) {
        high = Math.round(high * (1 + rule.adjustment_pct / 100));
      }
      if (rule.flag_in_dashboard) {
        isHotLead = true;
      }
    }
  }

  high = Math.max(high, 500);
  const low = Math.max(Math.round(high * 0.90), 500);

  return {
    low,
    high,
    baseValue: Math.round(baseValue),
    totalDeductions: Math.round(deductions),
    matchedRuleIds,
    isHotLead,
  };
}
