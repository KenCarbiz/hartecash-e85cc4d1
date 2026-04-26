/**
 * AllLeadsPage — dense lead-management table matching Admin Refresh.html
 * AllLeadsPage / LeadsTable mockup.
 *
 * Layout, top → bottom:
 *   1. H1 "All leads" + count subline
 *   2. Search + Filter + New lead actions (right cluster)
 *   3. Alert banner (arrived / on-the-way / SLA breach) — dismissible
 *   4. Quick filter chips (All / New / Hot / Today / Appointments / Accepted / Stuck)
 *   5. Dense table: Customer & vehicle / Status / Offer / Age / Score / Next
 *   6. Pagination footer
 *
 * Data source is the same `submissions` array the legacy SubmissionsTable
 * consumes. SubmissionsTable.tsx is kept untouched as a fallback — wired
 * via the `submissions-classic` activeSection key.
 */
import { useMemo, useState } from "react";
import {
  Search, Filter, Plus, X, Phone as PhoneIcon, DollarSign, Calendar,
  Eye, ArrowRight, CheckCircle2, AlertTriangle, ChevronLeft, ChevronRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  type Submission,
  type DealerLocation,
  PAGE_SIZE,
  isAcceptedWithAppointment,
  isAcceptedWithoutAppointment,
  isOfferPendingSubmission,
} from "@/lib/adminConstants";
import { nextActionForLead, type LeadActionIcon } from "@/lib/leadNextAction";
import { cn } from "@/lib/utils";

interface AllLeadsPageProps {
  submissions: Submission[];
  loading: boolean;
  search: string;
  onSearchChange: (val: string) => void;
  page: number;
  total: number;
  pageSize?: number;
  onPageChange: (page: number) => void;
  dealerLocations: DealerLocation[];
  onView: (sub: Submission) => void;
  onCreate?: () => void;
}

type ChipKey =
  | "all"
  | "arrived"
  | "new"
  | "hot"
  | "today"
  | "appointments"
  | "accepted"
  | "stuck";

// ── Helpers ────────────────────────────────────────────────────
const formatAge = (createdAt: string): { label: string; hours: number } => {
  const created = new Date(createdAt).getTime();
  const now = Date.now();
  const hours = Math.max(0, (now - created) / 36e5);
  if (hours < 1) return { label: `${Math.round(hours * 60)}m`, hours };
  if (hours < 24) return { label: `${Math.round(hours)}h`, hours };
  return { label: `${Math.floor(hours / 24)}d`, hours };
};

const initialsFor = (name: string | null) => {
  if (!name) return "?";
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((n) => n[0]?.toUpperCase())
    .join("");
};

/**
 * Lead-score heuristic. Real scoring lives elsewhere; this provides a
 * presentation-only badge so the UI matches the mockup. Returns null
 * for closed/dead leads.
 */
const scoreFor = (s: Submission): number | null => {
  if (s.progress_status === "purchase_complete" || s.progress_status === "check_request_submitted") return null;
  if (s.progress_status === "dead_lead") return null;

  let score = 50;
  if (s.is_hot_lead) score += 25;
  if (s.offered_price && s.offered_price > 0) score += 10;
  if (isAcceptedWithAppointment(s)) score += 15;
  if (s.appointment_set) score += 8;
  if (s.docs_uploaded) score += 5;
  if (s.photos_uploaded) score += 3;

  const age = formatAge(s.created_at).hours;
  if (age < 2) score += 10;
  else if (age > 48) score -= 10;
  else if (age > 24) score -= 5;

  return Math.max(0, Math.min(100, score));
};

// ── Status pill ────────────────────────────────────────────────
type StatusTone = "red" | "orange" | "green" | "purple" | "gray" | "blue" | "yellow";

