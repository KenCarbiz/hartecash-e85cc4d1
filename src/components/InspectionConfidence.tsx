import { useEffect, useState } from "react";
import { ShieldCheck, ShieldAlert, Info } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

/**
 * Customer-facing confidence indicator next to the cash offer.
 *
 * Pre-empts the "your offer got slashed at inspection" complaint that hurts
 * KBB ICO and Carvana. We show a transparent score derived from:
 *   - how many AI photos the customer uploaded
 *   - the AI's overall confidence
 *   - whether the AI's suggested condition matches the customer's self-report
 *
 * High score (>= 90%): green badge, "your in-person offer should match"
 * Medium (70-89%): yellow badge, "minor variance possible"
 * Low (< 70%): grey badge, "subject to in-person inspection"
 *
 * Customer-facing only — never shown in the appraiser/admin view.
 */
interface Props {
  submissionId: string;
  customerCondition: string | null;     // self-reported
  aiCondition: string | null;           // AI suggested_condition (lowest-of-photos)
}

interface DamageRow {
  confidence_score: number | null;
  suggested_condition: string | null;
}

const labelFor = (pct: number) =>
  pct >= 90 ? "Inspection Match Likely" : pct >= 70 ? "Minor Variance Possible" : "Subject to Inspection";

const InspectionConfidence = ({ submissionId, customerCondition, aiCondition }: Props) => {
  const [reports, setReports] = useState<DamageRow[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!submissionId) return;
    (async () => {
      const { data } = await supabase
        .from("damage_reports" as any)
        .select("confidence_score, suggested_condition")
        .eq("submission_id", submissionId);
      setReports(((data as unknown) as DamageRow[]) || []);
      setLoaded(true);
    })();
  }, [submissionId]);

  if (!loaded) return null;

  // Base 70% — every offer starts with the assumption it'll match
  // Add 5% per AI-scored photo (cap at +20% from photos)
  // Add 10% if AI's suggested condition matches the customer self-report
  // Subtract from the AI's average confidence floor
  const photoCount = reports.length;
  const photoBoost = Math.min(20, photoCount * 5);
  const conditionMatch =
    customerCondition && aiCondition && customerCondition.toLowerCase() === aiCondition.toLowerCase();
  const matchBoost = conditionMatch ? 10 : 0;
  const aiAvgConfidence = reports.length
    ? reports.reduce((s, r) => s + (r.confidence_score ?? 0), 0) / reports.length
    : 0;
  // Penalize when AI itself isn't confident
  const aiPenalty = reports.length && aiAvgConfidence < 70 ? Math.min(15, (70 - aiAvgConfidence) / 2) : 0;

  let score = Math.round(70 + photoBoost + matchBoost - aiPenalty);
  if (score > 99) score = 99; // never claim 100% — always reserve some inspection variance
  if (score < 50) score = 50;

  const isHigh = score >= 90;
  const isMid = score >= 70 && score < 90;
  const Icon = isHigh ? ShieldCheck : ShieldAlert;

  const styleClass = isHigh
    ? "bg-success/8 text-success border-success/20"
    : isMid
    ? "bg-amber-500/8 text-amber-700 dark:text-amber-400 border-amber-500/20"
    : "bg-muted text-muted-foreground border-border";

  const explanation = (
    <div className="text-xs leading-relaxed space-y-1.5 max-w-xs">
      <p className="font-semibold">How we calculated this</p>
      <ul className="space-y-1 text-muted-foreground">
        <li>• {photoCount} AI-scored photo{photoCount === 1 ? "" : "s"} ({photoBoost > 0 ? `+${photoBoost}%` : "no boost"})</li>
        <li>• Self-report vs. AI condition: {conditionMatch ? "match (+10%)" : "differs (no boost)"}</li>
        {aiPenalty > 0 && <li>• Photo quality reduced confidence by {Math.round(aiPenalty)}%</li>}
      </ul>
      <p className="text-muted-foreground/80 pt-1 border-t border-border">
        Final offer is confirmed at pickup after a quick visual check.
      </p>
    </div>
  );

  return (
    <TooltipProvider delayDuration={150}>
      <Tooltip>
        <TooltipTrigger asChild>
          <div
            className={`inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-bold border cursor-help ${styleClass}`}
          >
            <Icon className="w-3.5 h-3.5" />
            <span>{score}% · {labelFor(score)}</span>
            <Info className="w-3 h-3 opacity-60" />
          </div>
        </TooltipTrigger>
        <TooltipContent side="bottom" className="bg-popover text-popover-foreground p-3">
          {explanation}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};

export default InspectionConfidence;
