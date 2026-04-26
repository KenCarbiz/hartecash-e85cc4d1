// Today home page — landing surface for managers. See
// frontend-redesign/CLAUDE_CODE_BRIEF.md §2 + design_files/Admin Refresh.html.
//
// Composition:
//   1. Date + personalized greeting header
//   2. RightNowStrip — arrival / on-the-way cards (only renders when
//      there are arrived / on_the_way submissions)
//   3. TodayKpiRow — TODAY · MTD GROSS · OPEN LEADS · AVG RESPONSE
//   4. Do Next — SLA breaches + needs-offer + needs-call leads, capped
//      list with contextual action buttons
//   5. Appointments today — time-sorted list of today's bookings
//
// Routing into this component is owned by AdminSectionRenderer.tsx
// (key === "today"). The default-home effect in AdminDashboard.tsx
// chooses this for admins / GMs / used-car / new-car managers.

import { useMemo } from "react";
import type { Submission, Appointment } from "@/lib/adminConstants";
import { getStatusLabel } from "@/lib/adminConstants";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowRight, Phone, DollarSign, Calendar, CheckCircle2, Eye } from "lucide-react";
import { nextActionForLead, type LeadActionIcon } from "@/lib/leadNextAction";
import RightNowStrip from "./RightNowStrip";
import TodayKpiRow from "./TodayKpiRow";

