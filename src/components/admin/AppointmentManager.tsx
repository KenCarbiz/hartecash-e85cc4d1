// AppointmentManager — kill-switch wrapper.
//
// When site_config.ui_refresh_enabled is false (the default), this
// component delegates to LegacyAppointmentManager (verbatim current
// behavior). When the flag is true, it renders the front-desk-style
// layout below: date header + KPI mini-row + Right Now / Today /
// Upcoming / Past buckets.
//
// All data handlers (handleCreate, handleStatusUpdate, handleReschedule,
// the location filter, the Reschedule + Create dialogs) are duplicated
// between this file and the legacy on purpose — the brief explicitly
// forbids "while-I'm-here cleanups."

import { useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { safeInvoke } from "@/lib/safeInvoke";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Plus, Eye, CalendarClock, ChevronRight } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import type { Appointment, Submission } from "@/lib/adminConstants";
import { getTimeSlotsForDate, APPT_TIME_SLOTS_WEEKDAY, APPT_TIME_SLOTS_FRISSAT } from "@/lib/adminConstants";
import { useUIRefresh } from "@/hooks/useUIRefresh";
import {
  LegacyAppointmentManager,
  type AppointmentManagerProps,
} from "./AppointmentManager.legacy";

// ── Helpers shared with RightNowStrip in spirit; kept local because
// the brief forbids cross-file refactor in this pass. ─────────────
const parseApptDate = (a: Appointment): Date | null => {
  if (!a.preferred_date || !a.preferred_time) return null;
  const t = new Date(`${a.preferred_date} ${a.preferred_time}`).getTime();
  if (Number.isNaN(t)) return null;
  return new Date(t);
};

const todayLocalISO = (): string => {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
};

const fmtDateHeader = (d: Date): string =>
  d.toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" });

const fmtDateLabel = (iso: string): string =>
  new Date(`${iso}T12:00:00`).toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });

const ARRIVED_STATUS = "arrived";
const ON_THE_WAY_STATUS = "on_the_way";
const SOON_WINDOW_MS = 60 * 60 * 1000;
const NOW_WINDOW_MS = 15 * 60 * 1000;

