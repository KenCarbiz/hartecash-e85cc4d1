// Tests for the offer calculator. The audit flagged this file as a
// critical-path bug magnet with zero coverage despite 1000+ lines of
// business logic — every customer's quoted offer flows through it.
//
// We don't try to test every branch; we cover the pure helpers
// (mileage bonus / penalty, color, AI condition delta) end-to-end,
// then add a small set of full `calculateOffer` smoke tests that pin
// the most important pricing invariants — base value selection, low
// mileage bonus actually flowing through, and the offer never going
// below the configured floor.
//
// Time-sensitive helpers use vi.setSystemTime so vehicle ages stay
// deterministic regardless of when the tests run.

import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import {
  calcLowMileageBonusPct,
  calcHighMileagePenaltyPct,
  calcColorAdjustmentPct,
  calcAIConditionAdjustment,
  calculateOffer,
  DEFAULT_LOW_MILEAGE_BONUS,
  DEFAULT_HIGH_MILEAGE_PENALTY,
  DEFAULT_COLOR_DESIRABILITY,
  DEFAULT_DEDUCTION_AMOUNTS,
  DEFAULT_MARKET_ADJUSTMENT,
  MARKET_ADJUSTMENT_BY_STRATEGY,
  type LowMileageBonus,
  type HighMileagePenalty,
  type ColorDesirability,
  type OfferSettings,
  type MarketAdjustmentConfig,
  type StrategyMode,
} from "@/lib/offerCalculator";
import type { BBVehicle, FormData } from "@/components/sell-form/types";
import { initialFormData } from "@/components/sell-form/types";

// Pin "now" so age-based math doesn't drift with the calendar.
const FIXED_NOW = new Date("2026-06-01T12:00:00Z");
beforeAll(() => {
  vi.useFakeTimers();
  vi.setSystemTime(FIXED_NOW);
});
afterAll(() => {
  vi.useRealTimers();
});

// ─────────────────────────────────────────────────────────────
// calcLowMileageBonusPct
// ─────────────────────────────────────────────────────────────
describe("calcLowMileageBonusPct", () => {
  const enabled: LowMileageBonus = { ...DEFAULT_LOW_MILEAGE_BONUS, enabled: true };

  it("returns 0 when the bonus is disabled", () => {
    expect(calcLowMileageBonusPct("2021", 30000, { ...enabled, enabled: false })).toBe(0);
  });

  it("returns 0 when vehicleYear is missing", () => {
    expect(calcLowMileageBonusPct(undefined, 10000, enabled)).toBe(0);
  });

  it("returns 0 when miles/year is at or above the average threshold", () => {
    // 5-year-old car with 60000 miles → 12000/yr exactly = avg, no bonus
    expect(calcLowMileageBonusPct("2021", 60000, enabled)).toBe(0);
    expect(calcLowMileageBonusPct("2021", 75000, enabled)).toBe(0);
  });

  it("returns 0 when miles/year is below the min floor (suspicious low — no bonus)", () => {
    // 5-year-old car with 15000 miles → 3000/yr, below min_miles_per_year=4000
    expect(calcLowMileageBonusPct("2021", 15000, enabled)).toBe(0);
  });

  it("steps the bonus per step_size_pct interval, capped at max_bonus_pct", () => {
    // 5-year-old car, 30000 miles → 6000/yr = 50% below 12000 avg
    // step_size_pct=20, bonus_pct_per_step=2 → floor(50/20)=2 steps → 4%
    expect(calcLowMileageBonusPct("2021", 30000, enabled)).toBe(4);
    // Very low miles (24000 over 5 yr = 4800/yr ≈ 60% below) → 3 steps → 6%
    expect(calcLowMileageBonusPct("2021", 24000, enabled)).toBe(6);
  });

  it("never exceeds max_bonus_pct", () => {
    const tight: LowMileageBonus = { ...enabled, max_bonus_pct: 4 };
    // 24000 miles over 5 yr would be 6% un-capped; cap at 4.
    expect(calcLowMileageBonusPct("2021", 24000, tight)).toBe(4);
  });
});

