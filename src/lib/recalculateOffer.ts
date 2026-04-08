/**
 * Recalculate offer from submission data without needing full BBVehicle.
 * Uses condition_basis_map to resolve the correct BB base value per condition tier.
 */
import type { OfferSettings, OfferRule, ConditionMultipliers, ConditionBasisMap, OfferEstimate, DeductionModes } from "./offerCalculator";
import { DEFAULT_LOW_MILEAGE_BONUS, DEFAULT_HIGH_MILEAGE_PENALTY, DEFAULT_COLOR_DESIRABILITY, DEFAULT_SEASONAL_ADJUSTMENT, DEFAULT_DEDUCTION_MODES, calcLowMileageBonusPct, calcHighMileagePenaltyPct, calcColorAdjustmentPct } from "./offerCalculator";

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
  exterior_color?: string | null;
}

const DEFAULT_CONDITION_MULTIPLIERS: ConditionMultipliers = {
  excellent: 1.0, very_good: 1.0, good: 1.0, fair: 1.0,
};

const DEFAULT_DEDUCTION_AMOUNTS = {
  accidents_1: 800, accidents_2: 1800, accidents_3plus: 3000,
  exterior_damage_per_item: 300, interior_damage_per_item: 200,
  windshield_cracked: 400, windshield_chipped: 150,
  engine_issue_per_item: 500, mechanical_issue_per_item: 350, tech_issue_per_item: 150,
  not_drivable: 1500, smoked_in: 500, tires_not_replaced: 400,
  missing_keys_1: 200, missing_keys_0: 400,
};

/** All BB tier values stored on submission */
export interface BBValueTiers {
  wholesale?: { xclean?: number; clean?: number; avg?: number; rough?: number };
  tradein?: { clean?: number; avg?: number; rough?: number };
  retail?: { xclean?: number; clean?: number; avg?: number; rough?: number };
}

/** Optional BB values stored on submission for condition_basis_map resolution */
export interface SubmissionBBValues {
  bb_tradein_avg?: number | null;
  bb_wholesale_avg?: number | null;
  bb_retail_avg?: number | null;
  bb_value_tiers?: BBValueTiers | null;
}

function normalizeBBValueTiers(value: BBValueTiers | string | null | undefined): BBValueTiers | null {
  if (!value) return null;
  if (typeof value === "string") {
    try {
      return JSON.parse(value) as BBValueTiers;
    } catch {
      return null;
    }
  }
  return value;
}

