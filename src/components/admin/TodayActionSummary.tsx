import { useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Clock, CalendarDays, AlertTriangle, TrendingUp } from "lucide-react";
import type { Submission, Appointment } from "@/lib/adminConstants";

interface TodayActionSummaryProps {
  submissions: Submission[];
  appointments: Appointment[];
  onNavigate: (section: string) => void;
}

const TodayActionSummary = ({ submissions, appointments, onNavigate }: TodayActionSummaryProps) => {
  const now = new Date();
  const todayStr = now.toISOString().slice(0, 10);

  const stats = useMemo(() => {
    const staleLeads = submissions.filter((s) => {
      if (s.offered_price && s.offered_price > 0) return false;
      const created = new Date(s.created_at);
      const hoursSince = (now.getTime() - created.getTime()) / (1000 * 60 * 60);
      return hoursSince > 24;
    });

    const todayAppts = appointments.filter((a) => a.preferred_date === todayStr && a.status !== "cancelled");

    const acceptedNoAppt = submissions.filter(
      (s) => s.offered_price && s.offered_price > 0 && !s.appointment_set
    );

    const todayLeads = submissions.filter((s) => s.created_at.slice(0, 10) === todayStr);

    return { staleLeads, todayAppts, acceptedNoAppt, todayLeads };
  }, [submissions, appointments, todayStr]);

  const cards = [
    {
      label: "Needs Follow-Up",
      value: stats.staleLeads.length,
      subtitle: "> 24h, no offer",
      icon: AlertTriangle,
      color: "text-amber-500",
      bg: "bg-amber-500/10",
      action: () => onNavigate("submissions"),
    },
    {
      label: "Today's Appointments",
      value: stats.todayAppts.length,
      subtitle: todayStr,
      icon: CalendarDays,
      color: "text-blue-500",
      bg: "bg-blue-500/10",
      action: () => onNavigate("accepted-appts"),
    },
    {
      label: "Accepted, No Appt",
      value: stats.acceptedNoAppt.length,
      subtitle: "Needs scheduling",
      icon: Clock,
      color: "text-orange-500",
      bg: "bg-orange-500/10",
      action: () => onNavigate("offer-accepted"),
    },
    {
      label: "New Today",
      value: stats.todayLeads.length,
      subtitle: "Leads received",
      icon: TrendingUp,
      color: "text-emerald-500",
      bg: "bg-emerald-500/10",
      action: () => onNavigate("submissions"),
    },
  ];

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
      {cards.map((c) => (
        <Card
          key={c.label}
          className="cursor-pointer hover:shadow-md transition-shadow border-border"
          onClick={c.action}
        >
          <CardContent className="p-4 flex items-start gap-3">
            <div className={`p-2 rounded-lg ${c.bg} shrink-0`}>
              <c.icon className={`w-4 h-4 ${c.color}`} />
            </div>
            <div className="min-w-0">
              <p className="text-2xl font-bold text-card-foreground leading-none">{c.value}</p>
              <p className="text-xs font-medium text-card-foreground/80 mt-1 truncate">{c.label}</p>
              <p className="text-[10px] text-muted-foreground truncate">{c.subtitle}</p>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
};

export default TodayActionSummary;
