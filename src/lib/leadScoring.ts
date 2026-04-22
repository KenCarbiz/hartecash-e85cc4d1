/**
 * leadScoring.ts — Predictive lead scoring
 *
 * Runs client-side on already-loaded submission data.
 * Returns a 0–100 score, a human label, and the top factors that
 * contributed to (or detracted from) the score.
 */

interface ScoringFactor {
  label: string;
  points: number;
}

export function calculateLeadScore(submission: any): {
  score: number;
  label: string;
  factors: string[];
} {
  const factors: ScoringFactor[] = [];

  // ── Positive signals ──

  if (submission.vin) {
    factors.push({ label: "Has VIN — serious seller", points: 15 });
  }

  if (submission.photos_uploaded) {
    factors.push({ label: "Photos uploaded — engaged", points: 12 });
  }

  if (submission.docs_uploaded) {
    factors.push({ label: "Docs uploaded — very engaged", points: 10 });
  }

  if (submission.appointment_set) {
    factors.push({ label: "Appointment set — committed", points: 15 });
  }

  if (submission.mileage) {
    const miles = typeof submission.mileage === "string"
      ? parseInt(submission.mileage.replace(/[^0-9]/g, ""), 10)
      : Number(submission.mileage);
    if (!isNaN(miles) && miles > 0 && miles < 80_000) {
      factors.push({ label: "Low mileage (<80k) — more valuable", points: 8 });
    }
  }

  const condition = (submission.overall_condition || "").toLowerCase();
  if (condition === "excellent" || condition === "very_good") {
    factors.push({ label: "Excellent/very good condition — desirable", points: 10 });
  }

  // Responded within 24 hrs: has a status_updated_at within 24 hrs of created_at
  if (submission.status_updated_at && submission.created_at) {
    const createdMs = new Date(submission.created_at).getTime();
    const updatedMs = new Date(submission.status_updated_at).getTime();
    if (updatedMs - createdMs <= 24 * 60 * 60 * 1000 && updatedMs > createdMs) {
      factors.push({ label: "Responded within 24hrs — urgency", points: 8 });
    }
  }

  if (submission.offered_price != null && submission.offered_price > 0) {
    factors.push({ label: "Has offered price — deal in progress", points: 12 });
  }

  const source = (submission.lead_source || "").toLowerCase();
  if (source === "service" || source === "trade") {
    factors.push({ label: "Warm lead source (service/trade)", points: 5 });
  }

  if (submission.is_hot_lead) {
    factors.push({ label: "Flagged as hot lead", points: 10 });
  }

  // ── Negative signals ──

  if (!submission.phone) {
    factors.push({ label: "No phone number — hard to contact", points: -10 });
  }

  if (!submission.email) {
    factors.push({ label: "No email — hard to reach", points: -8 });
  }

  if (submission.progress_status === "partial") {
    factors.push({ label: "Abandoned form — incomplete", points: -15 });
  }

  // More than 7 days old with no status change
  if (submission.created_at) {
    const ageMs = Date.now() - new Date(submission.created_at).getTime();
    const ageDays = ageMs / (1000 * 60 * 60 * 24);
    if (ageDays > 7) {
      const lastChange = submission.status_updated_at
        ? (Date.now() - new Date(submission.status_updated_at).getTime()) / (1000 * 60 * 60 * 24)
        : ageDays;
      if (lastChange > 7) {
        factors.push({ label: "Stale — no activity in 7+ days", points: -12 });
      }
    }
  }

  if (condition === "fair" || condition === "poor") {
    factors.push({ label: "Fair/poor condition — less valuable", points: -5 });
  }

  if (submission.progress_status === "dead_lead") {
    factors.push({ label: "Marked as dead lead", points: -50 });
  }

  // ── Calculate total ──

  const rawScore = factors.reduce((sum, f) => sum + f.points, 0);
  const score = Math.max(0, Math.min(100, rawScore));

  // ── Label ──

  let label: string;
  if (score >= 80) label = "Hot";
  else if (score >= 60) label = "Warm";
  else if (score >= 40) label = "Lukewarm";
  else label = "Cold";

  // ── Top 3 factors (by absolute magnitude) ──

  const sortedFactors = [...factors].sort(
    (a, b) => Math.abs(b.points) - Math.abs(a.points),
  );
  const topFactors = sortedFactors.slice(0, 3).map(
    (f) => `${f.points > 0 ? "+" : ""}${f.points}: ${f.label}`,
  );

  return { score, label, factors: topFactors };
}

export function getScoreColor(score: number): string {
  if (score >= 80) return "bg-orange-500/15 text-orange-700 dark:text-orange-400 border-orange-500/30";
  if (score >= 60) return "bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30";
  if (score >= 40) return "bg-blue-500/15 text-blue-700 dark:text-blue-400 border-blue-500/30";
  return "bg-muted/60 text-muted-foreground border-border";
}
