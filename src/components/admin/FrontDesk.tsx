import { useMemo } from "react";
import { Check } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import type { Appointment, Submission } from "@/lib/adminConstants";

interface FrontDeskProps {
  appointments: Appointment[];
  submissions: Submission[];
  /** Re-fetches submissions after a check-in so the rest of the page
   *  (notifications, slide-out, queues) sees the updated status. */
  fetchSubmissions: () => void;
  /** Opens the customer file slide-out for handoff after greet. */
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

const FrontDesk = ({ appointments, submissions, fetchSubmissions, onView }: FrontDeskProps) => {
  const { toast } = useToast();
  const today = TODAY_ISO();

  const subByToken = useMemo(() => {
    const m = new Map<string, Submission>();
    submissions.forEach((s) => { if (s.token) m.set(s.token, s); });
    return m;
  }, [submissions]);

  const todays = useMemo(
    () => appointments
      .filter((a) => a.preferred_date === today)
      .sort((a, b) => apptTimeKey(a.preferred_time) - apptTimeKey(b.preferred_time)),
    [appointments, today],
  );

  const counts = useMemo(() => {
    let arrived = 0;
    let onTheWay = 0;
    todays.forEach((a) => {
      const s = a.submission_token ? subByToken.get(a.submission_token) : null;
      if (!s) return;
      if (s.progress_status === "customer_arrived") arrived++;
      else if (s.progress_status === "on_the_way") onTheWay++;
    });
    return { total: todays.length, arrived, onTheWay };
  }, [todays, subByToken]);

  const checkIn = async (sub: Submission) => {
    const next = {
      progress_status: "customer_arrived",
      status_updated_at: new Date().toISOString(),
    };
    const { error } = await (supabase as never as { from: (t: string) => { update: (v: unknown) => { eq: (k: string, v: string) => Promise<{ error: { message: string } | null }> } } })
      .from("submissions")
      .update(next)
      .eq("id", sub.id);
    if (error) {
      toast({ title: "Check-in failed", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: `${sub.name || "Customer"} checked in`, description: "Sales team has been notified." });
    fetchSubmissions();
  };

  return (
    <div className="space-y-6 max-w-6xl">
      <header>
        <h1 className="text-3xl font-bold tracking-tight">Front desk</h1>
        <p className="text-sm text-muted-foreground mt-1">Check customers in and keep the schedule moving.</p>
      </header>

      {/* KPI tiles */}
      <section className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Tile label="Today" value={counts.total} sub={counts.total === 1 ? "appointment" : "appointments"} />
        <Tile label="Right now" value={counts.arrived} sub={counts.arrived === 1 ? "arrived" : "arrived"} valueClass="text-red-600" />
        <Tile label="On the way" value={counts.onTheWay} sub={counts.onTheWay === 1 ? "customer" : "customers"} valueClass="text-orange-500" />
      </section>

      {/* Today's schedule */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-[11px] font-bold tracking-[0.1em] text-muted-foreground uppercase">Today's schedule</h2>
        </div>
        {todays.length === 0 ? (
          <div className="rounded-lg border bg-card p-6 text-sm text-muted-foreground text-center">
            No appointments today.
          </div>
        ) : (
          <div className="rounded-lg border bg-card overflow-hidden">
            <ul className="divide-y">
              {todays.map((a) => {
                const sub = a.submission_token ? subByToken.get(a.submission_token) : null;
                const status = sub?.progress_status;
                const arrived = status === "customer_arrived";
                const onTheWay = status === "on_the_way";

                const rowBg = arrived
                  ? "bg-red-50 border-l-4 border-l-red-500"
                  : "border-l-4 border-l-transparent";

                const pill = arrived
                  ? { label: "Arrived", cls: "text-red-700", dot: "bg-red-500" }
                  : onTheWay
                    ? { label: "On the way", cls: "text-orange-600 bg-orange-100 px-2 py-0.5 rounded", dot: "" }
                    : null;

                return (
                  <li key={a.id} className={rowBg}>
                    <div className="flex items-center gap-3 px-4 py-3">
                      <div className="text-sm font-bold tabular-nums w-20 shrink-0">{a.preferred_time}</div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-semibold truncate">{a.customer_name}</span>
                          {pill && (
                            <span className={`text-[11px] font-bold inline-flex items-center gap-1.5 ${pill.cls}`}>
                              {pill.dot && <span className={`w-1.5 h-1.5 rounded-full ${pill.dot}`} />}
                              {pill.label}
                            </span>
                          )}
                        </div>
                        <div className="text-xs text-muted-foreground truncate">{a.vehicle_info || "Vehicle TBD"}</div>
                      </div>
                      {arrived ? (
                        <button
                          type="button"
                          onClick={() => sub && onView(sub)}
                          disabled={!sub}
                          className="h-9 px-3.5 rounded-md bg-red-600 hover:bg-red-700 text-white text-xs font-bold inline-flex items-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed transition"
                        >
                          <Check className="w-3.5 h-3.5" />
                          Mark greeted
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => sub ? checkIn(sub) : null}
                          disabled={!sub}
                          className="h-9 px-3.5 rounded-md border bg-background hover:bg-muted/60 text-xs font-semibold disabled:opacity-50 disabled:cursor-not-allowed transition"
                        >
                          Check in
                        </button>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>
        )}
      </section>
    </div>
  );
};

function Tile({ label, value, sub, valueClass = "" }: { label: string; value: number; sub: string; valueClass?: string }) {
  return (
    <div className="rounded-lg border border-border/60 p-5">
      <div className="text-[11px] font-bold tracking-wider uppercase text-muted-foreground">{label}</div>
      <div className={`text-3xl font-bold mt-2 ${valueClass}`}>{value}</div>
      <div className="text-xs text-muted-foreground mt-1">{sub}</div>
    </div>
  );
}

export default FrontDesk;
