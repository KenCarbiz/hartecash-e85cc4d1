import type { FormData, BBVehicle } from "@/components/sell-form/types";

// ─────────────────────────────────────────────────────────────
// RETURN TYPES
// ─────────────────────────────────────────────────────────────

export interface OfferEstimate {
  low: number;
  high: number;
  baseValue: number;
  totalDeductions: number;
  reconCost: number;
  matchedRuleIds: string[];
  isHotLead: boolean;
  // NEW — market intelligence breakdown
  marketAdjustment: number;        // dollar amount added/removed by live market data
  marketDaysSupply: number | null; // MDS at time of calculation (for display)
  strategyMode: StrategyMode;      // which mode was active
  isCapped: boolean;               // true if offer was reduced by safety cap
  projectedGross: number;          // retail_clean - offer - recon (informational)
}

// ─────────────────────────────────────────────────────────────
// STRATEGY MODES
// ─────────────────────────────────────────────────────────────

export type StrategyMode = "conservative" | "standard" | "aggressive" | "predator" | "custom";

export interface StrategyModePreset {
  label: string;
  description: string;
  condition_basis_map: ConditionBasisMap;
  global_adjustment_pct: number;
  market_adjustment_enabled: boolean;
}

export const STRATEGY_MODE_PRESETS: Record<StrategyMode, StrategyModePreset> = {
  conservative: {
    label: "Conservative",
    description: "Protect margin. Anchor to wholesale. Market data caps upside.",
    condition_basis_map: {
      excellent: "wholesale_clean",
      very_good: "wholesale_clean",
      good: "wholesale_avg",
      fair: "wholesale_rough",
    },
    global_adjustment_pct: -3,
    market_adjustment_enabled: true,
  },
  standard: {
    label: "Standard",
    description: "Normal acquisition. Trade-in anchor with full market multiplier.",
    condition_basis_map: {
      excellent: "retail_xclean",
      very_good: "tradein_clean",
      good: "tradein_avg",
      fair: "wholesale_rough",
    },
    global_adjustment_pct: 0,
    market_adjustment_enabled: true,
  },
  aggressive: {
    label: "Aggressive",
    description: "Step up to win inventory. Trade-in clean floor across all tiers.",
    condition_basis_map: {
      excellent: "retail_clean",
      very_good: "tradein_clean",
      good: "tradein_clean",
      fair: "tradein_avg",
    },
    global_adjustment_pct: 3,
    market_adjustment_enabled: true,
  },
  predator: {
    label: "Predator",
    description:
      "Show retail-anchored offer up front. Inspector deducts bring it to reality. High conversion, tight discipline required.",
    condition_basis_map: {
      excellent: "retail_xclean",
      very_good: "retail_clean",
      good: "retail_avg",
      fair: "retail_rough",
    },
    global_adjustment_pct: 0,
    market_adjustment_enabled: true,
  },
  custom: {
    label: "Custom",
    description: "Manually configured condition basis map and adjustments.",
    condition_basis_map: {
      excellent: "retail_xclean",
      very_good: "tradein_clean",
      good: "tradein_avg",
      fair: "wholesale_rough",
    },
    global_adjustment_pct: 0,
    market_adjustment_enabled: false,
  },
};

// ─────────────────────────────────────────────────────────────
// MARKET ADJUSTMENT
// ─────────────────────────────────────────────────────────────

export interface MarketDaysSupplyBracket {
  max_days: number;        // upper bound (use 9999 for "over X days")
  adjustment_pct: number;  // positive = step up offer, negative = step down
}

export interface MarketAdjustmentConfig {
  enabled: boolean;
  days_supply_brackets: MarketDaysSupplyBracket[];
  // Soft market penalty: if avg sold is this % below avg asking, penalize
  sold_vs_asking_threshold_pct: number;
  soft_penalty_pct: number;
  // Tight market bonus: if sold ≈ asking (within 2%), add bonus
  soft_bonus_pct: number;
}