// ─────────────────────────────────────────────────────────────
// calcHighMileagePenaltyPct
// ─────────────────────────────────────────────────────────────
describe("calcHighMileagePenaltyPct", () => {
  const enabled: HighMileagePenalty = { ...DEFAULT_HIGH_MILEAGE_PENALTY, enabled: true };

  it("returns 0 when disabled or vehicleYear missing", () => {
    expect(calcHighMileagePenaltyPct("2021", 200000, { ...enabled, enabled: false })).toBe(0);
    expect(calcHighMileagePenaltyPct(undefined, 200000, enabled)).toBe(0);
  });

  it("returns 0 when miles/year is at or below the average threshold", () => {
    // 5-year-old car, exactly 12000/yr (60000 total) → no penalty
    expect(calcHighMileagePenaltyPct("2021", 60000, enabled)).toBe(0);
    expect(calcHighMileagePenaltyPct("2021", 50000, enabled)).toBe(0);
  });

  it("returns 0 when miles/year exceeds the max guard rail (suspicious — out of policy)", () => {
    // max_miles_per_year=25000, 5yr: 130000 = 26000/yr → above guard → 0
    expect(calcHighMileagePenaltyPct("2021", 130000, enabled)).toBe(0);
  });

  it("steps the penalty per step_size_pct interval, capped at max_penalty_pct", () => {
    // 5-year-old car, 90000 miles → 18000/yr = 50% above 12000 avg
    // step_size_pct=20, penalty_pct_per_step=2 → floor(50/20)=2 steps → 4%
    expect(calcHighMileagePenaltyPct("2021", 90000, enabled)).toBe(4);
    // 5-year-old, 120000 → 24000/yr = 100% above → 5 steps × 2% = 10%
    expect(calcHighMileagePenaltyPct("2021", 120000, enabled)).toBe(10);
  });
});

// ─────────────────────────────────────────────────────────────
// calcColorAdjustmentPct
// ─────────────────────────────────────────────────────────────
describe("calcColorAdjustmentPct", () => {
  const cfg: ColorDesirability = {
    enabled: true,
    adjustments: { white: 1, black: 1, red: -3, "deep blue": -2 },
  };

  it("returns 0 when disabled", () => {
    expect(calcColorAdjustmentPct("white", { ...cfg, enabled: false })).toBe(0);
  });

  it("returns 0 when color is missing", () => {
    expect(calcColorAdjustmentPct(undefined, cfg)).toBe(0);
    expect(calcColorAdjustmentPct("", cfg)).toBe(0);
  });

  it("matches case-insensitively and substring-wise", () => {
    expect(calcColorAdjustmentPct("Pearl White", cfg)).toBe(1);
    expect(calcColorAdjustmentPct("BLACK", cfg)).toBe(1);
    expect(calcColorAdjustmentPct("Burgundy Red", cfg)).toBe(-3);
  });

  it("handles multi-word color keys", () => {
    expect(calcColorAdjustmentPct("Deep Blue Metallic", cfg)).toBe(-2);
  });

  it("returns 0 when no adjustment-list color is in the input", () => {
    expect(calcColorAdjustmentPct("Silver", cfg)).toBe(0);
  });

  it("returns the first match if multiple keys would match (insertion order)", () => {
    // "Black Cherry" contains "black" — matched first since cfg has black before red.
    // We assert the insertion-order semantics so any future change to a
    // first-match-wins-ordered-by-priority strategy is caught.
    expect(calcColorAdjustmentPct("Black Cherry", cfg)).toBe(1);
  });
});

