// Today home page — landing surface for managers under
// site_config.ui_refresh_enabled. See
// frontend-redesign/CLAUDE_CODE_BRIEF.md §2.
//
// Composition:
//   1. Date + personalized greeting header
//   2. RightNowStrip — arrival / on-the-way cards
//   3. TodayKpiRow — TODAY · MTD GROSS · OPEN LEADS · AVG RESPONSE
//
// Routing into this component is owned by AdminSectionRenderer.tsx
// (key === "today"). The default-home effect in AdminDashboard.tsx
// chooses this for admins / GMs / used-car / new-car managers.

import type { Submission, Appointment } from "@/lib/adminConstants";
import RightNowStrip from "./RightNowStrip";
import TodayKpiRow from "./TodayKpiRow";

interface TodayHomeProps {
  submissions: Submission[];
  appointments: Appointment[];
  userName: string;
  onView: (sub: Submission) => void;
}

const greetingForHour = (h: number) => {
  if (h < 12) return "Good morning";
  if (h < 18) return "Good afternoon";
  return "Good evening";
};

const fmtDateHeader = (d: Date) =>
  d.toLocaleDateString(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
  });

const firstName = (full: string) => {
  const trimmed = (full || "").trim();
  if (!trimmed) return "";
  return trimmed.split(/\s+/)[0];
};

const TodayHome = ({ submissions, appointments, userName, onView }: TodayHomeProps) => {
  const now = new Date();
  const greeting = greetingForHour(now.getHours());
  const fn = firstName(userName);

  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
          {fmtDateHeader(now)}
        </p>
        <h1 className="text-2xl font-bold text-foreground">
          {greeting}{fn ? `, ${fn}` : ""}.
        </h1>
        <p className="text-sm text-muted-foreground">
          Here's what needs you today.
        </p>
      </header>

      <RightNowStrip
        submissions={submissions}
        appointments={appointments}
        onView={onView}
      />

      <TodayKpiRow submissions={submissions} />
    </div>
  );
};

export default TodayHome;
