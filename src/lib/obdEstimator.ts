import { supabase } from "@/integrations/supabase/client";

/**
 * OBD-II repair cost estimator.
 *
 * Layer 1 — static code → base range (from obd_repair_estimates)
 * Layer 2 — vehicle_adjuster multiplier (make_class × age_band × mileage_band)
 * Layer 3 — optional inspector-note adjustment (via estimate-inspector-note edge fn)
 *
 * Output feeds into offer_settings.recon_cost on the offer engine so the
 * dealer's offer automatically nets out anticipated repair.
 *
 * Intentionally deterministic for layers 1–2 so results are reproducible
 * and dealer-adjustable without calling an LLM on every estimate.
 */

// ─── Make class taxonomy ────────────────────────────────────────────────
// Grouped by what they actually cost to repair, not marketing tier. Luxury
// European sits noticeably higher because of parts catalog + labor rates.
const LUXURY_EUROPEAN = new Set([
  "bmw", "mercedes-benz", "mercedes", "audi", "porsche", "land rover",
  "range rover", "jaguar", "mini", "volvo", "maserati", "bentley", "rolls-royce",
  "alfa romeo", "aston martin",
]);
const LUXURY_AMERICAN_ASIAN = new Set([
  "lexus", "acura", "infiniti", "genesis", "cadillac", "lincoln",
  "tesla", "polestar", "rivian", "lucid",
]);
const MAINSTREAM_JAPANESE = new Set([
  "toyota", "honda", "mazda", "subaru", "nissan", "mitsubishi", "suzuki",
]);
const MAINSTREAM_AMERICAN = new Set([
  "ford", "chevrolet", "chevy", "gmc", "buick", "dodge", "ram", "jeep",
  "chrysler",
]);
const MAINSTREAM_KOREAN = new Set([
  "hyundai", "kia",
]);
const MAINSTREAM_EUROPEAN = new Set([
  "volkswagen", "vw", "fiat",
]);

export type MakeClass =
  | "luxury_european"
  | "luxury_american_asian"
  | "mainstream_japanese"
  | "mainstream_american"
  | "mainstream_korean"
  | "mainstream_european"
  | "unknown";

export function classifyMake(make: string | null | undefined): MakeClass {
  if (!make) return "unknown";
  const m = make.trim().toLowerCase();
  if (LUXURY_EUROPEAN.has(m)) return "luxury_european";
  if (LUXURY_AMERICAN_ASIAN.has(m)) return "luxury_american_asian";
  if (MAINSTREAM_JAPANESE.has(m)) return "mainstream_japanese";
  if (MAINSTREAM_AMERICAN.has(m)) return "mainstream_american";
  if (MAINSTREAM_KOREAN.has(m)) return "mainstream_korean";
  if (MAINSTREAM_EUROPEAN.has(m)) return "mainstream_european";
  return "unknown";
}

// Make class multipliers, anchored on "mainstream American" as 1.00 (the
// seed ranges are calibrated to that baseline).
const MAKE_CLASS_MULT: Record<MakeClass, number> = {
  luxury_european:       1.85,
  luxury_american_asian: 1.35,
  mainstream_european:   1.25,
  mainstream_japanese:   1.00,
  mainstream_american:   1.00,
  mainstream_korean:     0.90,
  unknown:               1.05, // mild premium for unknown — avoids under-estimating
};

// Age-band multiplier. Older cars = harder to source parts, more collateral
// damage likely, but also fewer labor-hours vs. a new-vehicle dealer scan
// cycle. Net effect leans slightly higher with age.
export type AgeBand = "0-3" | "4-7" | "8-12" | "13+";
export function classifyAge(vehicleYear: number | null | undefined): AgeBand {
  if (!vehicleYear || vehicleYear < 1990) return "13+";
  const age = new Date().getFullYear() - vehicleYear;
  if (age <= 3)  return "0-3";
  if (age <= 7)  return "4-7";
  if (age <= 12) return "8-12";
  return "13+";
}
const AGE_BAND_MULT: Record<AgeBand, number> = {
  "0-3":  0.90,
  "4-7":  1.00,
  "8-12": 1.10,
  "13+":  1.20,
};

// Mileage-band multiplier. High-mileage cars often need the adjacent
// component replaced too (water pump on timing job, tensioner on accessory
// belt), so the high-end drifts up.
export type MileageBand = "<75k" | "75-125k" | "125-175k" | "175k+";
export function classifyMileage(mileage: number | null | undefined): MileageBand {
  if (!mileage || mileage <= 0) return "75-125k"; // reasonable unknown default
  if (mileage < 75_000)  return "<75k";
  if (mileage < 125_000) return "75-125k";
  if (mileage < 175_000) return "125-175k";
  return "175k+";
}
const MILEAGE_BAND_MULT: Record<MileageBand, number> = {
  "<75k":     0.95,
  "75-125k":  1.00,
  "125-175k": 1.08,
  "175k+":    1.18,
};

// ─── Public API ─────────────────────────────────────────────────────────

export interface VehicleContext {
  make: string | null | undefined;
  vehicle_year: number | null | undefined;
  mileage: number | null | undefined;
}

export function vehicleMultiplier(v: VehicleContext): number {
  const makeM = MAKE_CLASS_MULT[classifyMake(v.make)];
  const ageM = AGE_BAND_MULT[classifyAge(v.vehicle_year)];
  const milM = MILEAGE_BAND_MULT[classifyMileage(v.mileage)];
  return Number((makeM * ageM * milM).toFixed(3));
}

