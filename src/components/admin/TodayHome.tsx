import { useMemo } from "react";
import { Calendar, Clock, Inbox, MapPin, Phone, ArrowRight } from "lucide-react";
import TodayActionSummary from "./TodayActionSummary";
import { getStatusLabel, type Submission, type Appointment, type DealerLocation } from "@/lib/adminConstants";
import { formatPhone } from "@/lib/utils";

interface TodayHomeProps {
  submissions: Submission[];
  appointments: Appointment[];
  dealerLocations: DealerLocation[];
  onNavigate: (section: string) => void;
  onView: (sub: Submission) => void;
}

const TODAY_ISO = () => new Date().toISOString().slice(0, 10);

const apptTimeKey = (t: string) => {
  const m = /^(\d{1,2}):(\d{2})\s*(AM|PM)$/i.exec(t.trim());
  if (!m) return 9999;
  let hour = parseInt(m[1], 10) % 12;
  if (m[3].toUpperCase() === "PM") hour += 12;
  return hour * 60 + parseInt(m[2], 10);
};

const friendlyDate = (d: Date) =>
  d.toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" });

const TodayHome = ({ submissions, appointments, dealerLocations, onNavigate, onView }: TodayHomeProps) => {
  const today = TODAY_ISO();
  const now = new Date();

  const locationName = (id: string | null | undefined) =>
    (id && dealerLocations.find((l) => l.id === id)?.name) || null;

  const todaysAppts = useMemo(
    () =>
      appointments
        .filter((a) => a.preferred_date === today)
        .sort((a, b) => apptTimeKey(a.preferred_time) - apptTimeKey(b.preferred_time)),
    [appointments, today],
  );

  const newLeadsToday = useMemo(
    () =>
      submissions
        .filter((s) => s.created_at.slice(0, 10) === today)
        .sort((a, b) => (b.created_at > a.created_at ? 1 : -1))
        .slice(0, 8),
    [submissions, today],
  );

  return (
    <div className="space-y-6">
      <header className="flex items-baseline justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold text-card-foreground">Today</h1>
          <p className="text-sm text-muted-foreground mt-0.5">{friendlyDate(now)}</p>
        </div>
      </header>

      <TodayActionSummary
        submissions={submissions}
        appointments={appointments}
        onNavigate={onNavigate}
      />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Today's appointments */}
        <section className="rounded-lg border bg-card text-card-foreground">
          <div className="flex items-center justify-between px-4 py-3 border-b">
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-muted-foreground" />
              <h2 className="text-sm font-semibold">Today's appointments</h2>
              <span className="text-xs text-muted-foreground">({todaysAppts.length})</span>
            </div>
            <button
              type="button"
              onClick={() => onNavigate("accepted-appts")}
              className="text-xs font-medium text-muted-foreground hover:text-foreground inline-flex items-center gap-1"
            >
              View all <ArrowRight className="w-3 h-3" />
            </button>
          </div>
          {todaysAppts.length === 0 ? (
            <div className="px-4 py-8 text-center text-sm text-muted-foreground">
              No appointments scheduled for today.
            </div>
          ) : (
            <ul className="divide-y">
              {todaysAppts.map((a) => {
                const loc = locationName(a.store_location);
                return (
                  <li key={a.id}>
                    <button
                      type="button"
                      onClick={() => onNavigate("accepted-appts")}
                      className="w-full text-left px-4 py-3 hover:bg-muted/50 transition-colors flex items-start gap-3"
                    >
                      <div className="shrink-0 inline-flex items-center gap-1 text-xs font-semibold rounded-md bg-muted px-2 py-1">
                        <Clock className="w-3 h-3" />
                        {a.preferred_time}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium truncate">{a.customer_name}</div>
                        <div className="text-xs text-muted-foreground truncate">
                          {a.vehicle_info || "Vehicle TBD"}
                        </div>
                        <div className="mt-1 flex items-center gap-3 text-[11px] text-muted-foreground">
                          {a.customer_phone && (
                            <span className="inline-flex items-center gap-1">
                              <Phone className="w-3 h-3" />
                              {formatPhone(a.customer_phone)}
                            </span>
                          )}
                          {loc && (
                            <span className="inline-flex items-center gap-1">
                              <MapPin className="w-3 h-3" />
                              {loc}
                            </span>
                          )}
                        </div>
                      </div>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        {/* New leads today */}
        <section className="rounded-lg border bg-card text-card-foreground">
          <div className="flex items-center justify-between px-4 py-3 border-b">
            <div className="flex items-center gap-2">
              <Inbox className="w-4 h-4 text-muted-foreground" />
              <h2 className="text-sm font-semibold">New leads today</h2>
              <span className="text-xs text-muted-foreground">({newLeadsToday.length})</span>
            </div>
            <button
              type="button"
              onClick={() => onNavigate("submissions")}
              className="text-xs font-medium text-muted-foreground hover:text-foreground inline-flex items-center gap-1"
            >
              View all <ArrowRight className="w-3 h-3" />
            </button>
          </div>
          {newLeadsToday.length === 0 ? (
            <div className="px-4 py-8 text-center text-sm text-muted-foreground">
              No new leads yet today.
            </div>
          ) : (
            <ul className="divide-y">
              {newLeadsToday.map((s) => {
                const created = new Date(s.created_at);
                const time = created.toLocaleTimeString(undefined, {
                  hour: "numeric",
                  minute: "2-digit",
                });
                const ymm = [s.vehicle_year, s.vehicle_make, s.vehicle_model].filter(Boolean).join(" ");
                return (
                  <li key={s.id}>
                    <button
                      type="button"
                      onClick={() => onView(s)}
                      className="w-full text-left px-4 py-3 hover:bg-muted/50 transition-colors flex items-start gap-3"
                    >
                      <div className="shrink-0 inline-flex items-center gap-1 text-xs font-semibold rounded-md bg-muted px-2 py-1">
                        <Clock className="w-3 h-3" />
                        {time}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium truncate">
                          {s.name || "Unnamed lead"}
                          {s.is_hot_lead && (
                            <span className="ml-2 text-[10px] font-bold text-red-600 uppercase">Hot</span>
                          )}
                        </div>
                        <div className="text-xs text-muted-foreground truncate">{ymm || "Vehicle TBD"}</div>
                        <div className="mt-1 flex items-center gap-3 text-[11px] text-muted-foreground">
                          <span className="inline-flex items-center rounded px-1.5 py-0.5 bg-muted">
                            {getStatusLabel(s.progress_status)}
                          </span>
                          {s.phone && (
                            <span className="inline-flex items-center gap-1">
                              <Phone className="w-3 h-3" />
                              {formatPhone(s.phone)}
                            </span>
                          )}
                        </div>
                      </div>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
};

export default TodayHome;