export const DEFAULT_MARKET_ADJUSTMENT: MarketAdjustmentConfig = {
  enabled: false,
  days_supply_brackets: [
    { max_days: 20,   adjustment_pct: 10  }, // Critical scarcity — step up aggressively
    { max_days: 35,   adjustment_pct: 5   }, // Low supply — step up
    { max_days: 60,   adjustment_pct: 0   }, // Balanced — no adjustment
    { max_days: 90,   adjustment_pct: -4  }, // Oversupply — hold firm
    { max_days: 9999, adjustment_pct: -9  }, // High supply — discount or pass
  ],
  sold_vs_asking_threshold_pct: 5,
  soft_penalty_pct: 2,
  soft_bonus_pct: 2,
};

// Market adjustment presets per strategy mode
export const MARKET_ADJUSTMENT_BY_STRATEGY: Record<StrategyMode, MarketDaysSupplyBracket[]> = {
  conservative: [
    { max_days: 20,   adjustment_pct: 5   },
    { max_days: 35,   adjustment_pct: 2   },
    { max_days: 60,   adjustment_pct: 0   },
    { max_days: 90,   adjustment_pct: -5  },
    { max_days: 9999, adjustment_pct: -12 },
  ],
  standard: [
    { max_days: 20,   adjustment_pct: 10  },
    { max_days: 35,   adjustment_pct: 5   },
    { max_days: 60,   adjustment_pct: 0   },
    { max_days: 90,   adjustment_pct: -4  },
    { max_days: 9999, adjustment_pct: -9  },
  ],
  aggressive: [
    { max_days: 20,   adjustment_pct: 14  },
    { max_days: 35,   adjustment_pct: 8   },
    { max_days: 60,   adjustment_pct: 2   },
    { max_days: 90,   adjustment_pct: -2  },
    { max_days: 9999, adjustment_pct: -6  },
  ],
  predator: [
    { max_days: 20,   adjustment_pct: 10  },
    { max_days: 35,   adjustment_pct: 5   },
    { max_days: 60,   adjustment_pct: 0   },
    { max_days: 90,   adjustment_pct: -4  },
    { max_days: 9999, adjustment_pct: -9  },
  ],
  custom: [
    { max_days: 20,   adjustment_pct: 10  },
    { max_days: 35,   adjustment_pct: 5   },
    { max_days: 60,   adjustment_pct: 0   },
    { max_days: 90,   adjustment_pct: -4  },
    { max_days: 9999, adjustment_pct: -9  },
  ],
};

// ─────────────────────────────────────────────────────────────
// EXISTING INTERFACES (unchanged)
// ─────────────────────────────────────────────────────────────

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
  moonroof_broken: number;
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

export interface HighMileagePenalty {
  enabled: boolean;
  avg_miles_per_year: number;
  penalty_pct_per_step: number;
  step_size_pct: number;
  max_penalty_pct: number;
  max_miles_per_year: number;
}

export interface ColorDesirability {
  enabled: boolean;
  adjustments: Record<string, number>;
}

export interface SeasonalAdjustment {
  enabled: boolean;
  adjustment_pct: number;
}

export interface DeductionModes {
  accidents: "flat" | "pct";
  not_drivable: "flat" | "pct";
}

// ─────────────────────────────────────────────────────────────
// DEFAULTS (unchanged from original)
// ─────────────────────────────────────────────────────────────

export const DEFAULT_LOW_MILEAGE_BONUS: LowMileageBonus = {
  enabled: false,
  avg_miles_per_year: 12000,
  bonus_pct_per_step: 2,
  step_size_pct: 20,
  max_bonus_pct: 8,
  min_miles_per_year: 4000,
};

export const DEFAULT_HIGH_MILEAGE_PENALTY: HighMileagePenalty = {
  enabled: false,
  avg_miles_per_year: 12000,
  penalty_pct_per_step: 2,
  step_size_pct: 20,
  max_penalty_pct: 10,
  max_miles_per_year: 25000,
};

export const DEFAULT_COLOR_DESIRABILITY: ColorDesirability = {
  enabled: false,
  adjustments: {
    white: 2, black: 2, silver: 1, gray: 1, red: 0, blue: 0,
    green: -1, yellow: -3, orange: -2, purple: -2, brown: -2, gold: -1, beige: -2,
  },
};

export const DEFAULT_SEASONAL_ADJUSTMENT: SeasonalAdjustment = {
  enabled: false,
  adjustment_pct: 0,
};

