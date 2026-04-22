import { AlertTriangle, Calendar, CheckCircle, Lock } from "lucide-react";

interface Props {
  progressStatus: string;
  offeredPrice: number | null;
  estimatedOfferHigh: number | null;
  appraisalFinalized: boolean;
  appraisalFinalizedAt: string | null;
  appraisalFinalizedBy: string | null;
  acvValue: number | null;
}

export default function DealStatusBanner({
  progressStatus, offeredPrice, estimatedOfferHigh,
  appraisalFinalized, appraisalFinalizedAt, appraisalFinalizedBy, acvValue,
}: Props) {
  if (appraisalFinalized) {
    const val = acvValue || offeredPrice || 0;
    return (
      <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-primary/10 border border-primary/30 mb-5">
        <Lock className="w-5 h-5 text-primary shrink-0" />
        <div>
          <p className="text-sm font-bold text-primary">
            🔒 Appraisal finalized at ${val.toLocaleString()}
            {appraisalFinalizedBy && <> by {appraisalFinalizedBy}</>}
            {appraisalFinalizedAt && <> on {new Date(appraisalFinalizedAt).toLocaleDateString()}</>}
          </p>
          <p className="text-xs text-muted-foreground">Unlock to edit.</p>
        </div>
      </div>
    );
  }

  if (progressStatus === "offer_declined") {
    const val = offeredPrice || estimatedOfferHigh || 0;
    return (
      <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-destructive/10 border border-destructive/30 mb-5">
        <AlertTriangle className="w-5 h-5 text-destructive shrink-0" />
        <div>
          <p className="text-sm font-bold text-destructive">
            ⚠ Customer declined the online offer of ${val.toLocaleString()}
          </p>
          <p className="text-xs text-muted-foreground">
            This appraisal is your second chance to make the deal. Focus: show them the inspection reality.
          </p>
        </div>
      </div>
    );
  }

  if (progressStatus === "scheduled" || progressStatus === "visiting") {
    return (
      <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-amber-500/10 border border-amber-500/30 mb-5">
        <Calendar className="w-5 h-5 text-amber-600 shrink-0" />
        <div>
          <p className="text-sm font-bold text-amber-700 dark:text-amber-400">
            📅 Customer appointment scheduled
          </p>
          <p className="text-xs text-muted-foreground">
            They have NOT yet seen an offer. The number you set here will be their first offer.
          </p>
        </div>
      </div>
    );
  }

  if (progressStatus === "offer_accepted") {
    const val = offeredPrice || estimatedOfferHigh || 0;
    return (
      <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 mb-5">
        <CheckCircle className="w-5 h-5 text-emerald-600 shrink-0" />
        <div>
          <p className="text-sm font-bold text-emerald-700 dark:text-emerald-400">
            ✓ Customer accepted the offer of ${val.toLocaleString()}
          </p>
          <p className="text-xs text-muted-foreground">
            This appraisal locks in the final ACV for your books.
          </p>
        </div>
      </div>
    );
  }

  return null;
}
