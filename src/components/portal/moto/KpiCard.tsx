// Single KPI card — used in the top metric strip. Common shell
// with a `tone`-driven tinted icon tile so the strip reads as a
// system, not a one-off pile of cards.
import type { LucideIcon } from "lucide-react";

type KpiTone = "primary" | "success" | "warning" | "neutral";

interface KpiCardProps {
  icon: LucideIcon;
  label: string;
  value: string;
  subline?: string | null;
  tone?: KpiTone;
}

const TONE_BG: Record<KpiTone, string> = {
  primary: "hsl(220 100% 96%)",
  success: "hsl(142 71% 95%)",
  warning: "hsl(38 92% 95%)",
  neutral: "hsl(220 14% 96%)",
};

const TONE_FG: Record<KpiTone, string> = {
  primary: "text-primary",
  success: "text-emerald-600",
  warning: "text-amber-600",
  neutral: "text-foreground/70",
};

const KpiCard = ({ icon: Icon, label, value, subline, tone = "primary" }: KpiCardProps) => (
  <div className="bg-white rounded-2xl border border-border/60 p-5 flex items-start gap-4">
    <div
      className="shrink-0 w-11 h-11 rounded-xl flex items-center justify-center"
      style={{ background: TONE_BG[tone] }}
      aria-hidden="true"
    >
      <Icon className={`w-5 h-5 ${TONE_FG[tone]}`} strokeWidth={1.75} />
    </div>
    <div className="min-w-0 flex-1">
      <p className="text-xs font-semibold uppercase tracking-[0.12em] text-foreground/55 mb-1">
        {label}
      </p>
      <p className="text-xl lg:text-2xl font-bold text-foreground tracking-tight tabular-nums leading-tight truncate">
        {value}
      </p>
      {subline ? (
        <p className="text-xs text-foreground/55 mt-1 truncate">{subline}</p>
      ) : null}
    </div>
  </div>
);

export default KpiCard;