export const DEFAULT_DEDUCTION_MODES: DeductionModes = {
  accidents: "flat",
  not_drivable: "flat",
};

// ─────────────────────────────────────────────────────────────
// OFFER SETTINGS — extended with strategy_mode + market_adjustment
// ─────────────────────────────────────────────────────────────

export interface OfferSettings {
  // NEW
  strategy_mode?: StrategyMode;
  market_adjustment?: MarketAdjustmentConfig;

  // EXISTING (all unchanged)
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
  high_mileage_penalty?: HighMileagePenalty;
  color_desirability?: ColorDesirability;
  seasonal_adjustment?: SeasonalAdjustment;
  deduction_modes?: DeductionModes;
  retail_search_radius?: number;
  retail_search_zip?: string;
  max_market_pct?: number | null;
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
  adjustment_type: "pct" | "flat";
  is_active: boolean;
  flag_in_dashboard: boolean;
}

// ─────────────────────────────────────────────────────────────
// INTERNAL DEFAULTS
// ─────────────────────────────────────────────────────────────

const DEFAULT_DEDUCTION_AMOUNTS: DeductionAmounts = {
  accidents_1: 800,
  accidents_2: 1800,
  accidents_3plus: 3000,
  exterior_damage_per_item: 300,
  interior_damage_per_item: 200,
  windshield_cracked: 400,
  windshield_chipped: 150,
  moonroof_broken: 300,
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
  strategy_mode: "standard",
  market_adjustment: DEFAULT_MARKET_ADJUSTMENT,
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

// ─────────────────────────────────────────────────────────────
// HELPER FUNCTIONS (unchanged from original)
// ─────────────────────────────────────────────────────────────

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

export function calcHighMileagePenaltyPct(
  vehicleYear: string | undefined,
  mileage: number,
  penalty: HighMileagePenalty
): number {
  if (!penalty.enabled || !vehicleYear) return 0;
  const age = Math.max(new Date().getFullYear() - Number(vehicleYear), 1);
  const milesPerYear = mileage / age;
  if (milesPerYear <= penalty.avg_miles_per_year || milesPerYear > penalty.max_miles_per_year) return 0;
  const pctAbove = ((milesPerYear - penalty.avg_miles_per_year) / penalty.avg_miles_per_year) * 100;
  const steps = Math.floor(pctAbove / penalty.step_size_pct);
  return Math.min(steps * penalty.penalty_pct_per_step, penalty.max_penalty_pct);
}

export function calcColorAdjustmentPct(
  exteriorColor: string | undefined,
  config: ColorDesirability
): number {
  if (!config.enabled || !exteriorColor) return 0;
  const colorLower = exteriorColor.toLowerCase().trim();
  for (const [color, pct] of Object.entries(config.adjustments)) {
    if (colorLower.includes(color.toLowerCase())) return pct;
  }
  return 0;
}

/** Extract the correct BB value based on the configured basis */
function getBBValue(bbVehicle: BBVehicle, basis: string): number {
  const parts = basis.split("_");
  const category = parts[0];
  const tier = parts.slice(1).join("_"); // handles "xclean" correctly
  const tierKey = tier === "xclean" ? "xclean" : tier;
  if (category === "wholesale") return bbVehicle.wholesale?.[tierKey as keyof typeof bbVehicle.wholesale] || 0;
  if (category === "tradein")   return bbVehicle.tradein?.[tierKey as keyof typeof bbVehicle.tradein]     || 0;
  if (category === "retail")    return bbVehicle.retail?.[tierKey as keyof typeof bbVehicle.retail]       || 0;
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
 * NEW — Calculate the market multiplier adjustment in dollars
 * Uses Black Book Live Market data: market_days_supply, avg_sold_price, avg_asking_price
 */
function calcMarketAdjustment(
  adjustedBeforeMarket: number,
  mktConfig: MarketAdjustmentConfig,
  strategyMode: StrategyMode,
  marketDaysSupply?: number,
  marketSoldAvg?: number,
  marketAskingAvg?: number
): number {
  if (!mktConfig.enabled || marketDaysSupply == null) return 0;

  // Use strategy-specific brackets if available, otherwise use config brackets
  const brackets =
    strategyMode !== "custom"
      ? MARKET_ADJUSTMENT_BY_STRATEGY[strategyMode]
      : mktConfig.days_supply_brackets;

  // Find the matching bracket (sorted ascending by max_days)
  const sorted = [...brackets].sort((a, b) => a.max_days - b.max_days);
  const bracket = sorted.find((b) => marketDaysSupply <= b.max_days) ?? sorted[sorted.length - 1];

  let mktPct = bracket?.adjustment_pct ?? 0;

  // Sold vs asking spread refinement
  if (marketSoldAvg && marketAskingAvg && marketAskingAvg > 0) {
    const spreadPct = ((marketAskingAvg - marketSoldAvg) / marketAskingAvg) * 100;
    if (spreadPct > mktConfig.sold_vs_asking_threshold_pct) {
      // Soft market: sold well below asking — reduce further
      mktPct -= mktConfig.soft_penalty_pct;
    } else if (spreadPct < 2) {
      // Tight market: sold nearly equals asking — step up
      mktPct += mktConfig.soft_bonus_pct;
    }
  }

  if (mktPct === 0) return 0;
  const adjustment = Math.round(adjustedBeforeMarket * (mktPct / 100));
  return adjustment;
}

// ─────────────────────────────────────────────────────────────
// MAIN FUNCTION — calculateOffer
// Extended with 3 new optional market params — all call sites
// that don't pass them continue to work exactly as before.
// ─────────────────────────────────────────────────────────────

export function calculateOffer(
  bbVehicle: BBVehicle | null,
  formData: FormData,
  selectedAddDeducts: string[],
  settings?: OfferSettings | null,
  rules?: OfferRule[] | null,
  promoBonus?: number,
  // NEW — live market data from Black Book ListingsStatistics API
  marketDaysSupply?: number,
  marketSoldAvg?: number,
  marketAskingAvg?: number
): OfferEstimate | null {
  if (!bbVehicle) return null;

  const cfg = settings || DEFAULT_SETTINGS;
  const ded = cfg.deductions_config || DEFAULT_DEDUCTIONS;
  const amt = cfg.deduction_amounts || DEFAULT_DEDUCTION_AMOUNTS;
  const condMults = cfg.condition_multipliers || DEFAULT_CONDITION_MULTIPLIERS;
  const condBasisMap = cfg.condition_basis_map || DEFAULT_CONDITION_BASIS_MAP;
  const modes = cfg.deduction_modes || DEFAULT_DEDUCTION_MODES;
  const strategyMode: StrategyMode = cfg.strategy_mode ?? "standard";
  const mktConfig: MarketAdjustmentConfig = cfg.market_adjustment ?? DEFAULT_MARKET_ADJUSTMENT;

  // ── STEP 1: Base value from condition-mapped BB tier ──
  const conditionKey = formData.overallCondition as keyof ConditionBasisMap;
  const effectiveBasis = condBasisMap[conditionKey] || cfg.bb_value_basis;
  const baseValue = getBBValue(bbVehicle, effectiveBasis);
  if (baseValue <= 0) return null;

  // ── STEP 2: Condition multiplier ──
  const condMult = condMults[formData.overallCondition as keyof ConditionMultipliers] ?? 1.0;
  let adjusted = baseValue * condMult;

  // ── STEP 3: Equipment add/deducts (if enabled for this condition) ──
  const condEquipMap = cfg.condition_equipment_map || DEFAULT_CONDITION_EQUIPMENT_MAP;
  const includeEquipment = condEquipMap[formData.overallCondition as keyof ConditionEquipmentMap] ?? true;
  if (includeEquipment) {
    for (const ad of bbVehicle.add_deduct_list) {
      if (selectedAddDeducts.includes(ad.uoc)) {
        adjusted += ad.avg || 0;
      }
    }
  }

  // ── STEP 4: Dealer modifiers (applied to adjusted base BEFORE deductions) ──

  // 4a. Global adjustment %
  if (cfg.global_adjustment_pct !== 0) {
    adjusted = Math.round(adjusted * (1 + cfg.global_adjustment_pct / 100));
  }

  // 4b. Regional adjustment %
  const regionalPct = cfg.regional_adjustment_pct || 0;
  if (regionalPct !== 0) {
    adjusted = Math.round(adjusted * (1 + regionalPct / 100));
  }

  // 4c. Seasonal adjustment %
  const seasonal = cfg.seasonal_adjustment || DEFAULT_SEASONAL_ADJUSTMENT;
  if (seasonal.enabled && seasonal.adjustment_pct !== 0) {
    adjusted = Math.round(adjusted * (1 + seasonal.adjustment_pct / 100));
  }

  // 4d. Color desirability adjustment %
  const colorConfig = cfg.color_desirability || DEFAULT_COLOR_DESIRABILITY;
  const colorPct = calcColorAdjustmentPct(formData.exteriorColor, colorConfig);
  if (colorPct !== 0) {
    adjusted = Math.round(adjusted * (1 + colorPct / 100));
  }

  // 4e. Age-based tier adjustments
  const ageTiers = cfg.age_tiers || [];
  if (ageTiers.length > 0 && bbVehicle.year) {
    const currentYear = new Date().getFullYear();
    const vehicleAge = currentYear - Number(bbVehicle.year);
    for (const tier of ageTiers) {
      if (vehicleAge >= tier.min_years && vehicleAge <= tier.max_years) {
        adjusted = Math.round(adjusted * (1 + tier.adjustment_pct / 100));
        break;
      }
    }
  }

  // 4f. Mileage-based tier adjustments (flat dollar)
  const mileage = parseInt(formData.mileage.replace(/[^0-9]/g, "")) || 0;
  const mileageTiers = cfg.mileage_tiers || [];
  if (mileageTiers.length > 0) {
    for (const tier of mileageTiers) {
      if (mileage >= tier.min_miles && mileage <= tier.max_miles) {
        adjusted = Math.round(adjusted + tier.adjustment_flat);
        break;
      }
    }
  }

  // 4g. Low-mileage bonus
  const lmb = cfg.low_mileage_bonus || DEFAULT_LOW_MILEAGE_BONUS;
  const lmBonusPct = calcLowMileageBonusPct(bbVehicle.year, mileage, lmb);
  if (lmBonusPct > 0) {
    adjusted = Math.round(adjusted * (1 + lmBonusPct / 100));
  }

  // 4h. High-mileage penalty
  const hmp = cfg.high_mileage_penalty || DEFAULT_HIGH_MILEAGE_PENALTY;
  const hmPenaltyPct = calcHighMileagePenaltyPct(bbVehicle.year, mileage, hmp);
  if (hmPenaltyPct > 0) {
    adjusted = Math.round(adjusted * (1 - hmPenaltyPct / 100));
  }

  // ── STEP 4i: Live Market Multiplier (NEW) ──
  // Uses Black Book ListingsStatistics: market_days_supply, sold mean price, active mean price
  // Completely additive — if no market data passed in, marketAdj = 0 and nothing changes
  const marketAdj = calcMarketAdjustment(
    adjusted,
    mktConfig,
    strategyMode,
    marketDaysSupply,
    marketSoldAvg,
    marketAskingAvg
  );
  if (marketAdj !== 0) {
    adjusted = Math.round(adjusted + marketAdj);
  }

  // ── STEP 5: Customer condition deductions ──
  let deductions = 0;

  const accidentsLower = (formData.accidents || "").toLowerCase();
  if (ded.accidents) {
    if (modes.accidents === "pct") {
      if (accidentsLower === "1" || accidentsLower === "1 accident")
        deductions += Math.round(baseValue * (amt.accidents_1 / 100));
      else if (accidentsLower === "2" || accidentsLower === "2 accidents" || accidentsLower === "2+ accidents")
        deductions += Math.round(baseValue * (amt.accidents_2 / 100));
      else if (accidentsLower === "3+" || accidentsLower === "3+ accidents")
        deductions += Math.round(baseValue * (amt.accidents_3plus / 100));
    } else {
      if (accidentsLower === "1" || accidentsLower === "1 accident")
        deductions += amt.accidents_1;
      else if (accidentsLower === "2" || accidentsLower === "2 accidents" || accidentsLower === "2+ accidents")
        deductions += amt.accidents_2;
      else if (accidentsLower === "3+" || accidentsLower === "3+ accidents")
        deductions += amt.accidents_3plus;
    }
  }
  if (ded.exterior_damage) {
    deductions += formData.exteriorDamage.filter((d) => d !== "none").length * amt.exterior_damage_per_item;
  }
  if (ded.interior_damage) {
    deductions += formData.interiorDamage.filter((d) => d !== "none").length * amt.interior_damage_per_item;
  }
  const windshieldLower = (formData.windshieldDamage || "").toLowerCase();
  if (ded.windshield_damage) {
    if (windshieldLower === "cracked" || windshieldLower.includes("major crack"))
      deductions += amt.windshield_cracked;
    else if (windshieldLower === "chipped" || windshieldLower.includes("minor chip"))
      deductions += amt.windshield_chipped;
    else if (windshieldLower === "chipped_and_cracked" || windshieldLower.includes("chipped & cracked"))
      deductions += amt.windshield_cracked + amt.windshield_chipped;
  }
  const moonroofLower = (formData.moonroof || "").toLowerCase();
  if (moonroofLower === "doesn't work" || moonroofLower === "doesnt work" || moonroofLower === "broken") {
    deductions += amt.moonroof_broken || 0;
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
  if (ded.not_drivable && (drivableLower === "no" || drivableLower === "not drivable")) {
    if (modes.not_drivable === "pct") {
      deductions += Math.round(baseValue * (amt.not_drivable / 100));
    } else {
      deductions += amt.not_drivable;
    }
  }
  const smokedLower = (formData.smokedIn || "").toLowerCase();
  if (ded.smoked_in && (smokedLower === "yes" || smokedLower === "smoked in"))
    deductions += amt.smoked_in;
  const tiresLower = (formData.tiresReplaced || "").toLowerCase();
  if (ded.tires_not_replaced && (!formData.tiresReplaced || tiresLower === "no" || tiresLower === "none" || tiresLower === "0"))
    deductions += amt.tires_not_replaced;
  if (ded.missing_keys) {
    if (formData.numKeys === "1") deductions += amt.missing_keys_1;
    else if (formData.numKeys === "0") deductions += amt.missing_keys_0;
  }

  // ── STEP 6: Subtract deductions ──
  const reconCost = cfg.recon_cost || 0;
  let high = Math.round(adjusted - deductions);

  // ── STEP 7: Apply matching rules ──
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
        high = Math.round(high + (rule.adjustment_pct || 0));
      } else {
        if (rule.adjustment_pct !== 0) {
          high = Math.round(high * (1 + rule.adjustment_pct / 100));
        }
      }
      if (rule.flag_in_dashboard) {
        isHotLead = true;
      }
    }
  }

  // ── STEP 8: Promo bonus ──
  if (promoBonus && promoBonus > 0) {
    high += promoBonus;
  }

  // ── STEP 9: Floor, ceiling, & market safety cap ──
  const floor = cfg.offer_floor || 500;
  high = Math.max(high, floor);

  let isCapped = false;
  if (cfg.offer_ceiling && cfg.offer_ceiling > 0 && high > cfg.offer_ceiling) {
    high = cfg.offer_ceiling;
    isCapped = true;
  }

  // Market safety cap: never exceed X% of retail avg
  if (cfg.max_market_pct && cfg.max_market_pct > 0 && bbVehicle.retail?.avg) {
    const cap = Math.round(Number(bbVehicle.retail.avg) * (cfg.max_market_pct / 100));
    if (cap > 0 && high > cap) {
      high = cap;
      isCapped = true;
    }
  }

  // Projected gross (informational — for manager display)
  const retailClean = bbVehicle.retail?.clean || bbVehicle.retail?.avg || 0;
  const projectedGross = Math.round(retailClean - high - reconCost);

  const low = high;

  return {
    low,
    high,
    baseValue: Math.round(baseValue),
    totalDeductions: Math.round(deductions),
    reconCost: Math.round(reconCost),
    matchedRuleIds,
    isHotLead,
    // NEW fields
    marketAdjustment: marketAdj,
    marketDaysSupply: marketDaysSupply ?? null,
    strategyMode,
    isCapped,
    projectedGross,
  };
}
