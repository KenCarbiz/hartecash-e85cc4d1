import { useMemo } from "react";
import { Badge } from "@/components/ui/badge";
import type { Submission, Appointment } from "@/lib/adminConstants";

interface TodayActionSummaryProps {
  submissions: Submission[];
  appointments: Appointment[];
  onNavigate: (section: string) => void;
}

const fmt = (v: number) => `$${v.toLocaleString()}`;

const TodayActionSummary = ({ submissions, appointments, onNavigate }: TodayActionSummaryProps) => {
  const now = new Date();
  const todayStr = now.toISOString().slice(0, 10);

  const stats = useMemo(() => {
    const needsFollowUp = submissions.filter((s) => {
      if (s.offered_price && s.offered_price > 0) return false;
      const hoursSince = (now.getTime() - new Date(s.created_at).getTime()) / (1000 * 60 * 60);
      return hoursSince > 24;
    }).length;

    const acceptedNoAppt = submissions.filter(
      (s) => s.offered_price && s.offered_price > 0 && !s.appointment_set
    ).length;

    const newToday = submissions.filter((s) => s.created_at.slice(0, 10) === todayStr).length;

    let totalOffered = 0, offeredCount = 0, pending = 0, closed = 0;
    submissions.forEach((s) => {
      const val = s.offered_price || s.acv_value || 0;
      if (val > 0) {
        totalOffered += val;
        offeredCount++;
        if (s.progress_status === "purchase_complete") closed += val;
        else if (s.progress_status !== "dead_lead") pending += val;
      }
    });
    const avgOffer = offeredCount > 0 ? Math.round(totalOffered / offeredCount) : 0;

    return { needsFollowUp, acceptedNoAppt, newToday, avgOffer, pending, closed, totalPipeline: totalOffered };
  }, [submissions, todayStr]);

  const actionChips = [
    { emoji: "🔴", label: "Needs Follow-Up", value: stats.needsFollowUp, onClick: () => onNavigate("submissions") },
    { emoji: "🟡", label: "Accepted, No Appt", value: stats.acceptedNoAppt, onClick: () => onNavigate("offer-accepted") },
    { emoji: "🟢", label: "New Today", value: stats.newToday, onClick: () => onNavigate("submissions") },
  ];

  const revenueChips = [
    { label: "Avg Offer", value: fmt(stats.avgOffer) },
    { label: "Pending", value: fmt(stats.pending) },
    { label: "Closed", value: fmt(stats.closed) },
    { label: "Pipeline", value: fmt(stats.totalPipeline) },
  ];

  return (
    <div className="flex items-center gap-2 flex-wrap">
      {actionChips.map((c) => (
        <Badge
          key={c.label}
          variant="outline"
          className="text-xs font-medium px-2.5 py-1 gap-1.5 cursor-pointer hover:bg-muted/60 transition-colors"
          onClick={c.onClick}
        >
          <span>{c.emoji}</span>
          <span className="text-muted-foreground">{c.label}:</span>
          <span className="font-semibold text-card-foreground">{c.value}</span>
        </Badge>
      ))}

      <div className="flex-1" />

      {revenueChips.map((c) => (
        <Badge
          key={c.label}
          variant="outline"
          className="text-xs font-medium px-2 py-1 gap-1 border-border/50"
        >
          <span className="text-muted-foreground">{c.label}:</span>
          <span className="font-semibold text-card-foreground">{c.value}</span>
        </Badge>
      ))}
    </div>
  );
};

export default TodayActionSummary;