const statusMeta = (
  s: Submission
): { label: string; tone: StatusTone; pulse?: boolean } => {
  // Customer self check-in states win over everything else — a customer
  // physically on the lot is the most pressing signal an admin can see.
  // See CLAUDE_CODE_BRIEF.md §3B + §7.
  if (s.progress_status === "arrived") {
    return { label: "Arrived", tone: "red", pulse: true };
  }
  if (s.progress_status === "on_the_way") {
    return { label: "On the way", tone: "orange" };
  }
  // Arrival / hot states first
  if (s.is_hot_lead && !isAcceptedWithAppointment(s)) {
    return { label: "Hot lead", tone: "red", pulse: true };
  }
  if (isAcceptedWithAppointment(s)) {
    return { label: "Inspection", tone: "purple" };
  }
  if (isAcceptedWithoutAppointment(s)) {
    return { label: "Offer accepted", tone: "green" };
  }

  switch (s.progress_status) {
    case "new":
      return { label: "New", tone: "blue" };
    case "contacted":
      return { label: "Contacted", tone: "yellow" };
    case "no_contact":
      return { label: "Follow-up", tone: "yellow" };
    case "inspection_scheduled":
    case "inspection_completed":
      return { label: "Inspection", tone: "purple" };
    case "appraisal_completed":
      return { label: "Appraisal", tone: "purple" };
    case "manager_approval_inspection":
      return { label: "MAI", tone: "orange" };
    case "offer_accepted":
    case "price_agreed":
      return { label: "Offer accepted", tone: "green" };
    case "deal_finalized":
      return { label: "Deal", tone: "green" };
    case "title_ownership_verified":
      return { label: "Title verified", tone: "green" };
    case "check_request_submitted":
    case "purchase_complete":
      return { label: "Purchased", tone: "gray" };
    case "dead_lead":
      return { label: "Wholesale", tone: "gray" };
    case "partial":
      return { label: "Abandoned", tone: "gray" };
    default:
      if (isOfferPendingSubmission(s)) return { label: "Offer pending", tone: "orange" };
      return { label: s.progress_status || "—", tone: "gray" };
  }
};

const toneClasses: Record<StatusTone, string> = {
  red: "bg-red-500/10 text-red-700 dark:text-red-300 border border-red-500/20",
  orange: "bg-orange-500/10 text-orange-700 dark:text-orange-300 border border-orange-500/20",
  green: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border border-emerald-500/20",
  purple: "bg-violet-500/10 text-violet-700 dark:text-violet-300 border border-violet-500/20",
  gray: "bg-muted text-muted-foreground border border-border",
  blue: "bg-blue-500/10 text-blue-700 dark:text-blue-300 border border-blue-500/20",
  yellow: "bg-amber-500/10 text-amber-700 dark:text-amber-300 border border-amber-500/20",
};

const toneDot: Record<StatusTone, string> = {
  red: "bg-red-500",
  orange: "bg-orange-500",
  green: "bg-emerald-500",
  purple: "bg-violet-500",
  gray: "bg-muted-foreground/50",
  blue: "bg-blue-500",
  yellow: "bg-amber-500",
};

const StatusPill = ({ s }: { s: Submission }) => {
  const m = statusMeta(s);
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 text-[11px] font-semibold px-2 py-0.5 rounded-full",
        toneClasses[m.tone]
      )}
    >
      <span
        className={cn("w-1.5 h-1.5 rounded-full", toneDot[m.tone], m.pulse && "animate-pulse")}
      />
      {m.label}
    </span>
  );
};

// ── Action button ──────────────────────────────────────────────
const actionIconMap: Record<NonNullable<LeadActionIcon>, React.ComponentType<{ className?: string }>> = {
  phone: PhoneIcon,
  dollar: DollarSign,
  calendar: Calendar,
  check: CheckCircle2,
  eye: Eye,
};

const actionVariantClasses: Record<string, string> = {
  primary: "bg-primary text-primary-foreground hover:bg-primary/90",
  ghost: "bg-transparent text-foreground hover:bg-muted border border-border",
  destructive: "bg-red-500 text-white hover:bg-red-500/90",
};