/** Resolve base value from stored BB data using condition_basis_map */
function resolveBaseValue(bbValues: SubmissionBBValues, basis: string): number {
  const tiers = normalizeBBValueTiers(bbValues.bb_value_tiers as BBValueTiers | string | null | undefined);
  if (tiers) {
    const [category, tier] = basis.split("_");
    if (category === "wholesale" && tiers.wholesale) {
      return (tiers.wholesale as Record<string, number>)[tier] || tiers.wholesale.avg || 0;
    }
    if (category === "tradein" && tiers.tradein) {
      return (tiers.tradein as Record<string, number>)[tier] || tiers.tradein.avg || 0;
    }
    if (category === "retail" && tiers.retail) {
      return (tiers.retail as Record<string, number>)[tier] || tiers.retail.avg || 0;
    }
  }
  if (basis.startsWith("wholesale")) return bbValues.bb_wholesale_avg || 0;
  if (basis.startsWith("retail")) return bbValues.bb_retail_avg || 0;
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
    high_mileage_penalty: DEFAULT_HIGH_MILEAGE_PENALTY,
    color_desirability: DEFAULT_COLOR_DESIRABILITY,
    seasonal_adjustment: DEFAULT_SEASONAL_ADJUSTMENT,
    deduction_modes: DEFAULT_DEDUCTION_MODES,
  };

  const ded = cfg.deductions_config;
  const amt = cfg.deduction_amounts || DEFAULT_DEDUCTION_AMOUNTS;
  const condMults = cfg.condition_multipliers || DEFAULT_CONDITION_MULTIPLIERS;
  const modes: DeductionModes = cfg.deduction_modes || DEFAULT_DEDUCTION_MODES;

  // ── STEP 1: Base value from condition-mapped BB tier ──
  const condKey = (condition.overall_condition || "good") as keyof ConditionBasisMap;
  const condBasisMap = cfg.condition_basis_map || { excellent: "retail_xclean", very_good: "tradein_clean", good: "tradein_avg", fair: "wholesale_rough" };
  const effectiveBasis = condBasisMap[condKey] || cfg.bb_value_basis;
  const baseValue = resolveBaseValue(allBB, effectiveBasis);
  if (baseValue <= 0) return null;

  // ── STEP 2: Condition multiplier ──
  const condMult = condMults[condKey] ?? 1.0;
  let adjusted = baseValue * condMult;

  // ── STEP 3: Dealer modifiers (applied BEFORE customer deductions) ──

  // 3a. Global adjustment
  if (cfg.global_adjustment_pct !== 0) {
    adjusted = Math.round(adjusted * (1 + cfg.global_adjustment_pct / 100));
  }

  // 3b. Regional adjustment
  const regionalPct = cfg.regional_adjustment_pct || 0;
  if (regionalPct !== 0) {
    adjusted = Math.round(adjusted * (1 + regionalPct / 100));
  }

  // 3c. Seasonal adjustment
  const seasonal = cfg.seasonal_adjustment || DEFAULT_SEASONAL_ADJUSTMENT;
  if (seasonal.enabled && seasonal.adjustment_pct !== 0) {
    adjusted = Math.round(adjusted * (1 + seasonal.adjustment_pct / 100));
  }

  // 3d. Color desirability adjustment
  const colorConfig = cfg.color_desirability || DEFAULT_COLOR_DESIRABILITY;
  const colorPct = calcColorAdjustmentPct(condition.exterior_color || undefined, colorConfig);
  if (colorPct !== 0) {
    adjusted = Math.round(adjusted * (1 + colorPct / 100));
  }

  // 3e. Age tiers
  const ageTiers = cfg.age_tiers || [];
  if (ageTiers.length > 0 && condition.vehicle_year) {
    const vehicleAge = new Date().getFullYear() - Number(condition.vehicle_year);
    for (const tier of ageTiers) {
      if (vehicleAge >= tier.min_years && vehicleAge <= tier.max_years) {
        adjusted = Math.round(adjusted * (1 + tier.adjustment_pct / 100));
        break;
      }
    }
  }

  // 3f. Mileage tiers
  const mileage = parseInt((condition.mileage || "0").replace(/[^0-9]/g, "")) || 0;
  const mileageTiers = cfg.mileage_tiers || [];
  if (mileageTiers.length > 0) {
    for (const tier of mileageTiers) {
      if (mileage >= tier.min_miles && mileage <= tier.max_miles) {
        adjusted = Math.round(adjusted + tier.adjustment_flat);
        break;
      }
    }
  }

  // 3g. Low-mileage bonus
  const lmb = cfg.low_mileage_bonus || DEFAULT_LOW_MILEAGE_BONUS;
  const lmBonusPct = calcLowMileageBonusPct(condition.vehicle_year || undefined, mileage, lmb);
  if (lmBonusPct > 0) {
    adjusted = Math.round(adjusted * (1 + lmBonusPct / 100));
  }

  // 3h. High-mileage penalty
  const hmp = cfg.high_mileage_penalty || DEFAULT_HIGH_MILEAGE_PENALTY;
  const hmPenaltyPct = calcHighMileagePenaltyPct(condition.vehicle_year || undefined, mileage, hmp);
  if (hmPenaltyPct > 0) {
    adjusted = Math.round(adjusted * (1 - hmPenaltyPct / 100));
  }

  // ── STEP 4: Customer condition deductions ──
  let deductions = 0;

  const accidentsLower = (condition.accidents || "").toLowerCase();
  if (ded.accidents) {
    if (modes.accidents === "pct") {
      if (accidentsLower === "1" || accidentsLower === "1 accident") deductions += Math.round(baseValue * (amt.accidents_1 / 100));
      else if (accidentsLower === "2" || accidentsLower === "2 accidents" || accidentsLower === "2+ accidents") deductions += Math.round(baseValue * (amt.accidents_2 / 100));
      else if (accidentsLower === "3+" || accidentsLower === "3+ accidents") deductions += Math.round(baseValue * (amt.accidents_3plus / 100));
    } else {
      if (accidentsLower === "1" || accidentsLower === "1 accident") deductions += amt.accidents_1;
      else if (accidentsLower === "2" || accidentsLower === "2 accidents" || accidentsLower === "2+ accidents") deductions += amt.accidents_2;
      else if (accidentsLower === "3+" || accidentsLower === "3+ accidents") deductions += amt.accidents_3plus;
    }
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
    else if (windshieldLower === "chipped_and_cracked" || windshieldLower.includes("chipped & cracked")) deductions += amt.windshield_cracked + amt.windshield_chipped;
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
  if (ded.not_drivable && (drivableLower === "no" || drivableLower === "not drivable")) {
    if (modes.not_drivable === "pct") {
      deductions += Math.round(baseValue * (amt.not_drivable / 100));
    } else {
      deductions += amt.not_drivable;
    }
  }
  const smokedLower = (condition.smoked_in || "").toLowerCase();
  if (ded.smoked_in && (smokedLower === "yes" || smokedLower === "smoked in")) deductions += amt.smoked_in;
  const tiresLower = (condition.tires_replaced || "").toLowerCase();
  if (ded.tires_not_replaced && (!condition.tires_replaced || tiresLower === "no" || tiresLower === "none" || tiresLower === "0")) deductions += amt.tires_not_replaced;
  if (ded.missing_keys) {
    if (condition.num_keys === "1") deductions += amt.missing_keys_1;
    else if (condition.num_keys === "0") deductions += amt.missing_keys_0;
  }

  // ── STEP 5: Subtract customer deductions (recon/pack are internal cost refs, NOT subtracted from offer) ──
  const reconCost = cfg.recon_cost || 0;
  let high = Math.round(adjusted - deductions);

  // ── STEP 6: Rules ──
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
    if (c.models?.length) {
      const modelLower = (condition.vehicle_model || "").toLowerCase();
      if (!c.models.some(m => modelLower.includes(m.toLowerCase()))) continue;
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

  // ── STEP 7: Floor & ceiling ──
  const floor = cfg.offer_floor || 500;
  high = Math.max(high, floor);
  if (cfg.offer_ceiling && cfg.offer_ceiling > 0) {
    high = Math.min(high, cfg.offer_ceiling);
  }

  const low = high;

  return { low, high, baseValue: Math.round(baseValue), totalDeductions: Math.round(deductions), reconCost: Math.round(reconCost), matchedRuleIds, isHotLead, marketAdjustment: 0, marketDaysSupply: null, strategyMode: "standard" as const, isCapped: false, projectedGross: 0 };
}
