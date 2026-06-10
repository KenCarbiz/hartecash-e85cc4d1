/**
 * Appointments (Admin V2) — premium schedule view of the appointment book.
 *
 * Shows the schedule the way a sales floor reads it: KPIs + a day-grouped
 * agenda (Today / Tomorrow / Later) with customer, vehicle, time and
 * status. Reads db.appointments (real). Full ops — create, confirm,
 * reschedule, cancel — are preserved via the "Manage appointments"
 * toggle, which mounts the existing AppointmentManager unchanged.
 */
import { lazy, Suspense, useMemo, useState } from "react";
import {
  CalendarDays, CalendarCheck, CalendarClock, Clock, Car, Phone, Settings2, ChevronRight,
} from "lucide-react";
import type { useAdminDashboard } from "@/hooks/useAdminDashboard";
import type { Appointment } from "@/lib/adminConstants";
import { PageShell, Card, SectionLabel, Pill, StatCard, PrimaryButton, Loading } from "./theme";

const AppointmentManager = lazy(() => import("@/components/admin/AppointmentManager"));

type Db = ReturnType<typeof useAdminDashboard>;

const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
const parseDate = (s: string) => {
  const d = new Date(`${s}T00:00:00`);
  return Number.isNaN(d.getTime()) ? new Date(s) : d;
};
const dayDiff = (s: string) => Math.round((startOfDay(parseDate(s)).getTime() - startOfDay(new Date()).getTime()) / 86_400_000);

const statusTone = (s: string): "green" | "amber" | "red" | "gray" => {
  const v = (s || "").toLowerCase();
  if (v.includes("confirm")) return "green";
  if (v.includes("cancel") || v.includes("no")) return "red";
  if (v.includes("complete")) return "gray";
  return "amber";
};

const AppointmentsView = ({ db }: { db: Db }) => {
  const [manage, setManage] = useState(false);
  const appts = db.appointments;

  const k = useMemo(() => {
    let today = 0, week = 0, confirmed = 0, pending = 0;
    for (const a of appts) {
      const diff = dayDiff(a.preferred_date);
      if (diff === 0) today += 1;
      if (diff >= 0 && diff <= 7) week += 1;
      if ((a.status || "").toLowerCase().includes("confirm")) confirmed += 1;
      else if (diff >= 0) pending += 1;
    }
    return { today, week, confirmed, pending };
  }, [appts]);

  // Upcoming, grouped by day bucket.
  const groups = useMemo(() => {
    const upcoming = appts
      .filter((a) => dayDiff(a.preferred_date) >= 0)
      .sort((a, b) => parseDate(a.preferred_date).getTime() - parseDate(b.preferred_date).getTime() || a.preferred_time.localeCompare(b.preferred_time));
    const g: { label: string; items: Appointment[] }[] = [
      { label: "Today", items: [] }, { label: "Tomorrow", items: [] }, { label: "Later", items: [] },
    ];
    for (const a of upcoming) {
      const diff = dayDiff(a.preferred_date);
      g[diff === 0 ? 0 : diff === 1 ? 1 : 2].items.push(a);
    }
    return g.filter((x) => x.items.length > 0);
  }, [appts]);

  const onView = (appt: Appointment) => {
    const sub = db.submissions.find((s) => s.token === appt.submission_token);
    if (sub) db.handleView(sub);
  };

  return (
    <PageShell
      title="Appointments"
      subtitle="Your inspection & pickup schedule across the store."
      actions={
        <>
          <PrimaryButton onClick={() => setManage((v) => !v)}>
            <Settings2 className="h-4 w-4" /> {manage ? "Hide manager" : "Manage appointments"}
          </PrimaryButton>
        </>
      }
    >
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <StatCard label="Today" value={k.today} icon={<CalendarDays className="h-5 w-5" />} tone="purple" />
          <StatCard label="Next 7 Days" value={k.week} icon={<CalendarClock className="h-5 w-5" />} tone="teal" />
          <StatCard label="Confirmed" value={k.confirmed} icon={<CalendarCheck className="h-5 w-5" />} tone="green" />
          <StatCard label="Needs Confirmation" value={k.pending} icon={<Clock className="h-5 w-5" />} tone="amber" />
        </div>

        {manage && (
          <Card className="p-5">
            <SectionLabel>Manage appointments</SectionLabel>
            <div className="mt-3">
              <Suspense fallback={<Loading label="Loading manager…" />}>
                <AppointmentManager
                  appointments={db.appointments}
                  setAppointments={db.setAppointments}
                  submissions={db.submissions}
                  dealerLocations={db.dealerLocations}
                  onViewSubmission={onView}
                  fetchSubmissions={db.fetchSubmissions}
                  fetchAppointments={db.fetchAppointments}
                />
              </Suspense>
            </div>
          </Card>
        )}

        {groups.length === 0 ? (
          <Card className="p-10 text-center text-sm text-[#7A879C]">No upcoming appointments. Use “Manage appointments” to schedule one.</Card>
        ) : (
          <div className="space-y-4">
            {groups.map((g) => (
              <div key={g.label}>
                <div className="mb-2 flex items-center gap-2 px-1">
                  <span className="text-[12px] font-bold uppercase tracking-wider text-[#9AA6BC]">{g.label}</span>
                  <span className="text-[12px] text-[#C2CAD8]">·</span>
                  <span className="text-[12px] text-[#7A879C]">{g.items.length}</span>
                </div>
                <Card className="overflow-hidden">
                  <div className="divide-y divide-[#F0F2F7]">
                    {g.items.map((a) => (
                      <button key={a.id} onClick={() => onView(a)} className="flex w-full items-center gap-4 px-5 py-3.5 text-left transition hover:bg-[#F8FAFC]">
                        <div className="flex w-16 shrink-0 flex-col items-center rounded-xl bg-[#F3F0FF] py-2">
                          <span className="text-[13px] font-bold text-[#6D28D9]">{a.preferred_time || "—"}</span>
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="truncate text-[14px] font-semibold text-[#06194A]">{a.customer_name || "Customer"}</div>
                          <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[12px] text-[#7A879C]">
                            {a.vehicle_info && <span className="inline-flex items-center gap-1"><Car className="h-3 w-3" />{a.vehicle_info}</span>}
                            {a.customer_phone && <span className="inline-flex items-center gap-1"><Phone className="h-3 w-3" />{a.customer_phone}</span>}
                            {a.store_location && <span>{a.store_location}</span>}
                          </div>
                        </div>
                        <Pill tone={statusTone(a.status)}>{a.status || "Scheduled"}</Pill>
                        <ChevronRight className="h-4 w-4 text-[#C2CAD8]" />
                      </button>
                    ))}
                  </div>
                </Card>
              </div>
            ))}
          </div>
        )}
      </div>
    </PageShell>
  );
};

export default AppointmentsView;
