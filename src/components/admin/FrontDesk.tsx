import { useMemo, useState } from "react";
import { Check, Search, UserPlus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { safeInvoke } from "@/lib/safeInvoke";
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
  /** Opens the new-walk-in / new-lead intake — wired by the parent
   *  to whatever creates a manual_entry submission and pre-opens
   *  the customer file. Optional so this component still mounts in
   *  isolation. */
  onCreateWalkIn?: () => void;
}

const onlyDigits = (s: string) => s.replace(/\D/g, "");

const TODAY_ISO = () => new Date().toISOString().slice(0, 10);

const apptTimeKey = (t: string) => {
  const m = /^(\d{1,2}):(\d{2})\s*(AM|PM)$/i.exec(t.trim());
  if (!m) return 9999;
  let hour = parseInt(m[1], 10) % 12;
  if (m[3].toUpperCase() === "PM") hour += 12;
  return hour * 60 + parseInt(m[2], 10);
};

const FrontDesk = ({ appointments, submissions, fetchSubmissions, onView, onCreateWalkIn }: FrontDeskProps) => {
  const { toast } = useToast();
  const today = TODAY_ISO();
  const [search, setSearch] = useState("");

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
    // Fire the staff_customer_arrived notification so the sales floor
    // gets paged via SMS/email per the dealer's notification rules.
    // The toast was previously claiming "sales team has been notified"
    // without actually firing the trigger — fixed.
    safeInvoke("send-notification", {
      body: { trigger_key: "staff_customer_arrived", submission_id: sub.id },
      context: { from: "FrontDesk.checkIn" },
    });
    toast({ title: `${sub.name || "Customer"} checked in`, description: "Sales team has been notified." });
    fetchSubmissions();
  };

  // Front-desk customer search — searches across the full submission
  // set, not just today's appointments, so a walk-in saying "I called
  // last week about my F-150" can be found instantly. Matches name,
  // vehicle, plate, VIN, and digits-only phone.
  const searchResults = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return [];
    const qDigits = onlyDigits(q);
    return submissions
      .filter((s) => {
        const name    = (s.name || "").toLowerCase();
        const vehicle = `${s.vehicle_year || ""} ${s.vehicle_make || ""} ${s.vehicle_model || ""}`.toLowerCase();
        const plate   = (s.plate || "").toLowerCase();
        const vin     = (s.vin || "").toLowerCase();
        const phone   = onlyDigits(s.phone || "");
        if (name.includes(q))    return true;
        if (vehicle.includes(q)) return true;
        if (plate.includes(q))   return true;
        if (vin.includes(q))     return true;
        if (qDigits.length >= 3 && phone.includes(qDigits)) return true;
        return false;
      })
      .slice(0, 12);
  }, [submissions, search]);

  return (
    <div className="space-y-6 max-w-6xl">
      <header>
        <h1 className="text-3xl font-bold tracking-tight">Front desk</h1>
        <p className="text-sm text-muted-foreground mt-1">Check customers in and keep the schedule moving.</p>
      </header>

      {/* Customer search + walk-in intake. Pinned at the top because
          this is the receptionist's primary failure mode — someone
          standing at the desk who isn't on today's calendar. */}
      <section className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Find a customer — name, phone, plate, or VIN"
            className="w-full h-11 pl-10 pr-3 rounded-lg border border-border bg-card text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
          />
        </div>
        {onCreateWalkIn && (
          <button
            type="button"
            onClick={onCreateWalkIn}
            className="h-11 px-4 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 text-sm font-bold inline-flex items-center justify-center gap-1.5 transition"
          >
            <UserPlus className="w-4 h-4" />
            New walk-in
          </button>
        )}
      </section>

      {search.trim() && (
        <section>
          <h2 className="text-[11px] font-bold tracking-[0.1em] text-muted-foreground uppercase mb-2">
            {searchResults.length === 0
              ? "No customers found"
              : `Customers (${searchResults.length})`}
          </h2>
          {searchResults.length > 0 && (
            <div className="rounded-lg border bg-card overflow-hidden">
              <ul className="divide-y">
                {searchResults.map((s) => (
                  <li key={s.id}>
                    <button
                      type="button"
                      onClick={() => onView(s)}
                      className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-muted/50 transition-colors"
                    >
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-semibold truncate">{s.name || "Unknown"}</div>
                        <div className="text-xs text-muted-foreground truncate">
                          {s.vehicle_year} {s.vehicle_make} {s.vehicle_model}
                          {s.phone && <span> · {s.phone}</span>}
                          {s.plate && <span> · {s.plate.toUpperCase()}</span>}
                        </div>
                      </div>
                      <span className="text-[11px] font-semibold text-primary">Open</span>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </section>
      )}

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