interface TodayHomeProps {
  submissions: Submission[];
  appointments: Appointment[];
  userName: string;
  onView: (sub: Submission) => void;
  /** Optional — when supplied, the "View all leads →" link in the
   *  Do Next section header navigates to it. */
  onNavigate?: (section: string) => void;
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

const todayLocalISO = (): string => {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
};

const DAY_MS = 24 * 60 * 60 * 1000;

const NEEDS_OFFER_STATUSES = new Set([
  "inspection_completed",
  "appraisal_completed",
  "manager_approval_inspection",
]);

const NEEDS_CALL_STATUSES = new Set([
  "new",
  "contacted",
  "no_contact",
]);

const formatAge = (createdAt: string): string => {
  const created = new Date(createdAt).getTime();
  if (!Number.isFinite(created)) return "";
  const hours = Math.max(0, (Date.now() - created) / 36e5);
  if (hours < 1) return `${Math.round(hours * 60)}m`;
  if (hours < 24) return `${Math.round(hours)}h`;
  return `${Math.floor(hours / 24)}d`;
};

const initialsFor = (name: string | null): string => {
  if (!name) return "?";
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((n) => n[0]?.toUpperCase())
    .join("");
};

const vehicleLine = (s: Submission): string => {
  const head = [s.vehicle_year, s.vehicle_make, s.vehicle_model]
    .filter(Boolean)
    .join(" ")
    .trim();
  if (!head) return "Vehicle TBD";
  return head;
};

const offerLine = (s: Submission): string => {
  if (s.offered_price && s.offered_price > 0) {
    return `$${s.offered_price.toLocaleString()}`;
  }
  if (s.estimated_offer_high && s.estimated_offer_high > 0) {
    return `~$${s.estimated_offer_high.toLocaleString()}`;
  }
  return "—";
};

// Map LeadAction.icon string → lucide component
const ACTION_ICON: Record<NonNullable<LeadActionIcon>, React.ComponentType<{ className?: string }>> = {
  phone: Phone,
  dollar: DollarSign,
  calendar: Calendar,
  check: CheckCircle2,
  eye: Eye,
};

const variantClasses = (variant: "primary" | "ghost" | "destructive"): string => {
  if (variant === "destructive") return "bg-red-500 text-white hover:bg-red-600 border-red-500";
  if (variant === "primary") return "bg-foreground text-background hover:bg-foreground/90 border-foreground";
  return "bg-transparent text-foreground hover:bg-muted border-border";
};

const APPT_STATUS_TONE: Record<string, string> = {
  Confirmed: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/20",
  Completed: "bg-muted text-muted-foreground border-border",
  Cancelled: "bg-muted text-muted-foreground/60 border-border",
  pending: "bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/20",
};

const fmtApptTime = (t: string | null): string => {
  if (!t) return "—";
  return t;
};

const TodayHome = ({ submissions, appointments, userName, onView, onNavigate }: TodayHomeProps) => {
  const now = new Date();
  const greeting = greetingForHour(now.getHours());
  const fn = firstName(userName);

  // ── Do Next ── Three buckets, in order:
  //   1. SLA breach (red rail) — new + older than 24h
  //   2. Needs offer (accent action) — inspected / appraised
  //   3. Needs call (primary action) — new (fresh) / contacted
  const { slaBreached, needsOffer, needsCall } = useMemo(() => {
    const cutoff = Date.now() - DAY_MS;
    const sla: Submission[] = [];
    const offer: Submission[] = [];
    const call: Submission[] = [];

    for (const s of submissions) {
      const created = new Date(s.created_at).getTime();
      const isOld = Number.isFinite(created) && created < cutoff;

      // SLA: new + > 24h old, no offer yet
      if (s.progress_status === "new" && isOld && s.offered_price == null) {
        sla.push(s);
        continue;
      }
      // Needs offer
      if (NEEDS_OFFER_STATUSES.has(s.progress_status) && s.offered_price == null) {
        offer.push(s);
        continue;
      }
      // Needs call (fresh, not SLA-breached)
      if (NEEDS_CALL_STATUSES.has(s.progress_status)) {
        call.push(s);
        continue;
      }
    }

    // Sort each bucket by oldest-first (most-stale first within urgency tier).
    const byOldest = (a: Submission, b: Submission) =>
      new Date(a.created_at).getTime() - new Date(b.created_at).getTime();

    sla.sort(byOldest);
    offer.sort(byOldest);
    // For "needs call" we want freshest-first — calling a 5-minute-old
    // lead is higher value than a 12-hour-old one (the latter is closer
    // to SLA but not quite there yet).
    call.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

    return { slaBreached: sla, needsOffer: offer, needsCall: call };
  }, [submissions]);

  const doNextRows = useMemo(() => {
    // Cap at 8 total rows to keep the page focused. Order: SLA → offer → call.
    const combined = [
      ...slaBreached.map((s) => ({ s, kind: "sla" as const })),
      ...needsOffer.map((s) => ({ s, kind: "offer" as const })),
      ...needsCall.map((s) => ({ s, kind: "call" as const })),
    ];
    return combined.slice(0, 8);
  }, [slaBreached, needsOffer, needsCall]);

  const doNextTotal = slaBreached.length + needsOffer.length + needsCall.length;

  // ── Appointments today ──
  const todayAppts = useMemo(() => {
    const today = todayLocalISO();
    return appointments
      .filter((a) => a.preferred_date === today)
      .sort((a, b) => (a.preferred_time || "").localeCompare(b.preferred_time || ""));
  }, [appointments]);

  // Map appointment back to a submission for the Open button (if linked)
  const subByToken = useMemo(() => {
    const m = new Map<string, Submission>();
    for (const s of submissions) m.set(s.token, s);
    return m;
  }, [submissions]);

  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <p className="text-[12px] font-medium tracking-[0.05em] text-muted-foreground">
          {fmtDateHeader(now)}
        </p>
        <h1 className="text-[28px] leading-tight font-bold tracking-tight text-foreground">
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

      {/* ── Do Next ── concatenated action list across SLA / offer / call buckets */}
      {doNextRows.length > 0 && (
        <section aria-labelledby="do-next-heading" className="space-y-2">
          <div className="flex items-end justify-between gap-3">
            <h2
              id="do-next-heading"
              className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground"
            >
              Do next
            </h2>
            <div className="flex items-center gap-3">
              {doNextTotal > doNextRows.length && (
                <span className="text-[11px] text-muted-foreground">
                  Showing {doNextRows.length} of {doNextTotal}
                </span>
              )}
              {onNavigate && (
                <button
                  type="button"
                  onClick={() => onNavigate("submissions")}
                  className="inline-flex items-center gap-1 text-[12px] font-medium text-foreground/80 hover:text-foreground transition-colors"
                >
                  View all leads
                  <ArrowRight className="w-3 h-3" />
                </button>
              )}
            </div>
          </div>

          <div className="rounded-xl border border-border bg-card divide-y divide-border/60">
            {doNextRows.map(({ s, kind }) => {
              const action = nextActionForLead(s);
              const ActIcon = action.icon ? ACTION_ICON[action.icon] : null;
              const isSla = kind === "sla";

              // For SLA rows, we override the action to a clearer "Call now"
              // with red-destructive treatment regardless of status mapping.
              const effectiveLabel = isSla ? "Call now" : action.label;
              const effectiveVariant = isSla ? "destructive" : action.variant;
              // EffectiveIcon must be PascalCase so JSX treats it as a React
              // component, not an HTML tag.
              const EffectiveIcon = isSla ? Phone : ActIcon;

              return (
                <article
                  key={s.id}
                  className="flex items-center gap-3 p-3"
                >
                  {/* Left rail marker — red for SLA, transparent otherwise */}
                  <span
                    className={`w-1 self-stretch rounded-full ${isSla ? "bg-red-500" : "bg-transparent"}`}
                    aria-hidden
                  />

                  {/* Avatar / initials circle */}
                  <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center text-[11px] font-semibold text-foreground shrink-0">
                    {initialsFor(s.name)}
                  </div>

                  {/* Customer + vehicle + sub-text */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-semibold text-foreground truncate">
                        {s.name || "Unknown"}
                      </span>
                      {/* Status pill — labels the lead's current pipeline state
                          (Inspected / Contacted / New / etc.) so operators can
                          tell at a glance why this row is in the action list. */}
                      <span className="inline-flex items-center text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground border border-border">
                        {getStatusLabel(s.progress_status)}
                      </span>
                      {isSla && (
                        <span className="inline-flex items-center text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-red-500/10 text-red-700 dark:text-red-300 border border-red-500/30">
                          SLA · {formatAge(s.created_at)}
                        </span>
                      )}
                      {kind === "offer" && (
                        <span className="text-[10px] font-semibold uppercase tracking-wider text-amber-700 dark:text-amber-300">
                          Needs offer
                        </span>
                      )}
                    </div>
                    <p className="text-[12px] text-muted-foreground truncate mt-0.5">
                      {vehicleLine(s)}
                      {" · "}
                      <span className="font-mono">{offerLine(s)}</span>
                    </p>
                  </div>

                  {/* Age */}
                  {!isSla && (
                    <span className="hidden sm:inline text-[11px] font-mono text-muted-foreground shrink-0">
                      {formatAge(s.created_at)}
                    </span>
                  )}

                  {/* Eye → open file */}
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 shrink-0"
                    aria-label={`Open ${s.name || "lead"}'s file`}
                    onClick={() => onView(s)}
                  >
                    <Eye className="w-4 h-4" />
                  </Button>

                  {/* Contextual action */}
                  <button
                    type="button"
                    onClick={() => {
                      if (action.href) {
                        window.location.href = action.href;
                      } else {
                        onView(s);
                      }
                    }}
                    className={`inline-flex items-center gap-1.5 h-8 px-3 rounded-md text-[12px] font-semibold border transition-colors shrink-0 ${variantClasses(effectiveVariant)}`}
                  >
                    {EffectiveIcon && <EffectiveIcon className="w-3.5 h-3.5" />}
                    {effectiveLabel}
                  </button>
                </article>
              );
            })}
          </div>
        </section>
      )}

      {/* ── Appointments today ── time-sorted list of today's bookings */}
      {todayAppts.length > 0 && (
        <section aria-labelledby="appts-today-heading" className="space-y-2">
          <div className="flex items-end justify-between">
            <h2
              id="appts-today-heading"
              className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground"
            >
              Appointments today
            </h2>
            <span className="text-[11px] text-muted-foreground">
              {todayAppts.length} scheduled
            </span>
          </div>

          <div className="rounded-xl border border-border bg-card divide-y divide-border/60">
            {todayAppts.map((appt) => {
              const linkedSub = appt.submission_token
                ? subByToken.get(appt.submission_token)
                : undefined;
              const tone = APPT_STATUS_TONE[appt.status] || APPT_STATUS_TONE.pending;

              return (
                <article
                  key={appt.id}
                  className="flex items-center gap-3 p-3"
                >
                  <span className="font-mono text-sm font-semibold w-16 shrink-0">
                    {fmtApptTime(appt.preferred_time)}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-foreground truncate">
                      {appt.customer_name}
                    </p>
                    <p className="text-[12px] text-muted-foreground truncate">
                      {appt.vehicle_info || "—"}
                      {appt.customer_phone ? ` · ${appt.customer_phone}` : ""}
                    </p>
                  </div>
                  <Badge
                    variant="outline"
                    className={`text-[10px] shrink-0 ${tone}`}
                  >
                    {appt.status}
                  </Badge>
                  {linkedSub && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-8 text-[12px] shrink-0"
                      onClick={() => onView(linkedSub)}
                    >
                      Open
                      <ArrowRight className="w-3.5 h-3.5 ml-1" />
                    </Button>
                  )}
                </article>
              );
            })}
          </div>
        </section>
      )}
    </div>
  );
};

export default TodayHome;
