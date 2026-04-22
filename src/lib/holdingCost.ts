/**
 * holdingCost — pure math for per-unit carrying cost.
 *
 * Called from:
 *   - AppraisalSidebar (pre-acquisition: "if this car sits 30 days…")
 *   - GM Executive HUD (post-acquisition: aged-inventory carrying cost)
 *   - Equity Mining (informs pricing aggressiveness)
 *
 * Inputs are per-tenant (floor_plan_rate_annual_pct,
 * overhead_per_day_per_unit, avg_holding_days_target). Keep this pure —
 * it returns a deterministic shape given the same inputs so tests and
 * explainability stay easy.
 */

export interface TenantHoldingConfig {
  floor_plan_rate_annual_pct: number | null;
  overhead_per_day_per_unit: number | null;
  avg_holding_days_target: number | null;
}

export interface HoldingCostBreakdown {
  /** Per-day carrying cost for this vehicle. */
  perDay: number;
  /** Floor-plan interest component of perDay. */
  perDayInterest: number;
  /** Overhead component of perDay (lot, detail, insurance). */
  perDayOverhead: number;
  /** Cost over the dealer's target days-to-retail. */
  atTarget: number;
  /** Cost projected to `days` (pass days-in-stock for post-acquired math). */
  atDays: (days: number) => number;
  /** True when the tenant hasn't configured a rate — caller can render a diagnostic. */
  configured: boolean;
  /** True when days > avg_holding_days_target — aged inventory warning. */
  isAged: (days: number) => boolean;
}

export const calculateHoldingCost = (
  acv: number | null | undefined,
  config: TenantHoldingConfig | null | undefined,
): HoldingCostBreakdown => {
  const rate = config?.floor_plan_rate_annual_pct ?? 0;
  const overhead = config?.overhead_per_day_per_unit ?? 0;
  const target = config?.avg_holding_days_target ?? 45;
  const configured = !!config && config.floor_plan_rate_annual_pct != null && config.floor_plan_rate_annual_pct > 0;
  const acvNum = typeof acv === "number" && acv > 0 ? acv : 0;

  const perDayInterest = (acvNum * (rate / 100)) / 365;
  const perDayOverhead = Number(overhead) || 0;
  const perDay = perDayInterest + perDayOverhead;

  return {
    perDay,
    perDayInterest,
    perDayOverhead,
    atTarget: perDay * target,
    atDays: (days: number) => perDay * Math.max(0, days),
    configured,
    isAged: (days: number) => days > target,
  };
};

/**
 * formatMoney — small helper for the widget. Not using the global
 * formatter so this stays dependency-free.
 */
export const formatHoldingMoney = (n: number): string => {
  if (!Number.isFinite(n)) return "—";
  if (n < 10) return `$${n.toFixed(2)}`;
  return `$${Math.round(n).toLocaleString()}`;
};