// ─────────────────────────────────────────────────────────────
// calcAIConditionAdjustment
// ─────────────────────────────────────────────────────────────
describe("calcAIConditionAdjustment", () => {
  it("returns 0 when AI score is missing", () => {
    expect(calcAIConditionAdjustment(20000, "good", null, null)).toBe(0);
    expect(calcAIConditionAdjustment(20000, "good", undefined, "ok")).toBe(0);
  });

  it("returns 0 when confidence is below the 60% floor", () => {
    expect(calcAIConditionAdjustment(20000, "excellent", "fair", "scratches", 50)).toBe(0);
  });

  it("returns 0 when AI agrees with the customer", () => {
    expect(calcAIConditionAdjustment(20000, "good", "good", null, 90)).toBe(0);
  });

  it("penalises (positive %) when AI sees worse condition than reported, scaled by gap", () => {
    // ranks: excellent=4, very_good=3, good=2, fair=1
    // Use base 15000 so 8% (1200) and 3% (450) fit inside the ±$1500 cap
    // and we're testing the math, not the cap.
    // customer "excellent" (4), AI "good" (2) → gap=2 → 8% of 15000 = 1200
    expect(calcAIConditionAdjustment(15000, "excellent", "good", null, 90)).toBe(1200);
    // customer "excellent" (4), AI "fair" (1) → gap=3 → 15% → 2250 → capped at 1500
    expect(calcAIConditionAdjustment(15000, "excellent", "fair", null, 90)).toBe(1500);
    // customer "excellent" (4), AI "very_good" (3) → gap=1 → 3% → 450
    expect(calcAIConditionAdjustment(15000, "excellent", "very_good", null, 90)).toBe(450);
  });

  it("rewards (negative %) when AI sees better condition than reported", () => {
    // customer "fair" (1), AI "good" (2) → gap=1 → -3% → -600
    expect(calcAIConditionAdjustment(20000, "fair", "good", null, 90)).toBe(-600);
    // customer "fair" (1), AI "excellent" (4) → gap=3 → -5% → -1000
    expect(calcAIConditionAdjustment(20000, "fair", "excellent", null, 90)).toBe(-1000);
  });

  it("caps the absolute value at $1500 in either direction", () => {
    // 100k base, gap=3 → 15% would be 15000; cap at 1500
    expect(calcAIConditionAdjustment(100_000, "excellent", "fair", null, 90)).toBe(1500);
    // No symmetric -15% reward exists in the function, but verify the
    // negative-cap path works for an arbitrarily large reward by using
    // a base big enough to trigger the cap with a -5% gap.
    expect(calcAIConditionAdjustment(100_000, "fair", "excellent", null, 90)).toBe(-1500);
  });
});

// ─────────────────────────────────────────────────────────────
// calculateOffer — smoke tests pinning the headline invariants
// ─────────────────────────────────────────────────────────────

function makeBBVehicle(overrides: Partial<BBVehicle> = {}): BBVehicle {
  return {
    uvc: "TESTUVC",
    vin: "TESTVIN1234567890",
    year: "2021",
    make: "Honda",
    model: "Accord",
    series: "EX",
    style: "Sedan",
    class_name: "Mid-Size Car",
    msrp: 30000,
    price_includes: "",
    drivetrain: "FWD",
    transmission: "Automatic",
    engine: "2.0L",
    fuel_type: "Gasoline",
    exterior_colors: [],
    mileage_adj: 0,
    regional_adj: 0,
    base_whole_avg: 18000,
    add_deduct_list: [],
    wholesale: { xclean: 19000, clean: 18000, avg: 17000, rough: 16000 },
    tradein:   { clean: 19500, avg: 18500, rough: 17500 },
    retail:    { xclean: 23000, clean: 22000, avg: 21000, rough: 19500 },
    ...overrides,
  };
}

function makeForm(overrides: Partial<FormData> = {}): FormData {
  // The calculator filters damage arrays by `d !== "none"`, so the
  // "No <thing>" strings the customer-facing form actually sends would
  // each count as a real damage item. Empty arrays are the only
  // damage-free fixture; matches what selecting nothing would persist.
  return {
    ...initialFormData,
    vin: "TESTVIN1234567890",
    mileage: "60000",
    overallCondition: "good",
    exteriorDamage: [],
    interiorDamage: [],
    techIssues: [],
    engineIssues: [],
    mechanicalIssues: [],
    drivable: "Drivable",
    accidents: "No accidents",
    smokedIn: "No",
    tiresReplaced: "All 4 tires replaced recently",
    numKeys: "2+ keys",
    windshieldDamage: "No windshield damage",
    moonroof: "No moonroof",
    ...overrides,
  };
}