// ── Main component ─────────────────────────────────────────────
const AllLeadsPage = ({
  submissions,
  loading,
  search,
  onSearchChange,
  page,
  total,
  pageSize = PAGE_SIZE,
  onPageChange,
  onView,
  onCreate,
}: AllLeadsPageProps) => {
  const [chip, setChip] = useState<ChipKey>("all");
  const [bannerDismissed, setBannerDismissed] = useState(false);

  // ── Counts for chips ─────────────────────────────────────────
  const counts = useMemo(() => {
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    const todayStart = startOfDay.getTime();

    let arrived = 0;
    let newCount = 0;
    let hot = 0;
    let today = 0;
    let appts = 0;
    let accepted = 0;
    let stuck = 0;

    for (const s of submissions) {
      if (s.progress_status === "arrived") arrived++;
      if (s.progress_status === "new") newCount++;
      if (s.is_hot_lead) hot++;
      if (new Date(s.created_at).getTime() >= todayStart) today++;
      if (isAcceptedWithAppointment(s)) appts++;
      if (isAcceptedWithoutAppointment(s)) accepted++;
      const age = formatAge(s.created_at).hours;
      if (age > 24 && !isAcceptedWithAppointment(s) && s.progress_status !== "purchase_complete") stuck++;
    }
    return { all: submissions.length, arrived, new: newCount, hot, today, appts, accepted, stuck };
  }, [submissions]);

  // ── Chip-filtered rows ───────────────────────────────────────
  const filtered = useMemo(() => {
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    const todayStart = startOfDay.getTime();

    return submissions.filter((s) => {
      switch (chip) {
        case "arrived":
          return s.progress_status === "arrived";
        case "new":
          return s.progress_status === "new";
        case "hot":
          return s.is_hot_lead;
        case "today":
          return new Date(s.created_at).getTime() >= todayStart;
        case "appointments":
          return isAcceptedWithAppointment(s);
        case "accepted":
          return isAcceptedWithoutAppointment(s);
        case "stuck":
          return (
            formatAge(s.created_at).hours > 24 &&
            !isAcceptedWithAppointment(s) &&
            s.progress_status !== "purchase_complete"
          );
        default:
          return true;
      }
    });
  }, [submissions, chip]);

  // ── Banner: pick the most-pressing alert from current rows ───
  // Priority order:
  //   1. progress_status === "arrived" — customer is physically here
  //      (set by /check-in/:token tap of "I'm here"). Per
  //      CLAUDE_CODE_BRIEF.md §3B this trumps every other alert.
  //   2. Hot new leads — high intent, time-sensitive
  //   3. SLA breach — old "new" with no contact
  const banner = useMemo(() => {
    if (bannerDismissed) return null;
    const arrivals = submissions.filter((s) => s.progress_status === "arrived");
    if (arrivals.length > 0) {
      const a = arrivals[0];
      const veh = [a.vehicle_year, a.vehicle_make, a.vehicle_model]
        .filter(Boolean)
        .join(" ");
      const extra = arrivals.length > 1 ? ` · +${arrivals.length - 1} more` : "";
      return {
        kind: "arrived" as const,
        title: `${a.name || "A customer"} just arrived on the lot${extra}`,
        subtitle: veh
          ? `${veh} · go greet now`
          : "Customer waiting on the lot",
        action: "Greet now",
        sub: a,
        tone: "red" as StatusTone,
        moreCount: arrivals.length - 1,
      };
    }
    const hot = submissions.find((s) => s.is_hot_lead && s.progress_status === "new");
    if (hot) {
      return {
        kind: "hot" as const,
        title: `${hot.name || "A hot lead"} just landed`,
        subtitle: `${hot.vehicle_year || ""} ${hot.vehicle_make || ""} ${hot.vehicle_model || ""} · call within 5 min`,
        action: "Call now",
        sub: hot,
        tone: "orange" as StatusTone,
      };
    }
    const stuck = submissions.find(
      (s) => formatAge(s.created_at).hours > 24 && s.progress_status === "new"
    );
    if (stuck) {
      return {
        kind: "sla" as const,
        title: `${stuck.name || "A lead"} — no contact for ${formatAge(stuck.created_at).label}`,
        subtitle: `SLA breached · ${stuck.vehicle_year || ""} ${stuck.vehicle_make || ""} ${stuck.vehicle_model || ""}`,
        action: "Call now",
        sub: stuck,
        tone: "red" as StatusTone,
      };
    }
    return null;
  }, [submissions, bannerDismissed]);

  const showingTotal = chip === "all" ? total : filtered.length;
  const totalPages = Math.max(1, Math.ceil(showingTotal / pageSize));
  const currentPage = chip === "all" ? page + 1 : 1;

  // For non-"all" chips we paginate locally; for "all" we use the
  // server-side pagination already provided by the parent.
  const rows = chip === "all" ? submissions : filtered.slice(0, pageSize);

  return (
    <div className="space-y-4">
      {/* ── Header ─────────────────────────────────────────── */}
      <div className="flex items-end justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-[22px] font-bold tracking-tight text-foreground">All leads</h1>
          <p className="text-[12px] text-muted-foreground">
            {total.toLocaleString()} total
            {counts.hot > 0 && <> · <span className="text-red-600 dark:text-red-400 font-semibold">{counts.hot} hot</span></>}
            {counts.new > 0 && <> · {counts.new} new</>}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
            <Input
              value={search}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder="Search name, VIN, plate…"
              className="h-9 pl-9 pr-3 text-[13px] w-64"
            />
          </div>
          <Button variant="outline" size="sm" className="h-9">
            <Filter className="w-3.5 h-3.5 mr-1.5" /> Filter
          </Button>
          {onCreate && (
            <Button size="sm" className="h-9" onClick={onCreate}>
              <Plus className="w-3.5 h-3.5 mr-1.5" /> New lead
            </Button>
          )}
        </div>
      </div>

      {/* ── Alert banner ───────────────────────────────────── */}
      {banner && (
        <div
          className={cn(
            "rounded-lg border px-4 py-2.5 flex items-center justify-between gap-3",
            banner.tone === "red"
              ? "bg-red-500/5 border-red-500/30"
              : "bg-orange-500/5 border-orange-500/30"
          )}
        >
          <div className="flex items-center gap-3 min-w-0">
            <span
              className={cn(
                "w-8 h-8 rounded-full flex items-center justify-center shrink-0",
                banner.tone === "red" ? "bg-red-500/15" : "bg-orange-500/15"
              )}
            >
              <AlertTriangle
                className={cn(
                  "w-4 h-4",
                  banner.tone === "red" ? "text-red-600 dark:text-red-400" : "text-orange-600 dark:text-orange-400"
                )}
              />
            </span>
            <div className="min-w-0">
              <div className="text-[13px] font-semibold text-foreground truncate">{banner.title}</div>
              <div className="text-[11.5px] text-muted-foreground truncate">{banner.subtitle}</div>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {banner.kind === "arrived" && (banner.moreCount ?? 0) > 0 && (
              <Button
                size="sm"
                variant="outline"
                className="h-8 border-red-500/40 text-red-700 dark:text-red-300 hover:bg-red-500/10"
                onClick={() => setChip("arrived")}
              >
                +{banner.moreCount} more
              </Button>
            )}
            <Button
              size="sm"
              className={cn(
                "h-8",
                banner.tone === "red" ? "bg-red-500 hover:bg-red-500/90 text-white" : ""
              )}
              onClick={() => onView(banner.sub)}
            >
              <ArrowRight className="w-3.5 h-3.5 mr-1" />
              {banner.action}
            </Button>
            <Button
              size="icon"
              variant="ghost"
              className="h-8 w-8"
              onClick={() => setBannerDismissed(true)}
              aria-label="Dismiss"
            >
              <X className="w-4 h-4" />
            </Button>
          </div>
        </div>
      )}

      {/* ── Quick filter chips ─────────────────────────────── */}
      <div className="flex items-center gap-1.5 flex-wrap">
        {(
          [
            { k: "all" as ChipKey, label: "All", n: counts.all },
            // Arrived chip is conditionally inserted just-after All so
            // it sits closest to the eye when it matters. Suppressed
            // entirely at zero to avoid showing a perpetual "Arrived · 0"
            // chip on quiet days.
            ...(counts.arrived > 0
              ? [{ k: "arrived" as ChipKey, label: "Arrived", n: counts.arrived }]
              : []),
            { k: "new" as ChipKey, label: "New", n: counts.new },
            { k: "hot" as ChipKey, label: "Hot", n: counts.hot },
            { k: "today" as ChipKey, label: "Today", n: counts.today },
            { k: "appointments" as ChipKey, label: "Appointments", n: counts.appts },
            { k: "accepted" as ChipKey, label: "Accepted", n: counts.accepted },
            { k: "stuck" as ChipKey, label: "Stuck > 24h", n: counts.stuck },
          ] as { k: ChipKey; label: string; n: number }[]
        ).map((c) => {
          const active = chip === c.k;
          const isArrived = c.k === "arrived";
          return (
            <button
              key={c.k}
              type="button"
              onClick={() => setChip(c.k)}
              className={cn(
                "h-7 px-2.5 rounded-full text-[12px] font-semibold border transition-colors",
                active
                  ? "bg-foreground text-background border-foreground"
                  : isArrived
                  ? "bg-red-500/10 text-red-700 dark:text-red-300 border-red-500/30 hover:bg-red-500/15"
                  : "bg-card text-foreground/80 border-border hover:bg-muted"
              )}
            >
              {c.label} · {c.n}
            </button>
          );
        })}
      </div>

      {/* ── Table ──────────────────────────────────────────── */}
      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-[13px]">
            <thead>
              <tr className="bg-muted/40 border-b border-border text-[10.5px] font-bold uppercase tracking-wider text-muted-foreground">
                <th className="text-left px-4 py-2">Customer · Vehicle</th>
                <th className="text-left px-4 py-2">Status</th>
                <th className="text-right px-4 py-2">Offer</th>
                <th className="text-right px-4 py-2">Age</th>
                <th className="text-right px-4 py-2">Score</th>
                <th className="text-right px-4 py-2 w-[180px]">Next</th>
              </tr>
            </thead>
            <tbody>
              {loading && rows.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-12 text-center text-muted-foreground text-sm">
                    Loading leads…
                  </td>
                </tr>
              ) : rows.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-12 text-center text-muted-foreground text-sm">
                    No leads match this view.
                  </td>
                </tr>
              ) : (
                rows.map((s) => {
                  const action = nextActionForLead(s);
                  const ActIcon = action.icon ? actionIconMap[action.icon] : null;
                  const variantCls = actionVariantClasses[action.variant] || actionVariantClasses.ghost;
                  const score = scoreFor(s);
                  const offer = s.offered_price ?? null;
                  const est = s.estimated_offer_high ?? null;
                  // Hard arrival = customer tapped "I'm here". Soft
                  // arrival = appointment is today via legacy
                  // appointment_set + appointment_date. Hard wins.
                  const isHardArrived = s.progress_status === "arrived";
                  const isArrived =
                    isHardArrived ||
                    (isAcceptedWithAppointment(s) &&
                      !!s.appointment_date &&
                      s.appointment_date.startsWith(new Date().toISOString().slice(0, 10)));

                  return (
                    <tr
                      key={s.id}
                      onClick={() => onView(s)}
                      className={cn(
                        "border-b border-border/60 last:border-b-0 cursor-pointer transition-colors",
                        isHardArrived
                          ? "bg-red-500/10 hover:bg-red-500/15 border-l-4 border-l-red-500"
                          : isArrived
                          ? "bg-red-500/5 hover:bg-red-500/10"
                          : "hover:bg-muted/40"
                      )}
                    >
                      <td className="px-4 py-2">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center text-[11px] font-semibold text-foreground shrink-0">
                            {initialsFor(s.name)}
                          </div>
                          <div className="min-w-0">
                            <div className="font-semibold text-foreground truncate">
                              {s.name || "Unknown"}
                            </div>
                            <div className="text-[11.5px] text-muted-foreground truncate">
                              {[s.vehicle_year, s.vehicle_make, s.vehicle_model]
                                .filter(Boolean)
                                .join(" ") || "—"}
                              {s.mileage ? ` · ${Number(s.mileage).toLocaleString()} mi` : ""}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-2">
                        <StatusPill s={s} />
                      </td>
                      <td className="px-4 py-2 text-right font-mono">
                        {offer ? (
                          <span className="font-semibold text-foreground">${offer.toLocaleString()}</span>
                        ) : est ? (
                          <span className="text-muted-foreground">~${est.toLocaleString()}</span>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </td>
                      <td className="px-4 py-2 text-right font-mono text-[12px] text-muted-foreground">
                        {formatAge(s.created_at).label}
                      </td>
                      <td className="px-4 py-2 text-right">
                        {score != null ? (
                          <span
                            className={cn(
                              "inline-flex items-center justify-center min-w-[28px] h-5 px-1.5 rounded-full text-[11px] font-semibold border",
                              score >= 80
                                ? "bg-red-500/10 text-red-700 dark:text-red-300 border-red-500/20"
                                : score >= 65
                                ? "bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/20"
                                : "bg-muted text-muted-foreground border-border"
                            )}
                          >
                            {score}
                          </span>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </td>
                      <td className="px-4 py-2 text-right">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            if (action.href) {
                              window.location.href = action.href;
                            } else {
                              onView(s);
                            }
                          }}
                          className={cn(
                            "inline-flex items-center gap-1.5 h-7 px-2.5 rounded-md text-[12px] font-semibold transition-colors",
                            variantCls
                          )}
                        >
                          {ActIcon && <ActIcon className="w-3.5 h-3.5" />}
                          {action.label}
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Pagination ─────────────────────────────────────── */}
      <div className="flex items-center justify-between text-[11.5px] text-muted-foreground">
        <div>
          {chip === "all"
            ? `Showing ${rows.length} of ${total.toLocaleString()} leads`
            : `Showing ${rows.length} of ${filtered.length} filtered`}
        </div>
        {chip === "all" && (
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              className="h-7"
              disabled={page === 0}
              onClick={() => onPageChange(Math.max(0, page - 1))}
            >
              <ChevronLeft className="w-3.5 h-3.5" /> Prev
            </Button>
            <span className="text-foreground/70">
              Page {currentPage} of {totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              className="h-7"
              disabled={currentPage >= totalPages}
              onClick={() => onPageChange(page + 1)}
            >
              Next <ChevronRight className="w-3.5 h-3.5" />
            </Button>
          </div>
        )}
      </div>
    </div>
  );
};

export default AllLeadsPage;