const RefreshedAppointmentManager = ({
  appointments,
  setAppointments,
  submissions,
  dealerLocations,
  onViewSubmission,
  fetchSubmissions,
  fetchAppointments,
}: AppointmentManagerProps) => {
  const { toast } = useToast();
  const [locationFilter, setLocationFilter] = useState("all");
  const [showCreate, setShowCreate] = useState(false);
  const [showPast, setShowPast] = useState(false);
  const [rescheduleAppt, setRescheduleAppt] = useState<Appointment | null>(null);
  const [rescheduleForm, setRescheduleForm] = useState({ preferred_date: "", preferred_time: "" });
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({
    customer_name: "", customer_email: "", customer_phone: "",
    preferred_date: "", preferred_time: "", store_location: "",
    vehicle_info: "", notes: "", submission_token: "",
  });

  // ── Handlers ── identical to legacy (copied per brief). ─────────
  const handleCreate = async () => {
    if (!form.customer_name || !form.customer_email || !form.customer_phone || !form.preferred_date || !form.preferred_time) {
      toast({ title: "Missing fields", description: "Please fill in all required fields.", variant: "destructive" });
      return;
    }
    setCreating(true);
    try {
      const { error } = await supabase.from("appointments").insert({
        customer_name: form.customer_name, customer_email: form.customer_email, customer_phone: form.customer_phone,
        preferred_date: form.preferred_date, preferred_time: form.preferred_time,
        store_location: form.store_location || null, vehicle_info: form.vehicle_info || null,
        notes: form.notes || null, submission_token: form.submission_token || null,
      } as any);
      if (error) throw error;
      if (form.submission_token) {
        await supabase.from("submissions").update({
          progress_status: "inspection_scheduled", status_updated_at: new Date().toISOString(),
          appointment_date: form.preferred_date, appointment_set: true,
        }).eq("token", form.submission_token);
        fetchSubmissions();
      }
      safeInvoke("notify-appointment", { body: { appointment: form }, context: { from: "AppointmentManager.create" } });
      safeInvoke("send-appointment-confirmation", { body: { appointment: form }, context: { from: "AppointmentManager.create" } });
      toast({ title: "Appointment created", description: `Scheduled for ${form.preferred_date} at ${form.preferred_time}.` });
      setShowCreate(false);
      setForm({ customer_name: "", customer_email: "", customer_phone: "", preferred_date: "", preferred_time: "", store_location: "", vehicle_info: "", notes: "", submission_token: "" });
      fetchAppointments();
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally { setCreating(false); }
  };

  const handleStatusUpdate = async (id: string, status: string) => {
    const appt = appointments.find(a => a.id === id);
    if (!appt) return;
    const { error } = await supabase.from("appointments").update({ status }).eq("id", id);
    if (!error) {
      setAppointments(prev => prev.map(a => a.id === id ? { ...a, status } : a));
      if (status === "Confirmed") {
        try { await supabase.functions.invoke("send-appointment-confirmation", { body: { appointment: appt } }); } catch {
          toast({ title: "Warning", description: "Status updated but confirmation email failed.", variant: "destructive" });
        }
      }
      toast({ title: "Updated", description: `Appointment marked as ${status}.` });
    }
  };

  const handleReschedule = async () => {
    if (!rescheduleAppt || !rescheduleForm.preferred_date || !rescheduleForm.preferred_time) return;
    const { error } = await supabase.from("appointments").update({
      preferred_date: rescheduleForm.preferred_date, preferred_time: rescheduleForm.preferred_time,
    }).eq("id", rescheduleAppt.id);
    if (!error) {
      setAppointments(prev => prev.map(a => a.id === rescheduleAppt.id ? { ...a, preferred_date: rescheduleForm.preferred_date, preferred_time: rescheduleForm.preferred_time } : a));
      toast({ title: "Rescheduled", description: "Appointment updated." });
      if (rescheduleAppt.submission_token) {
        const linkedSub = submissions.find(s => s.token === rescheduleAppt.submission_token);
        if (linkedSub) {
          const loc = dealerLocations.find(l => l.id === (rescheduleAppt.store_location || ""));
          safeInvoke("send-notification", {
            body: { trigger_key: "customer_appointment_rescheduled", submission_id: linkedSub.id, appointment_date: rescheduleForm.preferred_date, appointment_time: rescheduleForm.preferred_time, location: loc?.name || "" },
            context: { from: "AppointmentManager.reschedule" },
          });
        }
      } else if (rescheduleAppt.customer_email) {
        safeInvoke("send-reschedule-notification", {
          body: { appointment: { ...rescheduleAppt, new_date: rescheduleForm.preferred_date, new_time: rescheduleForm.preferred_time, old_date: rescheduleAppt.preferred_date, old_time: rescheduleAppt.preferred_time } },
          context: { from: "AppointmentManager.reschedule" },
        });
      }
      setRescheduleAppt(null);
    } else {
      toast({ title: "Error", description: "Failed to reschedule.", variant: "destructive" });
    }
  };

  const filteredAppointments = useMemo(
    () => locationFilter === "all" ? appointments : appointments.filter(a => a.store_location === locationFilter),
    [appointments, locationFilter],
  );

  // Submission lookup by token — used to overlay arrived / on_the_way
  // status from the customer self check-in flow (Step 7) onto today's
  // appointment cards.
  const subByToken = useMemo(() => {
    const m = new Map<string, Submission>();
    for (const s of submissions) m.set(s.token, s);
    return m;
  }, [submissions]);

  // ── Bucket sort ── group filtered appts into Right Now / Today /
  // Upcoming / Past based on parsed date+time. Walk-ins (token-less)
  // still bucket correctly because we only need preferred_date.
  const buckets = useMemo(() => {
    const now = Date.now();
    const today = todayLocalISO();
    const rightNow: Appointment[] = [];
    const todayList: Appointment[] = [];
    const upcoming: Appointment[] = [];
    const past: Appointment[] = [];

    for (const a of filteredAppointments) {
      const d = a.preferred_date;
      const when = parseApptDate(a);
      const isArrived = a.submission_token
        ? subByToken.get(a.submission_token)?.progress_status === ARRIVED_STATUS
        : false;
      const withinNow = when ? Math.abs(when.getTime() - now) < NOW_WINDOW_MS : false;

      if (isArrived || (d === today && withinNow)) {
        rightNow.push(a);
        continue;
      }
      if (d === today) { todayList.push(a); continue; }
      if (d > today) { upcoming.push(a); continue; }
      past.push(a);
    }

    // Sort: parsed time ascending where available, falling back to the
    // raw preferred_time string so we still get something sensible when
    // the time string doesn't parse.
    const byTime = (a: Appointment, b: Appointment) => {
      const ta = parseApptDate(a)?.getTime() ?? 0;
      const tb = parseApptDate(b)?.getTime() ?? 0;
      if (ta !== tb) return ta - tb;
      return (a.preferred_time || "").localeCompare(b.preferred_time || "");
    };
    rightNow.sort(byTime);
    todayList.sort(byTime);
    upcoming.sort(byTime);
    past.sort((a, b) => byTime(b, a)); // most recent past first

    return { rightNow, todayList, upcoming, past };
  }, [filteredAppointments, subByToken]);

  // Group "upcoming" by date for the date subhead
  const upcomingByDate = useMemo(() => {
    const groups: { date: string; rows: Appointment[] }[] = [];
    let current: { date: string; rows: Appointment[] } | null = null;
    for (const a of buckets.upcoming) {
      if (!current || current.date !== a.preferred_date) {
        current = { date: a.preferred_date, rows: [] };
        groups.push(current);
      }
      current.rows.push(a);
    }
    return groups;
  }, [buckets.upcoming]);

  // ── KPI mini-row counts ──────────────────────────────────────────
  const kpis = useMemo(() => {
    const todayISO = todayLocalISO();
    const now = Date.now();
    let todayCount = 0;
    let confirmed = 0;
    let arrived = 0;
    let next60 = 0;
    for (const a of filteredAppointments) {
      const isToday = a.preferred_date === todayISO;
      if (isToday) todayCount++;
      if (isToday && a.status === "Confirmed") confirmed++;
      if (
        isToday &&
        a.submission_token &&
        subByToken.get(a.submission_token)?.progress_status === ARRIVED_STATUS
      ) {
        arrived++;
      }
      const when = parseApptDate(a);
      if (when && when.getTime() - now > 0 && when.getTime() - now <= SOON_WINDOW_MS) {
        next60++;
      }
    }
    return { todayCount, confirmed, arrived, next60 };
  }, [filteredAppointments, subByToken]);

  const getCreateTimeSlots = () => getTimeSlotsForDate(form.preferred_date);
  const getRescheduleTimeSlots = () => getTimeSlotsForDate(rescheduleForm.preferred_date);

  // ── Row renderer — used by all four buckets ──────────────────────
  const renderRow = (appt: Appointment, opts: { highlight?: "arrived" | "now" } = {}) => {
    const linkedSub = appt.submission_token ? subByToken.get(appt.submission_token) : undefined;
    const isArrived = linkedSub?.progress_status === ARRIVED_STATUS;
    const isOnTheWay = linkedSub?.progress_status === ON_THE_WAY_STATUS;
    const highlight =
      opts.highlight === "arrived" || isArrived
        ? "border-l-4 border-l-red-500 bg-red-500/5"
        : opts.highlight === "now"
        ? "border-l-4 border-l-amber-500 bg-amber-500/5"
        : isOnTheWay
        ? "border-l-4 border-l-amber-500"
        : "";
    return (
      <article
        key={appt.id}
        className={`rounded-xl border border-border bg-card p-3 ${highlight}`}
      >
        <div className="flex items-center gap-3">
          {/* Time chip */}
          <div className="shrink-0 w-16 text-center">
            <div className="text-[14px] font-bold text-foreground leading-tight">
              {appt.preferred_time || "—"}
            </div>
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground mt-0.5">
              {new Date(`${appt.preferred_date}T12:00:00`).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
            </div>
          </div>

          {/* Customer + vehicle */}
          <div className="flex-1 min-w-0">
            <div className="text-[14px] font-semibold text-foreground truncate">
              {appt.customer_name}
              {isArrived && (
                <span className="ml-2 inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-red-700 dark:text-red-300">
                  <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
                  Arrived
                </span>
              )}
              {!isArrived && isOnTheWay && (
                <span className="ml-2 inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-amber-700 dark:text-amber-300">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                  On the way
                </span>
              )}
            </div>
            <div className="text-[12px] text-muted-foreground truncate">
              {appt.vehicle_info || "—"}
              {appt.customer_phone ? ` · ${appt.customer_phone}` : ""}
            </div>
          </div>

          {/* Status pill */}
          <Badge
            variant={appt.status === "Confirmed" ? "default" : appt.status === "Completed" ? "secondary" : "outline"}
            className="text-[10px] shrink-0"
          >
            {appt.status}
          </Badge>

          {/* Actions */}
          <div className="flex items-center gap-1 shrink-0">
            {appt.submission_token && (
              <Button size="sm" variant="ghost" className="h-8 w-8 p-0" title="View customer" aria-label="View customer" onClick={() => onViewSubmission(appt)}>
                <Eye className="w-4 h-4" />
              </Button>
            )}
            <Button
              size="sm"
              variant="ghost"
              className="h-8 w-8 p-0"
              title="Reschedule"
              aria-label="Reschedule"
              onClick={() => {
                setRescheduleAppt(appt);
                setRescheduleForm({ preferred_date: appt.preferred_date, preferred_time: appt.preferred_time });
              }}
            >
              <CalendarClock className="w-4 h-4" />
            </Button>
            {appt.status === "pending" && (
              <Button size="sm" variant="outline" className="h-8 text-[12px]" onClick={() => handleStatusUpdate(appt.id, "Confirmed")}>
                Confirm
              </Button>
            )}
            {appt.status === "Confirmed" && (
              <Button size="sm" variant="outline" className="h-8 text-[12px]" onClick={() => handleStatusUpdate(appt.id, "Completed")}>
                Complete
              </Button>
            )}
            <Button
              size="sm"
              variant="ghost"
              className="h-8 text-[12px] text-destructive hover:text-destructive"
              onClick={() => handleStatusUpdate(appt.id, "Cancelled")}
            >
              Cancel
            </Button>
          </div>
        </div>
      </article>
    );
  };

  const sectionLabel = (label: string, count: number) => (
    <h3 className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
      {label} <span className="text-foreground/60 font-bold">· {count}</span>
    </h3>
  );

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-end justify-between gap-4 flex-wrap">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            {fmtDateHeader(new Date())}
          </p>
          <h1 className="text-2xl font-bold tracking-tight text-foreground mt-0.5">
            Appointments
          </h1>
        </div>
        <div className="flex items-center gap-2">
          <Select value={locationFilter} onValueChange={setLocationFilter}>
            <SelectTrigger className="w-[200px] h-9 text-sm">
              <SelectValue placeholder="All locations" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All locations</SelectItem>
              {dealerLocations.map(loc => (
                <SelectItem key={loc.id} value={loc.id}>{loc.name} — {loc.city}, {loc.state}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button size="sm" className="h-9" onClick={() => setShowCreate(true)}>
            <Plus className="w-4 h-4 mr-1" /> New
          </Button>
        </div>
      </div>

      {/* KPI mini-row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="rounded-xl border border-border bg-card p-4">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Today</p>
          <p className="text-2xl font-bold text-foreground mt-1">{kpis.todayCount}</p>
        </div>
        <div className="rounded-xl border border-border bg-card p-4">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Confirmed</p>
          <p className="text-2xl font-bold text-foreground mt-1">{kpis.confirmed}</p>
        </div>
        <div className="rounded-xl border border-border bg-card p-4">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Arrived</p>
          <p className="text-2xl font-bold text-foreground mt-1">{kpis.arrived}</p>
          {kpis.arrived > 0 && (
            <p className="text-[11px] text-red-600 dark:text-red-400 font-semibold mt-0.5">on the lot</p>
          )}
        </div>
        <div className="rounded-xl border border-border bg-card p-4">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Next 60m</p>
          <p className="text-2xl font-bold text-foreground mt-1">{kpis.next60}</p>
        </div>
      </div>

      {/* Right Now */}
      {buckets.rightNow.length > 0 && (
        <section className="space-y-2">
          {sectionLabel("Right now", buckets.rightNow.length)}
          <div className="space-y-2">
            {buckets.rightNow.map(a => renderRow(a, { highlight: "arrived" }))}
          </div>
        </section>
      )}

      {/* Today */}
      <section className="space-y-2">
        {sectionLabel("Today", buckets.todayList.length)}
        {buckets.todayList.length === 0 ? (
          <p className="text-sm text-muted-foreground italic px-1">Nothing scheduled today.</p>
        ) : (
          <div className="space-y-2">
            {buckets.todayList.map(a => renderRow(a))}
          </div>
        )}
      </section>

      {/* Upcoming */}
      {buckets.upcoming.length > 0 && (
        <section className="space-y-2">
          {sectionLabel("Upcoming", buckets.upcoming.length)}
          <div className="space-y-3">
            {upcomingByDate.map(group => (
              <div key={group.date} className="space-y-2">
                <p className="text-[11px] font-semibold text-muted-foreground/80">
                  {fmtDateLabel(group.date)} · {group.rows.length}
                </p>
                <div className="space-y-2">
                  {group.rows.map(a => renderRow(a))}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Past — collapsed by default */}
      {buckets.past.length > 0 && (
        <section className="space-y-2">
          <button
            type="button"
            onClick={() => setShowPast(p => !p)}
            className="inline-flex items-center gap-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground hover:text-foreground"
          >
            <ChevronRight className={`w-3 h-3 transition-transform ${showPast ? "rotate-90" : ""}`} />
            Past <span className="text-foreground/60 font-bold">· {buckets.past.length}</span>
          </button>
          {showPast && (
            <div className="space-y-2">
              {buckets.past.map(a => renderRow(a))}
            </div>
          )}
        </section>
      )}

      {/* Empty-state if every bucket is empty */}
      {buckets.rightNow.length === 0 &&
        buckets.todayList.length === 0 &&
        buckets.upcoming.length === 0 &&
        buckets.past.length === 0 && (
          <div className="text-center py-12 border border-dashed border-border rounded-xl">
            <p className="text-sm font-semibold text-foreground">No appointments</p>
            <p className="text-xs text-muted-foreground mt-1">
              {locationFilter === "all"
                ? "Click \"New\" to schedule one, or wait for a customer to book online."
                : "No appointments at this location. Try \"All locations.\""}
            </p>
          </div>
        )}

      {/* Reschedule Dialog — preserved verbatim from legacy */}
      <Dialog open={!!rescheduleAppt} onOpenChange={(open) => { if (!open) setRescheduleAppt(null); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>Reschedule Appointment</DialogTitle></DialogHeader>
          {rescheduleAppt && (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">Rescheduling for <strong>{rescheduleAppt.customer_name}</strong></p>
              <div className="space-y-2">
                <label className="text-sm font-medium">New Date</label>
                <Input type="date" min={new Date().toISOString().split("T")[0]} value={rescheduleForm.preferred_date} onChange={(e) => {
                  const d = e.target.value;
                  const day = new Date(d + "T12:00:00").getDay();
                  const slots = day === 0 ? [] : (day === 5 || day === 6) ? APPT_TIME_SLOTS_FRISSAT : APPT_TIME_SLOTS_WEEKDAY;
                  setRescheduleForm(prev => ({ preferred_date: d, preferred_time: slots.includes(prev.preferred_time) ? prev.preferred_time : "" }));
                }} />
              </div>
              {rescheduleForm.preferred_date && new Date(rescheduleForm.preferred_date + "T12:00:00").getDay() === 0 ? (
                <p className="text-sm text-destructive font-medium">Closed on Sundays. Pick another date.</p>
              ) : (
                <div className="space-y-2">
                  <label className="text-sm font-medium">New Time</label>
                  <Select value={rescheduleForm.preferred_time} onValueChange={(v) => setRescheduleForm(prev => ({ ...prev, preferred_time: v }))}>
                    <SelectTrigger><SelectValue placeholder="Select a time" /></SelectTrigger>
                    <SelectContent>{getRescheduleTimeSlots().map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              )}
              <div className="flex justify-end gap-2 pt-2">
                <Button variant="outline" onClick={() => setRescheduleAppt(null)}>Cancel</Button>
                <Button onClick={handleReschedule} disabled={!rescheduleForm.preferred_date || !rescheduleForm.preferred_time || new Date(rescheduleForm.preferred_date + "T12:00:00").getDay() === 0}>Save New Time</Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Create Appointment Dialog — preserved verbatim from legacy */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Schedule an Appointment</DialogTitle></DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5"><Label>Name *</Label><Input value={form.customer_name} onChange={(e) => setForm(p => ({ ...p, customer_name: e.target.value }))} placeholder="Customer name" /></div>
              <div className="space-y-1.5"><Label>Phone *</Label><Input value={form.customer_phone} onChange={(e) => setForm(p => ({ ...p, customer_phone: e.target.value }))} placeholder="(555) 123-4567" /></div>
            </div>
            <div className="space-y-1.5"><Label>Email *</Label><Input type="email" value={form.customer_email} onChange={(e) => setForm(p => ({ ...p, customer_email: e.target.value }))} placeholder="email@example.com" /></div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5"><Label>Date *</Label><Input type="date" min={new Date().toISOString().split("T")[0]} value={form.preferred_date} onChange={(e) => setForm(p => ({ ...p, preferred_date: e.target.value, preferred_time: "" }))} /></div>
              <div className="space-y-1.5">
                <Label>Time *</Label>
                {form.preferred_date && new Date(form.preferred_date + "T12:00:00").getDay() === 0 ? (
                  <p className="text-sm text-destructive font-medium py-2">Closed Sundays</p>
                ) : (
                  <Select value={form.preferred_time} onValueChange={(v) => setForm(p => ({ ...p, preferred_time: v }))} disabled={!form.preferred_date}>
                    <SelectTrigger><SelectValue placeholder="Select time" /></SelectTrigger>
                    <SelectContent>{getCreateTimeSlots().map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
                  </Select>
                )}
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Link to Submission (optional)</Label>
              <Select value={form.submission_token} onValueChange={(v) => setForm(p => ({ ...p, submission_token: v }))}>
                <SelectTrigger><SelectValue placeholder="Select a submission" /></SelectTrigger>
                <SelectContent>
                  {submissions.map(s => <SelectItem key={s.token} value={s.token}>{s.name || "Unknown"} — {[s.vehicle_year, s.vehicle_make, s.vehicle_model].filter(Boolean).join(" ") || "No vehicle"}</SelectItem>)}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">Linking will update status to "Inspection Scheduled".</p>
            </div>
            <div className="space-y-1.5">
              <Label>Store Location</Label>
              <Select value={form.store_location} onValueChange={(v) => setForm(p => ({ ...p, store_location: v }))}>
                <SelectTrigger><SelectValue placeholder="Select location" /></SelectTrigger>
                <SelectContent>{dealerLocations.map(loc => <SelectItem key={loc.id} value={loc.id}>{loc.name} — {loc.city}, {loc.state}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5"><Label>Vehicle Info</Label><Input value={form.vehicle_info} onChange={(e) => setForm(p => ({ ...p, vehicle_info: e.target.value }))} placeholder="e.g. 2020 Toyota Camry" /></div>
            <div className="space-y-1.5"><Label>Notes</Label><Textarea value={form.notes} onChange={(e) => setForm(p => ({ ...p, notes: e.target.value }))} placeholder="Internal notes..." rows={2} /></div>
            <Button className="w-full" onClick={handleCreate} disabled={creating}>{creating ? "Creating..." : "Create Appointment"}</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

// Public component — kill-switch wrapper. Default `false` keeps every
// dealer on the legacy view until they're explicitly opted in.
const AppointmentManager = (props: AppointmentManagerProps) => {
  const refreshed = useUIRefresh();
  return refreshed ? <RefreshedAppointmentManager {...props} /> : <LegacyAppointmentManager {...props} />;
};

export default AppointmentManager;
