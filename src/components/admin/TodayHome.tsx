import { useMemo } from "react";
import { ArrowRight, Eye, Phone, DollarSign } from "lucide-react";
import type { Submission, Appointment, DealerLocation } from "@/lib/adminConstants";

interface TodayHomeProps {
  submissions: Submission[];
  appointments: Appointment[];
  dealerLocations: DealerLocation[];
  userName: string;
  onNavigate: (section: string) => void;
  onView: (sub: Submission) => void;
}

const greetingFor = (now: Date) => {
  const h = now.getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
};

const dollars = (n: number, kSuffix = false) => {
  if (n == null || isNaN(n)) return "—";
  if (kSuffix && n >= 1000) return `$${(n / 1000).toFixed(1).replace(/\.0$/, "")}k`;
  return `$${n.toLocaleString()}`;
};

const minutesAgo = (iso: string) =>
  Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 60_000));

const relTime = (iso: string) => {
  const m = minutesAgo(iso);
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  return `${Math.floor(h / 24)}d`;
};

const ymm = (s: Submission) =>
  [s.vehicle_year, s.vehicle_make, s.vehicle_model].filter(Boolean).join(" ") || "Vehicle TBD";

const valueGuess = (s: Submission) =>
  s.offered_price ?? s.estimated_offer_high ?? s.acv_value ?? null;

const initialsOf = (name: string | null | undefined) =>
  (name || "??")
    .split(/\s+/)
    .filter(Boolean)
    .map((p) => p[0]!.toUpperCase())
    .slice(0, 2)
    .join("");

const apptTimeKey = (t: string) => {
  const m = /^(\d{1,2}):(\d{2})\s*(AM|PM)$/i.exec(t.trim());
  if (!m) return 9999;
  let hour = parseInt(m[1], 10) % 12;
  if (m[3].toUpperCase() === "PM") hour += 12;
  return hour * 60 + parseInt(m[2], 10);
};

