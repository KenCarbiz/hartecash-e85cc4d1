// Next Step card — the stage-aware action surface. Driven by the
// submission's progress_status + appointment_set + docs_uploaded
// + photos_uploaded flags. Renders ONE canonical "next thing the
// customer should do" with a single primary CTA.
//
// Same logic shape as CustomerPortalClarity's nextAction selector;
// kept inline so the new portal doesn't import from the Clarity
// page (avoids circular deps if Clarity ever changes its scope).
import { ArrowRight, Calendar, CheckCircle2, FileText, Camera } from "lucide-react";
import type { LucideIcon } from "lucide-react";

export interface NextStep {
  label: string;
  body: string;
  cta: string;
  href: string;
  icon: LucideIcon;
}

interface NextStepCardProps {
  step: NextStep | null;
  onNavigate: (href: string) => void;
}

const NextStepCard = ({ step, onNavigate }: NextStepCardProps) => {
  if (!step) {
    return (
      <article
        aria-labelledby="next-step-heading"
        className="bg-white rounded-3xl border border-border/60 shadow-[0_8px_32px_-12px_rgb(15_23_42_/_0.08)] p-6 lg:p-8"
      >
        <div
          className="w-12 h-12 rounded-2xl flex items-center justify-center mb-4"
          style={{ background: "hsl(142 71% 95%)" }}
        >
          <CheckCircle2 className="w-5 h-5 text-emerald-600" strokeWidth={1.75} />
        </div>
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-emerald-700 mb-2">
          You're all set
        </p>
        <h2 id="next-step-heading" className="text-xl font-bold text-foreground tracking-tight mb-2">
          Everything is in order.
        </h2>
        <p className="text-sm text-foreground/65 leading-relaxed">
          We'll be in touch with the next steps. Reach out anytime if you have questions.
        </p>
      </article>
    );
  }

  const Icon = step.icon;
  return (
    <article
      aria-labelledby="next-step-heading"
      className="bg-white rounded-3xl border border-border/60 shadow-[0_8px_32px_-12px_rgb(15_23_42_/_0.08)] p-6 lg:p-8"
    >
      <div className="flex items-start justify-between gap-3 mb-4">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-foreground/55 mb-2">
            Next Step
          </p>
          <h2
            id="next-step-heading"
            className="text-xl lg:text-[22px] font-bold text-foreground leading-[1.2] tracking-tight"
          >
            {step.label}
          </h2>
        </div>
        <div
          className="shrink-0 w-10 h-10 rounded-xl flex items-center justify-center"
          style={{ background: "hsl(220 100% 96%)" }}
          aria-hidden="true"
        >
          <Icon className="w-4 h-4 text-primary" strokeWidth={1.75} />
        </div>
      </div>
      <p className="text-sm text-foreground/65 leading-relaxed mb-5">{step.body}</p>
      <button
        type="button"
        onClick={() => onNavigate(step.href)}
        className="w-full h-12 rounded-xl bg-[hsl(var(--cta-offer))] text-[color:var(--cta-offer-text)] font-semibold text-base inline-flex items-center justify-center gap-2 hover:opacity-95 active:opacity-90 transition-opacity focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[hsl(var(--cta-offer))]"
      >
        {step.cta}
        <ArrowRight className="w-4 h-4" strokeWidth={2.25} />
      </button>
    </article>
  );
};

// Helpers exported so the portal page can compute the next step
// using the same icon set as the card.
export const NEXT_STEP_ICONS = {
  Calendar,
  FileText,
  Camera,
} as const;

export default NextStepCard;