describe("calculateOffer", () => {
  it("returns null when bbVehicle is null", () => {
    expect(calculateOffer(null, makeForm(), [])).toBeNull();
  });

  it("returns null when the resolved BB tier value is zero", () => {
    // With overallCondition="good", default condition_basis_map maps to
    // "tradein_avg". Force that tier to 0 so getBBValue returns 0.
    const bb = makeBBVehicle({ tradein: { clean: 0, avg: 0, rough: 0 } });
    expect(calculateOffer(bb, makeForm(), [])).toBeNull();
  });

  it("produces a positive low/high offer for a clean submission", () => {
    const result = calculateOffer(makeBBVehicle(), makeForm(), []);
    expect(result).not.toBeNull();
    expect(result!.low).toBeGreaterThan(0);
    expect(result!.high).toBeGreaterThanOrEqual(result!.low);
    expect(result!.totalDeductions).toBe(0); // clean submission, nothing to deduct
  });

  it("applies an accident deduction when the customer reports one", () => {
    const clean  = calculateOffer(makeBBVehicle(), makeForm({ accidents: "1 accident" }), [])!;
    const noAcc  = calculateOffer(makeBBVehicle(), makeForm(), [])!;
    expect(clean.high).toBeLessThan(noAcc.high);
    // Default DEFAULT_DEDUCTION_AMOUNTS.accidents_1 = 800
    expect(clean.totalDeductions).toBe(DEFAULT_DEDUCTION_AMOUNTS.accidents_1);
  });

  it("never produces an offer below the configured floor", () => {
    // Construct a settings where the floor is high enough to clamp.
    const settings: OfferSettings = {
      bb_value_basis: "tradein_avg",
      global_adjustment_pct: -100,                      // wipe out all value
      regional_adjustment_pct: 0,
      deductions_config: {} as OfferSettings["deductions_config"],
      deduction_amounts: DEFAULT_DEDUCTION_AMOUNTS,
      condition_multipliers: { excellent: 1, very_good: 1, good: 1, fair: 1 },
      condition_basis_map: { excellent: "retail_xclean", very_good: "tradein_clean", good: "tradein_avg", fair: "wholesale_rough" },
      condition_equipment_map: { excellent: false, very_good: false, good: false, fair: false },
      recon_cost: 0,
      offer_floor: 750,
      offer_ceiling: null,
      age_tiers: [],
      mileage_tiers: [],
      low_mileage_bonus: { ...DEFAULT_LOW_MILEAGE_BONUS, enabled: false },
    };
    const result = calculateOffer(makeBBVehicle(), makeForm(), [], settings)!;
    expect(result.low).toBeGreaterThanOrEqual(settings.offer_floor);
    expect(result.high).toBeGreaterThanOrEqual(settings.offer_floor);
  });
});

// ─────────────────────────────────────────────────────────────
// Market adjustment — tested through `calculateOffer` since
// `calcMarketAdjustment` is private. Pins the strategy×days-supply
// bracket math that decides how much a tight or soft market moves
// the customer's offer.
// ─────────────────────────────────────────────────────────────

function settingsWithMarket(strategy: StrategyMode, marketEnabled: boolean): OfferSettings {
  return {
    bb_value_basis: "tradein_avg",
    global_adjustment_pct: 0,
    regional_adjustment_pct: 0,
    deductions_config: {} as OfferSettings["deductions_config"],
    deduction_amounts: DEFAULT_DEDUCTION_AMOUNTS,
    condition_multipliers: { excellent: 1, very_good: 1, good: 1, fair: 1 },
    // Force basis to tradein_avg for every condition so the test isn't
    // entangled with strategy-driven basis flips.
    condition_basis_map: { excellent: "tradein_avg", very_good: "tradein_avg", good: "tradein_avg", fair: "tradein_avg" },
    condition_equipment_map: { excellent: false, very_good: false, good: false, fair: false },
    recon_cost: 0,
    offer_floor: 0,
    offer_ceiling: null,
    age_tiers: [],
    mileage_tiers: [],
    low_mileage_bonus: { ...DEFAULT_LOW_MILEAGE_BONUS, enabled: false },
    strategy_mode: strategy,
    market_adjustment: { ...DEFAULT_MARKET_ADJUSTMENT, enabled: marketEnabled },
  };
}