const TodayHome = ({
  submissions, appointments, userName, onNavigate, onView,
}: TodayHomeProps) => {
  const now = new Date();
  const todayStr = now.toISOString().slice(0, 10);
  const monthPrefix = todayStr.slice(0, 7);
  const dateLabel = now.toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" });
  const firstName = (userName || "").trim().split(/\s+/)[0] || "there";

  // ── RIGHT NOW: live arrivals + on-the-way ──
  const liveArrived = useMemo(
    () => submissions
      .filter((s) => s.progress_status === "customer_arrived")
      .sort((a, b) => (b.status_updated_at || "").localeCompare(a.status_updated_at || "")),
    [submissions],
  );
  const liveOnTheWay = useMemo(
    () => submissions
      .filter((s) => s.progress_status === "on_the_way")
      .sort((a, b) => (b.status_updated_at || "").localeCompare(a.status_updated_at || "")),
    [submissions],
  );

  // ── KPIs ──
  const kpis = useMemo(() => {
    let acquisitionsToday = 0;
    let mtdGross = 0;
    let openLeads = 0;
    let needAction = 0;
    submissions.forEach((s) => {
      if (s.progress_status === "purchase_complete") {
        const completedAt = (s.status_updated_at || s.created_at).slice(0, 10);
        if (completedAt === todayStr) acquisitionsToday++;
        if ((s.status_updated_at || s.created_at).slice(0, 7) === monthPrefix) {
          mtdGross += s.offered_price || 0;
        }
      } else if (!["dead_lead", "partial"].includes(s.progress_status)) {
        openLeads++;
        if ((!s.offered_price || s.offered_price <= 0) && minutesAgo(s.created_at) > 60) {
          needAction++;
        }
      }
    });
    return { acquisitionsToday, mtdGross, openLeads, needAction };
  }, [submissions, todayStr, monthPrefix]);

  // ── DO NEXT priority list ──
  type DoNextKind = "sla" | "make_offer" | "follow_up" | "call_new";
  const doNext = useMemo(() => {
    const items = submissions
      .map((s) => {
        const ageHours = (Date.now() - new Date(s.created_at).getTime()) / 3_600_000;
        let priority = 99;
        let kind: DoNextKind = "call_new";
        if ((!s.offered_price || s.offered_price <= 0) && ageHours > 24
            && !["dead_lead", "purchase_complete", "partial"].includes(s.progress_status)) {
          priority = 0; kind = "sla";
        } else if (s.progress_status === "inspection_completed") {
          priority = 1; kind = "make_offer";
        } else if (s.progress_status === "contacted") {
          priority = 2; kind = "follow_up";
        } else if (s.progress_status === "new") {
          priority = 3; kind = "call_new";
        } else {
          priority = 99;
        }
        return { sub: s, priority, kind, ageHours };
      })
      .filter((x) => x.priority < 99)
      .sort((a, b) => a.priority - b.priority || b.ageHours - a.ageHours)
      .slice(0, 5);
    return items;
  }, [submissions]);

  // ── APPOINTMENTS TODAY ──
  const todaysAppts = useMemo(
    () => appointments
      .filter((a) => a.preferred_date === todayStr)
      .sort((a, b) => apptTimeKey(a.preferred_time) - apptTimeKey(b.preferred_time)),
    [appointments, todayStr],
  );
  const subByToken = useMemo(() => {
    const m = new Map<string, Submission>();
    submissions.forEach((s) => { if (s.token) m.set(s.token, s); });
    return m;
  }, [submissions]);

  return (
    <div className="space-y-8 max-w-6xl">
      {/* Greeting */}
      <header>
        <p className="text-xs text-muted-foreground">{dateLabel}</p>
        <h1 className="text-3xl font-bold tracking-tight mt-1">{greetingFor(now)}, {firstName}.</h1>
        <p className="text-sm text-muted-foreground mt-1">Here's what needs you today.</p>
      </header>

      {/* RIGHT NOW */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-[11px] font-bold tracking-[0.1em] text-muted-foreground uppercase">Right Now</h2>
          <span className="text-xs text-muted-foreground">Live updates</span>
        </div>
        {liveArrived.length === 0 && liveOnTheWay.length === 0 ? (
          <div className="rounded-lg border bg-card p-6 text-sm text-muted-foreground text-center">
            Nothing live right now. Customers en route or arrived will appear here.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {liveArrived.slice(0, 1).map((s) => (
              <RightNowCard
                key={s.id}
                tone="red"
                badge="JUST ARRIVED"
                rel={s.status_updated_at ? relTime(s.status_updated_at) : ""}
                name={s.name || "Customer"}
                detail={[ymm(s), valueGuess(s) ? dollars(valueGuess(s)!) : null].filter(Boolean).join(" · ")}
                primaryLabel="Greet now"
                onPrimary={() => onView(s)}
                secondaryLabel="Open file"
                onSecondary={() => onView(s)}
              />
            ))}
            {liveOnTheWay.slice(0, 1).map((s) => (
              <RightNowCard
                key={s.id}
                tone="amber"
                badge="ON THE WAY"
                rel={s.status_updated_at ? relTime(s.status_updated_at) : ""}
                name={s.name || "Customer"}
                detail={[ymm(s), s.appointment_date ? `Appt ${s.appointment_date}` : null].filter(Boolean).join(" · ")}
                primaryLabel="Prep file"
                onPrimary={() => onView(s)}
                secondaryLabel="Call"
                onSecondary={() => s.phone && (window.location.href = `tel:${s.phone}`)}
              />
            ))}
          </div>
        )}
      </section>

      {/* KPI tiles */}
      <section className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiTile label="Today" value={String(kpis.acquisitionsToday)} sub="acquisitions" />
        <KpiTile
          label="MTD Gross"
          value={dollars(kpis.mtdGross, true)}
          sub="month-to-date"
          valueClass="text-emerald-600"
        />
        <KpiTile label="Open Leads" value={String(kpis.openLeads)} sub={`${kpis.needAction} need action`} />
        <KpiTile label="Avg Response" value="—" sub="goal < 2h" valueClass="text-emerald-600" />
      </section>

      {/* DO NEXT */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-[11px] font-bold tracking-[0.1em] text-muted-foreground uppercase">Do Next</h2>
          <button
            type="button"
            onClick={() => onNavigate("submissions")}
            className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1"
          >
            View all leads <ArrowRight className="w-3 h-3" />
          </button>
        </div>
        {doNext.length === 0 ? (
          <div className="rounded-lg border bg-card p-6 text-sm text-muted-foreground text-center">
            All caught up. New leads needing action will appear here.
          </div>
        ) : (
          <div className="rounded-lg border bg-card overflow-hidden">
            <ul className="divide-y">
              {doNext.map((row) => (
                <li key={row.sub.id}>
                  <DoNextRow row={row} onView={onView} />
                </li>
              ))}
            </ul>
          </div>
        )}
      </section>

      {/* APPOINTMENTS TODAY */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-[11px] font-bold tracking-[0.1em] text-muted-foreground uppercase">Appointments Today</h2>
          <span className="text-xs text-muted-foreground">{todaysAppts.length} scheduled</span>
        </div>
        {todaysAppts.length === 0 ? (
          <div className="rounded-lg border bg-card p-6 text-sm text-muted-foreground text-center">
            No appointments scheduled for today.
          </div>
        ) : (
          <div className="rounded-lg border bg-card overflow-hidden">
            <ul className="divide-y">
              {todaysAppts.map((a) => (
                <li key={a.id}>
                  <ApptRow
                    appt={a}
                    sub={a.submission_token ? subByToken.get(a.submission_token) ?? null : null}
                    onNavigate={onNavigate}
                    onView={onView}
                  />
                </li>
              ))}
            </ul>
          </div>
        )}
      </section>
    </div>
  );
};

/* ─────────────── Sub-components ─────────────── */

function RightNowCard({
  tone, badge, rel, name, detail, primaryLabel, onPrimary, secondaryLabel, onSecondary,
}: {
  tone: "red" | "amber";
  badge: string;
  rel: string;
  name: string;
  detail: string;
  primaryLabel: string;
  onPrimary: () => void;
  secondaryLabel: string;
  onSecondary: () => void;
}) {
  const accent = tone === "red"
    ? "border-l-red-500 [--btn-bg:#dc2626] [--btn-bg-hover:#b91c1c]"
    : "border-l-amber-500 [--btn-bg:#0f172a] [--btn-bg-hover:#020617]";
  const badgeColor = tone === "red" ? "text-red-600" : "text-amber-600";
  const dot = tone === "red"
    ? <span className="w-2 h-2 rounded-full bg-red-500 inline-block" />
    : <span className="w-3 h-3 rounded-full border-2 border-amber-500 inline-block" />;
  return (
    <div className={`rounded-lg border border-l-4 bg-card p-4 ${accent}`}>
      <div className="flex items-start justify-between gap-2">
        <div className={`text-[11px] font-bold tracking-wider uppercase inline-flex items-center gap-1.5 ${badgeColor}`}>
          {dot}
          {badge}
        </div>
        <span className="text-xs text-muted-foreground">{rel}</span>
      </div>
      <div className="mt-2">
        <div className="text-base font-semibold">{name}</div>
        <div className="text-xs text-muted-foreground mt-0.5">{detail}</div>
      </div>
      <div className="mt-3 flex items-stretch gap-2">
        <button
          type="button"
          onClick={onPrimary}
          className="flex-1 h-9 rounded-md text-white text-xs font-bold inline-flex items-center justify-center gap-1.5 transition"
          style={{ background: "var(--btn-bg)" }}
          onMouseOver={(e) => (e.currentTarget.style.background = "var(--btn-bg-hover)")}
          onMouseOut={(e) => (e.currentTarget.style.background = "var(--btn-bg)")}
        >
          <ArrowRight className="w-3.5 h-3.5" />
          {primaryLabel}
        </button>
        <button
          type="button"
          onClick={onSecondary}
          className="px-3 h-9 rounded-md border bg-background text-xs font-medium hover:bg-muted/60 transition"
        >
          {secondaryLabel}
        </button>
      </div>
    </div>
  );
}

function KpiTile({ label, value, sub, valueClass = "" }: {
  label: string; value: string; sub: string; valueClass?: string;
}) {
  return (
    <div className="rounded-lg border bg-card p-5">
      <div className="text-[11px] font-bold tracking-wider uppercase text-muted-foreground">{label}</div>
      <div className={`text-3xl font-bold mt-2 ${valueClass}`}>{value}</div>
      <div className="text-xs text-muted-foreground mt-1">{sub}</div>
    </div>
  );
}

function DoNextRow({
  row, onView,
}: {
  row: { sub: Submission; kind: "sla" | "make_offer" | "follow_up" | "call_new"; ageHours: number };
  onView: (s: Submission) => void;
}) {
  const { sub, kind, ageHours } = row;
  const ageLabel = ageHours < 1
    ? `${Math.max(1, Math.floor(ageHours * 60))}m`
    : ageHours < 24
      ? `${Math.floor(ageHours)}h`
      : `${Math.floor(ageHours / 24)}d`;

  const statusPill = (() => {
    switch (kind) {
      case "sla": return { label: `SLA · ${Math.floor(ageHours / 24)}d`, cls: "bg-red-100 text-red-700" };
      case "make_offer": return { label: "Inspected", cls: "bg-blue-100 text-blue-700" };
      case "follow_up": return { label: "Contacted", cls: "bg-blue-100 text-blue-700" };
      case "call_new": return { label: "New", cls: "bg-muted text-muted-foreground" };
    }
  })();

  const action = (() => {
    switch (kind) {
      case "sla": return { label: "Call now", icon: Phone, cls: "bg-red-600 hover:bg-red-700 text-white" };
      case "make_offer": return { label: "Make offer", icon: DollarSign, cls: "bg-blue-600 hover:bg-blue-700 text-white" };
      case "follow_up": return { label: "Follow up", icon: Phone, cls: "bg-background border hover:bg-muted/60 text-foreground" };
      case "call_new": return { label: "Call", icon: Phone, cls: "bg-slate-900 hover:bg-slate-800 text-white" };
    }
  })();
  const ActionIcon = action.icon;

  const showSlaBar = kind === "sla";

  return (
    <div className="flex items-center gap-3 px-4 py-3">
      {showSlaBar && <span className="self-stretch w-0.5 -my-3 bg-red-500" aria-hidden />}
      <div className="w-9 h-9 rounded-full bg-muted text-xs font-bold inline-flex items-center justify-center shrink-0">
        {initialsOf(sub.name)}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm font-semibold truncate">{sub.name || "Unnamed lead"}</span>
          <span className={`text-[10px] font-bold rounded px-1.5 py-0.5 ${statusPill.cls}`}>{statusPill.label}</span>
        </div>
        <div className="text-xs text-muted-foreground truncate">
          {ymm(sub)}
          {valueGuess(sub) != null && <> · ~{dollars(valueGuess(sub)!)}</>}
        </div>
      </div>
      <span className="text-xs text-muted-foreground tabular-nums">{ageLabel}</span>
      <button
        type="button"
        onClick={() => onView(sub)}
        className="w-8 h-8 inline-flex items-center justify-center rounded-md hover:bg-muted/60 text-muted-foreground"
        aria-label="View file"
      >
        <Eye className="w-4 h-4" />
      </button>
      <button
        type="button"
        onClick={() => onView(sub)}
        className={`h-8 px-3 rounded-md text-xs font-bold inline-flex items-center gap-1.5 transition ${action.cls}`}
      >
        <ActionIcon className="w-3.5 h-3.5" />
        {action.label}
      </button>
    </div>
  );
}

function ApptRow({
  appt, sub, onNavigate, onView,
}: {
  appt: Appointment;
  sub: Submission | null;
  onNavigate: (section: string) => void;
  onView: (s: Submission) => void;
}) {
  // Status pill: derive from underlying submission status when we have it
  const pill = (() => {
    const s = sub?.progress_status;
    if (s === "customer_arrived") return { label: "Arrived", cls: "bg-red-100 text-red-700", dot: "bg-red-500" };
    if (s === "on_the_way") return { label: "On the way", cls: "bg-amber-100 text-amber-700", dot: "bg-amber-500" };
    return null;
  })();

  return (
    <div className="flex items-center gap-3 px-4 py-3">
      <div className="text-sm font-bold tabular-nums w-20 shrink-0">{appt.preferred_time}</div>
      <div className="flex-1 min-w-0">
        <div className="text-sm font-semibold truncate">{appt.customer_name}</div>
        <div className="text-xs text-muted-foreground truncate">{appt.vehicle_info || "Vehicle TBD"}</div>
      </div>
      {pill && (
        <span className={`text-[10px] font-bold rounded px-2 py-0.5 inline-flex items-center gap-1.5 ${pill.cls}`}>
          <span className={`w-1.5 h-1.5 rounded-full ${pill.dot}`} />
          {pill.label}
        </span>
      )}
      <button
        type="button"
        onClick={() => sub ? onView(sub) : onNavigate("accepted-appts")}
        className="text-xs font-semibold text-foreground hover:underline"
      >
        Open
      </button>
    </div>
  );
}

export default TodayHome;
