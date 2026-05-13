// ─────────────────────────────────────────────────────────────
// INVESTMENT SCORE — vAuto-style 1-12 score for an acquisition.
//
// Synthesizes Market Days Supply, Cost-to-Market, condition grade,
// AI agreement, and projected holding cost into one tier the
// sales manager can read at a glance:
//
//   10–12  Platinum  hot car, stretch on it
//   7–9    Gold      solid buy at this number
//   4–6    Silver    marginal — hold the line
//   1–3    Bronze    risky — pass or low-ball
//
// This is INTERNAL dealer intelligence. Never render to consumers.
// ─────────────────────────────────────────────────────────────

export type InvestmentTier = "platinum" | "gold" | "silver" | "bronze";

export type ConditionGrade = "excellent" | "very_good" | "good" | "fair" | "poor";

export interface InvestmentScoreInputs {
  marketDaysSupply: number | null;          // from Black Book ListingsStatistics
  offeredPrice: number | null;              // what we're paying the seller
  retailClean: number | null;               // BB retail clean (target sell price)
  conditionGrade: ConditionGrade | string | null;  // final grade on the file
  aiConditionScore: ConditionGrade | string | null; // Gemini's read
  lotCostPerDay: number;                    // site_config.lot_cost_per_day (default 8)
}

export interface InvestmentScoreBreakdown {
  mdsPoints: number;          // 0–4
  costToMarketPoints: number; // 0–4
  conditionPoints: number;    // 0–2
  aiAgreementPoints: number;  // 0–1
  holdingCostPoints: number;  // 0–1
  total: number;              // 1–12 (clamped)
  tier: InvestmentTier;
  // Helper context for the breakdown UI
  costToMarketPct: number | null;
  projectedHoldingCost: number | null;
}

const CONDITION_RANK: Record<string, number> = {
  excellent: 4,
  very_good: 3,
  good: 2,
  fair: 1,
  poor: 0,
};

function scoreMds(mds: number | null): number {
  if (mds == null) return 2; // neutral if unknown
  if (mds <= 15) return 4;
  if (mds <= 30) return 3;
  if (mds <= 60) return 2;
  if (mds <= 90) return 1;
  return 0;
}

function scoreCostToMarket(offered: number | null, retailClean: number | null): { points: number; pct: number | null } {
  if (!offered || !retailClean || retailClean <= 0) return { points: 2, pct: null };
  const pct = offered / retailClean;
  let points: number;
  if (pct < 0.6) points = 4;
  else if (pct < 0.7) points = 3;
  else if (pct < 0.8) points = 2;
  else if (pct < 0.9) points = 1;
  else points = 0;
  return { points, pct };
}

function scoreCondition(grade: string | null): number {
  if (!grade) return 1;
  const rank = CONDITION_RANK[grade.toLowerCase()] ?? 1;
  // excellent=2, very_good=1.5, good=1, fair=0.5, poor=0
  if (rank >= 4) return 2;
  if (rank >= 3) return 1.5;
  if (rank >= 2) return 1;
  if (rank >= 1) return 0.5;
  return 0;
}

function scoreAiAgreement(reported: string | null, ai: string | null): number {
  if (!reported || !ai) return 0.5; // unknown — give a half point
  const r = CONDITION_RANK[reported.toLowerCase()] ?? 2;
  const a = CONDITION_RANK[ai.toLowerCase()] ?? 2;
  // AI confirms or rates better → full point.
  // AI rates worse → no point (already penalized in waterfall).
  return a >= r ? 1 : 0;
}

function scoreHoldingCost(mds: number | null, lotCostPerDay: number): { points: number; cost: number | null } {
  if (mds == null) return { points: 0.5, cost: null };
  const cost = mds * (lotCostPerDay || 8);
  // Cheap to hold = bonus; expensive = no points.
  let points: number;
  if (cost < 200) points = 1;
  else if (cost < 400) points = 0.5;
  else points = 0;
  return { points, cost };
}

const tierFor = (total: number): InvestmentTier => {
  if (total >= 10) return "platinum";
  if (total >= 7) return "gold";
  if (total >= 4) return "silver";
  return "bronze";
};

export function calculateInvestmentScore(inputs: InvestmentScoreInputs): InvestmentScoreBreakdown {
  const mdsPoints = scoreMds(inputs.marketDaysSupply);
  const ctm = scoreCostToMarket(inputs.offeredPrice, inputs.retailClean);
  const conditionPoints = scoreCondition(inputs.conditionGrade as string | null);
  const aiAgreementPoints = scoreAiAgreement(
    inputs.conditionGrade as string | null,
    inputs.aiConditionScore as string | null,
  );
  const holding = scoreHoldingCost(inputs.marketDaysSupply, inputs.lotCostPerDay);

  const total = Math.max(
    1,
    Math.min(12, Math.round(mdsPoints + ctm.points + conditionPoints + aiAgreementPoints + holding.points)),
  );

  return {
    mdsPoints,
    costToMarketPoints: ctm.points,
    conditionPoints,
    aiAgreementPoints,
    holdingCostPoints: holding.points,
    total,
    tier: tierFor(total),
    costToMarketPct: ctm.pct,
    projectedHoldingCost: holding.cost,
  };
}

export const TIER_META: Record<InvestmentTier, { label: string; tagline: string; tw: { bg: string; text: string; border: string; ring: string } }> = {
  platinum: {
    label: "Platinum",
    tagline: "Hot car — stretch on it",
    tw: { bg: "bg-cyan-500/10", text: "text-cyan-700 dark:text-cyan-300", border: "border-cyan-500/40", ring: "ring-cyan-500/30" },
  },
  gold: {
    label: "Gold",
    tagline: "Solid buy at this number",
    tw: { bg: "bg-amber-500/10", text: "text-amber-700 dark:text-amber-300", border: "border-amber-500/40", ring: "ring-amber-500/30" },
  },
  silver: {
    label: "Silver",
    tagline: "Marginal — hold the line",
    tw: { bg: "bg-slate-500/10", text: "text-slate-700 dark:text-slate-300", border: "border-slate-400/40", ring: "ring-slate-400/30" },
  },
  bronze: {
    label: "Bronze",
    tagline: "Risky — pass or low-ball",
    tw: { bg: "bg-rose-500/10", text: "text-rose-700 dark:text-rose-300", border: "border-rose-500/40", ring: "ring-rose-500/30" },
  },
};
