/**
 * bdcLeadScore — rank order for the BDC priority queue.
 *
 * Consumed by the BDCPriorityQueue admin section. Pure — given a
 * submission-shaped row it returns a numeric score (higher = call
 * first) plus a small explanation array so the UI can show WHY a
 * lead is priority #1 ("fresh + price objection + walk-away known").
 *
 * Inputs favored over time ("old lead with no appointment and no
 * reason captured") surface to the top; already-booked or
 * deterministically-lost leads sink. Weights are intentionally round
 * numbers so a dealer tweaking them later can reason about each
 * factor.
 */

export interface ScoreInputs {
  created_at: string;
  offered_price?: number | null;
  estimated_offer_high?: number | null;
  appointment_set?: boolean | null;
  progress_status?: string | null;
  declined_reason?: string | null;
  customer_walk_away_number?: number | null;
  competitor_mentioned?: string | null;
  portal_view_count?: number | null;
  hot_followup_2h_sent_at?: string | null;
  last_outreach_at?: string | null;
}

export interface ScoreResult {
  score: number;
  band: "now" | "today" | "later" | "cold";
  reasons: string[];
}

const DEAD_STATUSES = new Set([
  "lost",
  "purchase_complete",
  "deal_finalized",
  "check_request_submitted",
]);

const daysAgo = (iso: string): number => {
  const ms = Date.now() - new Date(iso).getTime();
  return Math.max(0, ms / (1000 * 60 * 60 * 24));
};

export const scoreBdcLead = (s: ScoreInputs): ScoreResult => {
  const reasons: string[] = [];
  let score = 50;

  if (s.progress_status && DEAD_STATUSES.has(s.progress_status)) {
    return { score: 0, band: "cold", reasons: ["closed or won already"] };
  }
  if (s.appointment_set) {
    // Booked leads aren't BDC's fight anymore — receptionist / sales take over.
    score -= 80;
    reasons.push("appointment booked");
  }
  if (s.declined_reason === "unreachable") {
    score -= 40;
    reasons.push("unreachable");
  }
  if (s.declined_reason === "sold_elsewhere") {
    score -= 60;
    reasons.push("sold elsewhere");
  }

  // Freshness — linear decay across 14 days
  const age = daysAgo(s.created_at);
  const freshnessBonus = Math.max(0, 40 - age * 3);
  score += freshnessBonus;
  if (age < 1) reasons.push("new today");
  else if (age < 3) reasons.push("< 3 days old");

  // Offer size — bigger offers are worth more effort to save
  const offer = s.offered_price ?? s.estimated_offer_high ?? 0;
  if (offer > 0) {
    score += Math.min(20, offer / 500);
    if (offer >= 10000) reasons.push(`$${Math.round(offer / 1000)}k offer`);
  }

  // Engagement — portal views is the strongest real-time signal
  const views = s.portal_view_count ?? 0;
  if (views >= 2) {
    score += 30;
    reasons.push(`${views} portal views`);
  } else if (views === 1) {
    score += 10;
  }

  // Price objection with walk-away captured — BDC can match + close
  if (s.declined_reason === "price_too_low" && s.customer_walk_away_number) {
    score += 25;
    reasons.push("price objection with target");
  }

  // Competitor mentioned — hot, shop-compare mode
  if (s.competitor_mentioned) {
    score += 15;
    reasons.push(`shopping vs ${s.competitor_mentioned}`);
  }

  // Stale (no outreach in 3+ days, no appointment, no dead status) — priority re-touch
  if (!s.appointment_set && !s.progress_status?.startsWith("deal_")) {
    const outreach = s.last_outreach_at ? daysAgo(s.last_outreach_at) : age;
    if (outreach > 3 && outreach < 14) {
      score += 15;
      reasons.push("needs re-touch");
    }
  }

  // No followup triggered yet in the first 4 hours — huge priority
  if (age < 0.17 /* 4h */ && !s.hot_followup_2h_sent_at) {
    score += 35;
    reasons.push("fresh, no followup yet");
  }

  const band: ScoreResult["band"] =
    score >= 90 ? "now" : score >= 60 ? "today" : score >= 30 ? "later" : "cold";

  return { score: Math.round(score), band, reasons };
};