describe("calculateOffer — market adjustment", () => {
  it("returns marketAdjustment=0 when market config is disabled", () => {
    const result = calculateOffer(
      makeBBVehicle(),
      makeForm(),
      [],
      settingsWithMarket("standard", false),
      [],
      undefined,
      15, // marketDaysSupply — would be in the +10% bracket if enabled
    )!;
    expect(result.marketAdjustment).toBe(0);
  });

  it("returns marketAdjustment=0 when marketDaysSupply is not provided", () => {
    const result = calculateOffer(
      makeBBVehicle(),
      makeForm(),
      [],
      settingsWithMarket("standard", true),
    )!;
    expect(result.marketAdjustment).toBe(0);
  });

  it("applies the matching bracket's adjustment_pct under standard strategy", () => {
    // Standard strategy at days-supply=15 → +10% bracket (max_days: 20).
    // Exact dollar value depends on the full waterfall (recon, age tiers,
    // ...); the invariant we pin is: positive, within ~10% ballpark of the
    // base tradein_avg, and the metadata fields are populated.
    const result = calculateOffer(
      makeBBVehicle(),
      makeForm(),
      [],
      settingsWithMarket("standard", true),
      [],
      undefined,
      15,
    )!;
    expect(result.marketAdjustment).toBeGreaterThan(1000);
    expect(result.marketAdjustment).toBeLessThan(2500);
    expect(result.marketDaysSupply).toBe(15);
    expect(result.strategyMode).toBe("standard");
  });

  it("conservative strategy applies smaller positive adjustments than aggressive in tight markets", () => {
    const conservative = calculateOffer(
      makeBBVehicle(), makeForm(), [],
      settingsWithMarket("conservative", true), [], undefined, 15,
    )!;
    const aggressive = calculateOffer(
      makeBBVehicle(), makeForm(), [],
      settingsWithMarket("aggressive", true), [], undefined, 15,
    )!;
    // At days_supply=15: conservative=+5%, aggressive=+14%.
    expect(aggressive.marketAdjustment).toBeGreaterThan(conservative.marketAdjustment);
    // And both should be positive in a tight market.
    expect(conservative.marketAdjustment).toBeGreaterThan(0);
    expect(aggressive.marketAdjustment).toBeGreaterThan(0);
  });

  it("applies a negative adjustment when days_supply is very high (slow-moving inventory)", () => {
    // Standard at days_supply=120 → -9% bracket (max_days: 9999, last
    // bucket since 120 > 90 but ≤ 9999).
    const result = calculateOffer(
      makeBBVehicle(), makeForm(), [],
      settingsWithMarket("standard", true), [], undefined, 120,
    )!;
    expect(result.marketAdjustment).toBeLessThan(0);
  });

  it("soft-market penalty further reduces when avg sold is well below avg asking", () => {
    // Standard at days_supply=15 normally → +10%.
    // Provide asking=20000, sold=15000 → spread = 25%, above the
    // default 10% threshold → soft penalty (default -3pp) applied.
    const tight = calculateOffer(
      makeBBVehicle(), makeForm(), [],
      settingsWithMarket("standard", true), [], undefined, 15,
    )!;
    const soft = calculateOffer(
      makeBBVehicle(), makeForm(), [],
      settingsWithMarket("standard", true), [], undefined, 15, 15000, 20000,
    )!;
    expect(soft.marketAdjustment).toBeLessThan(tight.marketAdjustment);
  });

  it("tight-market bonus adds on top when sold ≈ asking (<2% spread)", () => {
    // sold/asking spread = 1% → triggers tight-market bonus
    const tightBonus = calculateOffer(
      makeBBVehicle(), makeForm(), [],
      settingsWithMarket("standard", true), [], undefined, 15, 19800, 20000,
    )!;
    const tightBase = calculateOffer(
      makeBBVehicle(), makeForm(), [],
      settingsWithMarket("standard", true), [], undefined, 15,
    )!;
    expect(tightBonus.marketAdjustment).toBeGreaterThan(tightBase.marketAdjustment);
  });
});

