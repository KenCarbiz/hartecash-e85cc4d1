/**
 * Vehicle desirability tier — bronze / silver / gold / platinum.
 *
 * Inspired by vAuto's ProfitTime ranking but computed entirely from
 * fields we already have on the submission: Black Book retail vs
 * wholesale spread, vehicle age, mileage relative to age, and the
 * offer-to-retail ratio. No new data dependencies.
 *
 * The pill is shown at acquisition time, BEFORE the vehicle becomes
 * inventory, to help the appraiser / sales / GSM see at a glance
 * whether this is a "buy aggressively" car (Platinum: thin spread
 * predicted, easy to retail) versus a "wholesale-only candidate"
 * (Bronze: thick spread needed, will sit on the lot).
 *
 * Scoring (additive, capped 0-100):
 *
 *   Retail-vs-wholesale spread (bb_retail_avg - bb_wholesale_avg):
 *     > $5k     +30
 *     $3-5k     +20
 *     $1.5-3k   +10
 *     < $1.5k   +0
 *
 *   Vehicle age (current year - vehicle_year):
 *     ≤ 3 yrs    +25
 *     4-6 yrs    +15
 *     7-10 yrs   +5
 *     > 10 yrs   -5
 *
 *   Annual mileage ratio (mileage / age):
 *     < 10k/yr   +20    (well below average; high demand)
 *     10-13k/yr  +12    (typical)
 *     13-16k/yr  +5
 *     > 16k/yr   -5     (high-mileage flag)
 *
 *   Offer-to-retail ratio (offered_price / bb_retail_avg):
 *     < 0.55     +25    (great margin)
 *     0.55-0.65  +15
 *     0.65-0.75  +5
 *     > 0.75     -10    (thin margin)
 *
 * Tier thresholds (after the additive score):
 *   ≥ 80   Platinum
 *   60-79  Gold
 *   40-59  Silver
 *   < 40   Bronze
 *
 * Returns null when we don't have enough data to compute (no BB
 * values OR no vehicle year). The pill component hides on null.
 */

export type DesirabilityTier = "platinum" | "gold" | "silver" | "bronze";

export interface DesirabilityResult {
  tier: DesirabilityTier;
  score: number;
  inputs: {
    spread: number | null;
    age_years: number | null;
    annual_mileage: number | null;
    offer_to_retail: number | null;
  };
  /** Short reason strings the tooltip surfaces. Worst-input goes first. */
  rationale: string[];
}

interface DesirabilitySubmission {
  vehicle_year: string | null;
  mileage: string | null;
  offered_price: number | null;
  estimated_offer_high: number | null;
  bb_wholesale_avg?: number | null;
  bb_retail_avg?: number | null;
  bb_tradein_avg?: number | null;
}

export function computeDesirabilityTier(
  sub: DesirabilitySubmission,
): DesirabilityResult | null {
  const retail   = numOrNull(sub.bb_retail_avg);
  const wholesale = numOrNull(sub.bb_wholesale_avg);
  const year     = parseIntOrNull(sub.vehicle_year);

  // Need at least year + one BB anchor to compute anything meaningful.
  if (year == null || (retail == null && wholesale == null)) return null;

  const currentYear = new Date().getUTCFullYear();
  const age = Math.max(0, currentYear - year);
  const mileage = parseIntOrNull(sub.mileage);
  const annualMileage = mileage != null && age > 0
    ? Math.round(mileage / age)
    : (mileage != null && age === 0 ? mileage : null);
  const offer = numOrNull(sub.offered_price) ?? numOrNull(sub.estimated_offer_high);
  const spread = retail != null && wholesale != null
    ? Math.max(0, retail - wholesale)
    : null;
  const offerRatio = offer != null && retail != null && retail > 0
    ? offer / retail
    : null;

  let score = 0;
  const rationale: { label: string; severity: number }[] = [];

  // ── Spread ────────────────────────────────────────────────────
  if (spread != null) {
    if (spread > 5000)         { score += 30; rationale.push({ label: `$${kFormat(spread)} retail spread`, severity: 0 }); }
    else if (spread >= 3000)   { score += 20; rationale.push({ label: `$${kFormat(spread)} retail spread`, severity: 0 }); }
    else if (spread >= 1500)   { score += 10; rationale.push({ label: `$${kFormat(spread)} retail spread`, severity: 1 }); }
    else                       { rationale.push({ label: `thin spread ($${kFormat(spread)})`, severity: 3 }); }
  }

  // ── Age ───────────────────────────────────────────────────────
  if (age <= 3)        { score += 25; rationale.push({ label: `${age}yr old`, severity: 0 }); }
  else if (age <= 6)   { score += 15; rationale.push({ label: `${age}yr old`, severity: 1 }); }
  else if (age <= 10)  { score += 5;  rationale.push({ label: `${age}yr old`, severity: 2 }); }
  else                 { score -= 5;  rationale.push({ label: `${age}yr old — aging`, severity: 3 }); }

  // ── Mileage ───────────────────────────────────────────────────
  if (annualMileage != null) {
    if (annualMileage < 10000)        { score += 20; rationale.push({ label: `${kFormat(annualMileage)} mi/yr — low`, severity: 0 }); }
    else if (annualMileage <= 13000)  { score += 12; rationale.push({ label: `${kFormat(annualMileage)} mi/yr`, severity: 1 }); }
    else if (annualMileage <= 16000)  { score += 5;  rationale.push({ label: `${kFormat(annualMileage)} mi/yr`, severity: 2 }); }
    else                              { score -= 5;  rationale.push({ label: `${kFormat(annualMileage)} mi/yr — high`, severity: 3 }); }
  }

  // ── Offer-to-retail ratio ─────────────────────────────────────
  if (offerRatio != null) {
    const pct = Math.round(offerRatio * 100);
    if (offerRatio < 0.55)        { score += 25; rationale.push({ label: `offer at ${pct}% of retail — strong margin`, severity: 0 }); }
    else if (offerRatio < 0.65)   { score += 15; rationale.push({ label: `offer at ${pct}% of retail`, severity: 1 }); }
    else if (offerRatio < 0.75)   { score += 5;  rationale.push({ label: `offer at ${pct}% of retail`, severity: 2 }); }
    else                          { score -= 10; rationale.push({ label: `offer at ${pct}% of retail — thin`, severity: 3 }); }
  }

  score = Math.max(0, Math.min(100, score));

  const tier: DesirabilityTier =
    score >= 80 ? "platinum"
    : score >= 60 ? "gold"
    : score >= 40 ? "silver"
    : "bronze";

  // Sort rationale worst-first so the tooltip leads with the
  // signals that matter most for the call.
  rationale.sort((a, b) => b.severity - a.severity);

  return {
    tier,
    score,
    inputs: {
      spread,
      age_years: age,
      annual_mileage: annualMileage,
      offer_to_retail: offerRatio,
    },
    rationale: rationale.map((r) => r.label),
  };
}

function numOrNull(v: number | null | undefined): number | null {
  if (v == null) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function parseIntOrNull(v: string | number | null | undefined): number | null {
  if (v == null) return null;
  const n = typeof v === "number" ? v : parseInt(String(v).replace(/\D/g, ""), 10);
  return Number.isFinite(n) ? n : null;
}

function kFormat(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(n >= 10000 ? 0 : 1)}k`;
  return String(Math.round(n));
}
