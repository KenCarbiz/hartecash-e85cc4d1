/**
 * Recalculate offer from submission data without needing full BBVehicle.
 * Uses condition_basis_map to resolve the correct BB base value per condition tier.
 */
import type { OfferSettings, OfferRule, ConditionMultipliers, ConditionBasisMap, OfferEstimate } from "./offerCalculator";
import { DEFAULT_LOW_MILEAGE_BONUS, calcLowMileageBonusPct } from "./offerCalculator";

export interface SubmissionCondition {
  overall_condition: string | null;
  mileage: string | null;
  vehicle_year: string | null;
  vehicle_make: string | null;
  vehicle_model: string | null;
  accidents: string | null;
  exterior_damage: string[] | null;
  interior_damage: string[] | null;
  mechanical_issues: string[] | null;
  engine_issues: string[] | null;
  tech_issues: string[] | null;
  windshield_damage: string | null;
  smoked_in: string | null;
  tires_replaced: string | null;
  num_keys: string | null;
  drivable: string | null;
}

const DEFAULT_CONDITION_MULTIPLIERS: ConditionMultipliers = {
  excellent: 1.0,
  very_good: 1.0,
  good: 1.0,
  fair: 1.0,
};

const DEFAULT_DEDUCTION_AMOUNTS = {
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

/** Optional BB values stored on submission for condition_basis_map resolution */
export interface SubmissionBBValues {
  bb_tradein_avg?: number | null;
  bb_wholesale_avg?: number | null;
  bb_retail_avg?: number | null;
}

/** Resolve base value from stored BB data using condition_basis_map */
function resolveBaseValue(bbValues: SubmissionBBValues, basis: string): number {
  // Map basis keys to the available stored values
  // We only have avg-tier values stored; use the closest match
  if (basis.startsWith("wholesale")) return bbValues.bb_wholesale_avg || 0;
  if (basis.startsWith("retail")) return bbValues.bb_retail_avg || 0;
  // Default to trade-in for any tradein_* basis
  return bbValues.bb_tradein_avg || 0;
}

export function recalculateFromSubmission(
  bbTradeinAvg: number,
  condition: SubmissionCondition,
  settings?: OfferSettings | null,
  rules?: OfferRule[] | null,
  bbValues?: SubmissionBBValues
): OfferEstimate | null {
  const allBB: SubmissionBBValues = bbValues || { bb_tradein_avg: bbTradeinAvg };
  if ((allBB.bb_tradein_avg || 0) <= 0 && (allBB.bb_wholesale_avg || 0) <= 0 && (allBB.bb_retail_avg || 0) <= 0) return null;

  const cfg = settings || {
    bb_value_basis: "tradein_avg",
    global_adjustment_pct: 0,
    deductions_config: {
      accidents: true, exterior_damage: true, interior_damage: true,
      windshield_damage: true, engine_issues: true, mechanical_issues: true,
      tech_issues: true, not_drivable: true, smoked_in: true,
      tires_not_replaced: true, missing_keys: true,
    },
    deduction_amounts: DEFAULT_DEDUCTION_AMOUNTS,
    condition_multipliers: DEFAULT_CONDITION_MULTIPLIERS,
    condition_basis_map: { excellent: "retail_xclean", very_good: "tradein_clean", good: "tradein_avg", fair: "wholesale_rough" } as ConditionBasisMap,
    condition_equipment_map: { excellent: true, very_good: true, good: true, fair: true },
    recon_cost: 0,
    offer_floor: 500,
    offer_ceiling: null,
    age_tiers: [],
    mileage_tiers: [],
    regional_adjustment_pct: 0,
    low_mileage_bonus: DEFAULT_LOW_MILEAGE_BONUS,
  };

  const ded = cfg.deductions_config;
  const amt = cfg.deduction_amounts || DEFAULT_DEDUCTION_AMOUNTS;
  const condMults = cfg.condition_multipliers || DEFAULT_CONDITION_MULTIPLIERS;

  // 1. Resolve base value via condition_basis_map (matches primary calculator logic)
  const condKey = (condition.overall_condition || "good") as keyof ConditionBasisMap;
  const condBasisMap = cfg.condition_basis_map || { excellent: "retail_xclean", very_good: "tradein_clean", good: "tradein_avg", fair: "wholesale_rough" };
  const effectiveBasis = condBasisMap[condKey] || cfg.bb_value_basis;
  const baseValue = resolveBaseValue(allBB, effectiveBasis);
  if (baseValue <= 0) return null;

  const condMult = condMults[condKey] ?? 1.0;
  let adjusted = baseValue * condMult;

  // 2. Deductions (normalize form labels for matching)
  let deductions = 0;

  const accidentsLower = (condition.accidents || "").toLowerCase();
  if (ded.accidents) {
    if (accidentsLower === "1" || accidentsLower === "1 accident") deductions += amt.accidents_1;
    else if (accidentsLower === "2" || accidentsLower === "2 accidents" || accidentsLower === "2+ accidents") deductions += amt.accidents_2;
    else if (accidentsLower === "3+" || accidentsLower === "3+ accidents") deductions += amt.accidents_3plus;
  }
  if (ded.exterior_damage) {
    deductions += (condition.exterior_damage || []).filter(d => d !== "none").length * amt.exterior_damage_per_item;
  }
  if (ded.interior_damage) {
    deductions += (condition.interior_damage || []).filter(d => d !== "none").length * amt.interior_damage_per_item;
  }
  const windshieldLower = (condition.windshield_damage || "").toLowerCase();
  if (ded.windshield_damage) {
    if (windshieldLower === "cracked" || windshieldLower.includes("major crack")) deductions += amt.windshield_cracked;
    else if (windshieldLower === "chipped" || windshieldLower.includes("minor chip")) deductions += amt.windshield_chipped;
  }
  if (ded.engine_issues) {
    deductions += (condition.engine_issues || []).filter(d => d !== "none").length * amt.engine_issue_per_item;
  }
  if (ded.mechanical_issues) {
    deductions += (condition.mechanical_issues || []).filter(d => d !== "none").length * amt.mechanical_issue_per_item;
  }
  if (ded.tech_issues) {
    deductions += (condition.tech_issues || []).filter(d => d !== "none").length * amt.tech_issue_per_item;
  }
  const drivableLower = (condition.drivable || "").toLowerCase();
  if (ded.not_drivable && (drivableLower === "no" || drivableLower === "not drivable")) deductions += amt.not_drivable;
  const smokedLower = (condition.smoked_in || "").toLowerCase();
  if (ded.smoked_in && (smokedLower === "yes" || smokedLower === "smoked in")) deductions += amt.smoked_in;
  const tiresLower = (condition.tires_replaced || "").toLowerCase();
  if (ded.tires_not_replaced && (!condition.tires_replaced || tiresLower === "no" || tiresLower === "none" || tiresLower === "0")) deductions += amt.tires_not_replaced;
  if (ded.missing_keys) {
    if (condition.num_keys === "1") deductions += amt.missing_keys_1;
    else if (condition.num_keys === "0") deductions += amt.missing_keys_0;
  }

  // 3. Subtract deductions + recon
  const reconCost = cfg.recon_cost || 0;
  let high = Math.round(adjusted - deductions - reconCost);

  // 4. Global adjustment
  if (cfg.global_adjustment_pct !== 0) {
    high = Math.round(high * (1 + cfg.global_adjustment_pct / 100));
  }

  // 4b. Regional adjustment
  const regionalPct = cfg.regional_adjustment_pct || 0;
  if (regionalPct !== 0) {
    high = Math.round(high * (1 + regionalPct / 100));
  }

  // 5. Age tiers
  const ageTiers = cfg.age_tiers || [];
  if (ageTiers.length > 0 && condition.vehicle_year) {
    const vehicleAge = new Date().getFullYear() - Number(condition.vehicle_year);
    for (const tier of ageTiers) {
      if (vehicleAge >= tier.min_years && vehicleAge <= tier.max_years) {
        high = Math.round(high * (1 + tier.adjustment_pct / 100));
        break;
      }
    }
  }

  // 6. Mileage tiers
  const mileage = parseInt((condition.mileage || "0").replace(/[^0-9]/g, "")) || 0;
  const mileageTiers = cfg.mileage_tiers || [];
  if (mileageTiers.length > 0) {
    for (const tier of mileageTiers) {
      if (mileage >= tier.min_miles && mileage <= tier.max_miles) {
        high = Math.round(high + tier.adjustment_flat);
        break;
      }
    }
  }

  // 6b. Low-mileage bonus
  const lmb = cfg.low_mileage_bonus || DEFAULT_LOW_MILEAGE_BONUS;
  const lmBonusPct = calcLowMileageBonusPct(condition.vehicle_year || undefined, mileage, lmb);
  if (lmBonusPct > 0) {
    high = Math.round(high * (1 + lmBonusPct / 100));
  }

  // 7. Rules
  const activeRules = (rules || []).filter(r => r.is_active);
  const matchedRuleIds: string[] = [];
  let isHotLead = false;

  for (const rule of activeRules) {
    const c = rule.criteria;
    if (c.year_min && Number(condition.vehicle_year) < c.year_min) continue;
    if (c.year_max && Number(condition.vehicle_year) > c.year_max) continue;
    if (c.mileage_min && mileage < c.mileage_min) continue;
    if (c.mileage_max && mileage > c.mileage_max) continue;
    if (c.makes?.length) {
      const makeLower = (condition.vehicle_make || "").toLowerCase();
      if (!c.makes.some(m => makeLower.includes(m.toLowerCase()))) continue;
    }
    if (c.conditions?.length) {
      if (!condition.overall_condition || !c.conditions.includes(condition.overall_condition.toLowerCase())) continue;
    }

    matchedRuleIds.push(rule.id);
    if (rule.adjustment_type === "flat") {
      high = Math.round(high + (rule.adjustment_pct || 0));
    } else {
      if (rule.adjustment_pct !== 0) {
        high = Math.round(high * (1 + rule.adjustment_pct / 100));
      }
    }
    if (rule.flag_in_dashboard) isHotLead = true;
  }

  // 8. Floor & ceiling
  const floor = cfg.offer_floor || 500;
  high = Math.max(high, floor);
  if (cfg.offer_ceiling && cfg.offer_ceiling > 0) {
    high = Math.min(high, cfg.offer_ceiling);
  }

  const low = Math.max(Math.round(high * 0.90), floor);

  return { low, high, baseValue: Math.round(baseValue), totalDeductions: Math.round(deductions), reconCost: Math.round(reconCost), matchedRuleIds, isHotLead };
}