// ─────────────────────────────────────────────────────────────
// Strategy mode — verifies the four bracket arrays in
// MARKET_ADJUSTMENT_BY_STRATEGY are structurally well-formed
// (sorted ascending, span the days-supply space, no orphans).
// Catches accidental edits to the tables.
// ─────────────────────────────────────────────────────────────
describe("MARKET_ADJUSTMENT_BY_STRATEGY constants", () => {
  const STRATEGIES: StrategyMode[] = ["conservative", "standard", "aggressive", "predator", "custom"];

  for (const strat of STRATEGIES) {
    it(`${strat}: brackets are sorted ascending by max_days`, () => {
      const brackets = MARKET_ADJUSTMENT_BY_STRATEGY[strat];
      for (let i = 1; i < brackets.length; i++) {
        expect(brackets[i].max_days).toBeGreaterThan(brackets[i - 1].max_days);
      }
    });

    it(`${strat}: the highest bracket caps at >= 90 days (covers the slow-inventory tail)`, () => {
      const brackets = MARKET_ADJUSTMENT_BY_STRATEGY[strat];
      const highest = brackets[brackets.length - 1];
      expect(highest.max_days).toBeGreaterThanOrEqual(90);
    });

    it(`${strat}: adjustment trends downward as days_supply rises (tight → slow inventory)`, () => {
      const brackets = MARKET_ADJUSTMENT_BY_STRATEGY[strat];
      // Strict monotone non-increase: each next bucket ≤ prev.
      for (let i = 1; i < brackets.length; i++) {
        expect(brackets[i].adjustment_pct).toBeLessThanOrEqual(brackets[i - 1].adjustment_pct);
      }
    });
  }

  it("aggressive is more aggressive than conservative at every bracket", () => {
    const aggr = MARKET_ADJUSTMENT_BY_STRATEGY.aggressive;
    const cons = MARKET_ADJUSTMENT_BY_STRATEGY.conservative;
    expect(aggr.length).toBe(cons.length);
    for (let i = 0; i < aggr.length; i++) {
      expect(aggr[i].adjustment_pct).toBeGreaterThanOrEqual(cons[i].adjustment_pct);
    }
  });
});

// ─────────────────────────────────────────────────────────────
// AI condition adjustment flowing through calculateOffer
// ─────────────────────────────────────────────────────────────
describe("calculateOffer — AI condition adjustment flow-through", () => {
  it("subtracts from the offer when AI sees worse condition than reported", () => {
    const noAi = calculateOffer(makeBBVehicle(), makeForm({ overallCondition: "excellent" }), [])!;
    const aiSeesFair = calculateOffer(
      makeBBVehicle(),
      makeForm({ overallCondition: "excellent" }),
      [],
      undefined, undefined, undefined, undefined, undefined, undefined,
      "fair",      // ai_condition_score: 3 ranks lower than excellent
      "scratches",
      90,
    )!;
    expect(aiSeesFair.aiConditionAdjustment).toBeGreaterThan(0); // deduction
    expect(aiSeesFair.high).toBeLessThan(noAi.high);
  });

  it("adds to the offer when AI sees better condition than reported", () => {
    const noAi = calculateOffer(makeBBVehicle(), makeForm({ overallCondition: "fair" }), [])!;
    const aiSeesGood = calculateOffer(
      makeBBVehicle(),
      makeForm({ overallCondition: "fair" }),
      [],
      undefined, undefined, undefined, undefined, undefined, undefined,
      "excellent",
      "no visible damage",
      90,
    )!;
    expect(aiSeesGood.aiConditionAdjustment).toBeLessThan(0); // reward
    expect(aiSeesGood.high).toBeGreaterThan(noAi.high);
  });

  it("ignores AI when confidence is below 60% (matches calcAIConditionAdjustment threshold)", () => {
    const lowConf = calculateOffer(
      makeBBVehicle(),
      makeForm({ overallCondition: "excellent" }),
      [],
      undefined, undefined, undefined, undefined, undefined, undefined,
      "fair",
      "scratches",
      40, // below 60 floor
    )!;
    expect(lowConf.aiConditionAdjustment).toBe(0);
  });
});