export interface ObdCodeEstimate {
  code: string;
  code_title: string;
  repair_category: string;
  common_causes: string[];
  cost_low: number;
  cost_expected: number;
  cost_high: number;
  severity: "minor" | "moderate" | "severe";
  often_trivial: boolean;
}

export interface LineItem {
  code: string;
  code_title: string;
  category: string;
  severity: "minor" | "moderate" | "severe";
  often_trivial: boolean;
  base_low: number;
  base_expected: number;
  base_high: number;
  adjusted_low: number;
  adjusted_expected: number;
  adjusted_high: number;
}

export interface EstimateResult {
  low: number;
  expected: number;
  high: number;
  /** Multiplier applied to every base cost. Shown to the appraiser so they can sanity-check. */
  vehicle_multiplier: number;
  /** Optional inspector-note nudge added on top of layers 1+2. Null when no notes. */
  inspector_adjustment_pct: number | null;
  /** 0–100 — floor of our confidence; lower when codes are scarce or adjustments are wide. */
  confidence: number;
  line_items: LineItem[];
  notes: string[];
}

/**
 * Fetch the stored baseline for each code.
 * Unknown codes are returned with a zero-cost line item + a note; we'd
 * rather show the appraiser a stub than silently drop it.
 */
export async function fetchCodeBaselines(codes: string[]): Promise<Map<string, ObdCodeEstimate>> {
  if (!codes.length) return new Map();
  const unique = Array.from(new Set(codes.map((c) => c.trim().toUpperCase()))).filter(Boolean);
  const { data } = await supabase
    .from("obd_repair_estimates" as any)
    .select("code, code_title, repair_category, common_causes, cost_low, cost_expected, cost_high, severity, often_trivial")
    .in("code", unique);
  const out = new Map<string, ObdCodeEstimate>();
  for (const row of ((data as unknown) as ObdCodeEstimate[]) || []) {
    out.set(row.code.toUpperCase(), row);
  }
  return out;
}

export interface EstimateOptions {
  codes: string[];
  vehicle: VehicleContext;
  /**
   * Inspector-note adjustment percent from the estimate-inspector-note edge
   * function (or manually entered in the UI). e.g. +20 pushes the estimate
   * up 20% above the base-plus-vehicle-multiplier total.
   */
  inspector_adjustment_pct?: number | null;
  /** How many of the inspector's notes produced that pct. Used for confidence. */
  inspector_note_count?: number;
}

export async function estimateRepairCost(opts: EstimateOptions): Promise<EstimateResult> {
  const multiplier = vehicleMultiplier(opts.vehicle);
  const baselines = await fetchCodeBaselines(opts.codes);
  const notes: string[] = [];
  const line_items: LineItem[] = [];

  let totalLow = 0;
  let totalExp = 0;
  let totalHigh = 0;
  let unknownCount = 0;

  const unique = Array.from(new Set(opts.codes.map((c) => c.trim().toUpperCase()))).filter(Boolean);
  for (const code of unique) {
    const b = baselines.get(code);
    if (!b) {
      unknownCount++;
      line_items.push({
        code,
        code_title: "Unrecognized code — appraiser review needed",
        category: "unknown",
        severity: "moderate",
        often_trivial: false,
        base_low: 0, base_expected: 0, base_high: 0,
        adjusted_low: 0, adjusted_expected: 0, adjusted_high: 0,
      });
      notes.push(`${code}: not in our baseline library — human review needed.`);
      continue;
    }
    const low = Math.round(Number(b.cost_low) * multiplier);
    const exp = Math.round(Number(b.cost_expected) * multiplier);
    const high = Math.round(Number(b.cost_high) * multiplier);
    totalLow += low;
    totalExp += exp;
    totalHigh += high;
    line_items.push({
      code: b.code,
      code_title: b.code_title,
      category: b.repair_category,
      severity: b.severity,
      often_trivial: b.often_trivial,
      base_low: Number(b.cost_low),
      base_expected: Number(b.cost_expected),
      base_high: Number(b.cost_high),
      adjusted_low: low,
      adjusted_expected: exp,
      adjusted_high: high,
    });
    if (b.often_trivial) {
      notes.push(`${b.code} often resolves with a trivial fix (e.g. gas cap, battery reset).`);
    }
  }

  // Apply inspector-note adjustment percent — pushes the whole expected/high
  // up or down. Low is left alone because we don't want to under-promise.
  let inspectorAdjPct = opts.inspector_adjustment_pct ?? null;
  if (inspectorAdjPct != null && !Number.isFinite(inspectorAdjPct)) inspectorAdjPct = null;
  if (inspectorAdjPct) {
    const factor = 1 + inspectorAdjPct / 100;
    totalExp = Math.round(totalExp * factor);
    totalHigh = Math.round(totalHigh * factor);
  }

  // Confidence model: full confidence at 4+ known codes, drop 10pts per
  // unknown code, floor at 40%. Inspector notes lift by 5pts each.
  const knownCount = unique.length - unknownCount;
  let confidence = 60 + Math.min(30, knownCount * 8) - unknownCount * 10;
  confidence += Math.min(10, (opts.inspector_note_count ?? 0) * 5);
  confidence = Math.max(40, Math.min(95, confidence));

  return {
    low: totalLow,
    expected: totalExp,
    high: totalHigh,
    vehicle_multiplier: multiplier,
    inspector_adjustment_pct: inspectorAdjPct,
    confidence,
    line_items,
    notes,
  };
}
