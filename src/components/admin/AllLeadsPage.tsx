/**
 * AllLeadsPage — dense lead-management table matching the approved
 * "All leads" design (Admin Refresh).
 *
 * Layout, top → bottom:
 *   1. Header: "All leads" + "{total} total · {N} need action"
 *      with Search / Filter / New lead controls right-aligned
 *   2. Live alert banner (arrived → red, hot/SLA → amber). Shows
 *      "+N more" pill when multiple urgent leads exist; dismissible.
 *   3. Quick-filter chip rail (All / New / Hot / Appointments /
 *      Accepted / Stuck > 24h)
 *   4. Lead table — Customer · Vehicle / Status / Offer / Age /
 *      Score / Eye icon / Next-action button
 *   5. "Showing N of M leads" footer with Prev / Next pagination
 *
 * SubmissionsTable.tsx is kept as the legacy classic fallback wired
 * via the `submissions-classic` activeSection key.
 */
import { useMemo, useState } from "react";
import {
  Search, Filter, Plus, X, Phone as PhoneIcon, DollarSign, Calendar,
  Eye, ArrowRight, CheckCircle2, ChevronLeft, ChevronRight,
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
import { cn } from "@/lib/utils";
import { clickToDial } from "@/lib/clickToDial";

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

type ChipKey = "all" | "new" | "hot" | "appointments" | "accepted" | "stuck";

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

const needsAction = (s: Submission): boolean => {
  if (["purchase_complete", "check_request_submitted", "dead_lead", "partial"].includes(s.progress_status)) return false;
  // Hot or arrived — always needs action
  if (s.is_hot_lead) return true;
  if (s.progress_status === "customer_arrived" || s.progress_status === "on_the_way") return true;
  // Inspected → needs an offer
  if (s.progress_status === "inspection_completed" || s.progress_status === "appraisal_completed") return true;
  // Accepted-no-appt → needs to book
  if (isAcceptedWithoutAppointment(s)) return true;
  // SLA breach: new with no offer >24h
  const ageH = formatAge(s.created_at).hours;
  if (s.progress_status === "new" && ageH > 24) return true;
  return false;
};

// ── Status pill ────────────────────────────────────────────────
type StatusTone = "red" | "orange" | "green" | "purple" | "gray" | "blue" | "yellow";

const statusMeta = (
  s: Submission,
): { label: string; tone: StatusTone; pulse?: boolean } => {
  // Live arrival states win over everything
  if (s.progress_status === "customer_arrived") return { label: "Arrived", tone: "red", pulse: true };
  if (s.progress_status === "on_the_way") return { label: "On the way", tone: "orange" };

  if (s.is_hot_lead && !isAcceptedWithAppointment(s)) return { label: "Hot lead", tone: "red", pulse: true };
  if (isAcceptedWithoutAppointment(s)) return { label: "Offer accepted", tone: "green" };
  if (isAcceptedWithAppointment(s)) return { label: "Inspection", tone: "purple" };

  switch (s.progress_status) {
    case "new": return { label: "New", tone: "gray" };
    case "contacted": return { label: "Contacted", tone: "blue" };
    case "no_contact": return { label: "Follow-up", tone: "yellow" };
    case "inspection_scheduled":
    case "inspection_completed":
    case "appraisal_completed":
      return { label: "Inspected", tone: "blue" };
    case "manager_approval_inspection": return { label: "MAI", tone: "orange" };
    case "offer_accepted":
    case "price_agreed": return { label: "Offer accepted", tone: "green" };
    case "deal_finalized": return { label: "Deal", tone: "green" };
    case "title_ownership_verified": return { label: "Title verified", tone: "green" };
    case "check_request_submitted":
    case "purchase_complete": return { label: "Purchased", tone: "gray" };
    case "dead_lead": return { label: "Wholesale", tone: "gray" };
    case "partial": return { label: "Abandoned", tone: "gray" };
    default:
      if (isOfferPendingSubmission(s)) return { label: "Offer pending", tone: "orange" };
      return { label: s.progress_status || "—", tone: "gray" };
  }
};

const pillCls: Record<StatusTone, string> = {
  red: "text-red-600",
  orange: "text-orange-600",
  green: "text-emerald-600",
  blue: "text-blue-600",
  purple: "text-violet-600",
  yellow: "text-amber-600",
  gray: "text-muted-foreground",
};

const dotCls: Record<StatusTone, string> = {
  red: "bg-red-500",
  orange: "bg-orange-500",
  green: "bg-emerald-500",
  blue: "bg-blue-500",
  purple: "bg-violet-500",
  yellow: "bg-amber-500",
  gray: "bg-muted-foreground/50",
};

const StatusPill = ({ s }: { s: Submission }) => {
  const m = statusMeta(s);
  return (
    <span className={cn("inline-flex items-center gap-1.5 text-[12px] font-semibold", pillCls[m.tone])}>
      <span className={cn("w-1.5 h-1.5 rounded-full", dotCls[m.tone], m.pulse && "animate-pulse")} />
      {m.label}
    </span>
  );
};

// ── Action button derivation ─────────────────────────────────
type ActionButton = {
  label: string;
  icon: React.ComponentType<{ className?: string }> | null;
  cls: string; // tailwind class chain for the button background+text
  onClick: (s: Submission, openFile: () => void) => void;
};

const actionForLead = (s: Submission): ActionButton => {
  if (s.progress_status === "customer_arrived") {
    return {
      label: "Greet now",
      icon: ArrowRight,
      cls: "bg-red-600 hover:bg-red-700 text-white",
      onClick: (_s, openFile) => openFile(),
    };
  }
  if (s.progress_status === "on_the_way") {
    return {
      label: "Prep file",
      icon: ArrowRight,
      cls: "bg-slate-900 hover:bg-slate-800 text-white",
      onClick: (_s, openFile) => openFile(),
    };
  }
  if (isAcceptedWithoutAppointment(s)) {
    return {
      label: "Book appt",
      icon: Calendar,
      cls: "bg-slate-900 hover:bg-slate-800 text-white",
      onClick: (_s, openFile) => openFile(),
    };
  }
  if (s.progress_status === "inspection_completed" || s.progress_status === "appraisal_completed") {
    return {
      label: "Make offer",
      icon: DollarSign,
      cls: "bg-blue-600 hover:bg-blue-700 text-white",
      onClick: (_s, openFile) => openFile(),
    };
  }
  if (s.progress_status === "contacted") {
    return {
      label: "Follow up",
      icon: PhoneIcon,
      cls: "bg-background border hover:bg-muted/60 text-foreground",
      onClick: (sub) => {
        if (sub.phone) clickToDial(sub.id);
      },
    };
  }
  if (s.progress_status === "manager_approval_inspection") {
    return {
      label: "Approve",
      icon: CheckCircle2,
      cls: "bg-slate-900 hover:bg-slate-800 text-white",
      onClick: (_s, openFile) => openFile(),
    };
  }
  // New / fallback → call
  return {
    label: "Call",
    icon: PhoneIcon,
    cls: "bg-slate-900 hover:bg-slate-800 text-white",
    onClick: (sub) => {
      if (sub.phone) clickToDial(sub.id);
    },
  };
};

// ── Main component ─────────────────────────────────────────────
const AllLeadsPage = ({
  submissions, loading, search, onSearchChange, page, total, pageSize = PAGE_SIZE, onPageChange, onView, onCreate,
}: AllLeadsPageProps) => {
  const [chip, setChip] = useState<ChipKey>("all");
  const [bannerDismissed, setBannerDismissed] = useState(false);

  // ── Counts for chips + subtitle ──
  const counts = useMemo(() => {
    let newCount = 0;
    let hot = 0;
    let appts = 0;
    let accepted = 0;
    let stuck = 0;
    let needAction = 0;

    for (const s of submissions) {
      if (s.progress_status === "new") newCount++;
      if (s.is_hot_lead) hot++;
      if (isAcceptedWithAppointment(s)) appts++;
      if (isAcceptedWithoutAppointment(s)) accepted++;
      const age = formatAge(s.created_at).hours;
      if (age > 24 && !isAcceptedWithAppointment(s) && s.progress_status !== "purchase_complete") stuck++;
      if (needsAction(s)) needAction++;
    }
    return { all: submissions.length, new: newCount, hot, appts, accepted, stuck, needAction };
  }, [submissions]);

  // ── Live banner: arrived/on-the-way leads ──
  const liveLeads = useMemo(() => {
    return submissions.filter(
      (s) => s.progress_status === "customer_arrived" || s.progress_status === "on_the_way",
    );
  }, [submissions]);

  const banner = !bannerDismissed && liveLeads.length > 0 ? liveLeads[0] : null;

  // ── Chip-filtered rows ──
  const filtered = useMemo(() => {
    return submissions.filter((s) => {
      switch (chip) {
        case "new": return s.progress_status === "new";
        case "hot": return s.is_hot_lead;
        case "appointments": return isAcceptedWithAppointment(s);
        case "accepted": return isAcceptedWithoutAppointment(s);
        case "stuck":
          return formatAge(s.created_at).hours > 24
            && !isAcceptedWithAppointment(s)
            && s.progress_status !== "purchase_complete";
        default: return true;
      }
    });
  }, [submissions, chip]);

  const showingTotal = chip === "all" ? total : filtered.length;
  const totalPages = Math.max(1, Math.ceil(showingTotal / pageSize));
  const currentPage = chip === "all" ? page + 1 : 1;
  const rows = chip === "all" ? submissions : filtered.slice(0, pageSize);

  const chips: { k: ChipKey; label: string; n: number }[] = [
    { k: "all", label: "All", n: counts.all },
    { k: "new", label: "New", n: counts.new },
    { k: "hot", label: "Hot", n: counts.hot },
    { k: "appointments", label: "Appointments", n: counts.appts },
    { k: "accepted", label: "Accepted", n: counts.accepted },
    { k: "stuck", label: "Stuck > 24h", n: counts.stuck },
  ];

  return (
    <div className="space-y-5 max-w-6xl">
      {/* Header */}
      <header className="flex items-end justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">All leads</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {total.toLocaleString()} total · {counts.needAction} need action
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
            <Input
              value={search}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder="Search"
              className="h-10 pl-9 pr-3 text-sm w-64 rounded-md"
            />
          </div>
          <Button variant="outline" className="h-10 rounded-md">
            <Filter className="w-4 h-4 mr-1.5" /> Filter
          </Button>
          <Button
            className="h-10 rounded-md bg-slate-900 hover:bg-slate-800 text-white"
            onClick={onCreate}
          >
            <Plus className="w-4 h-4 mr-1.5" /> New lead
          </Button>
        </div>
      </header>

      {/* Live arrival banner */}
      {banner && (() => {
        const isArrived = banner.progress_status === "customer_arrived";
        const ymm = [banner.vehicle_year, banner.vehicle_make, banner.vehicle_model].filter(Boolean).join(" ") || "Vehicle";
        const apptStr = banner.appointment_date ? `${banner.appointment_date} appointment` : "today";
        const moreCount = liveLeads.length - 1;
        return (
          <div
            className={cn(
              "rounded-lg border-l-4 px-4 py-3 flex items-center justify-between gap-3",
              isArrived ? "bg-red-50 border-l-red-500" : "bg-orange-50 border-l-orange-500",
            )}
          >
            <div className="flex items-center gap-3 min-w-0">
              <span className={cn("w-2 h-2 rounded-full shrink-0 animate-pulse", isArrived ? "bg-red-500" : "bg-orange-500")} />
              <div className="min-w-0">
                <div className="text-sm font-bold text-foreground truncate">
                  {banner.name || "A customer"} {isArrived ? "just arrived on the lot" : "is on the way"}
                </div>
                <div className="text-xs text-muted-foreground truncate">
                  {ymm} · {apptStr} · Go greet now
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              {moreCount > 0 && (
                <span className="text-xs font-semibold rounded-full bg-background border px-2.5 py-1">
                  +{moreCount} more
                </span>
              )}
              <Button
                className={cn(
                  "h-9 px-3.5 rounded-md font-bold",
                  isArrived
                    ? "bg-red-600 hover:bg-red-700 text-white"
                    : "bg-slate-900 hover:bg-slate-800 text-white",
                )}
                onClick={() => onView(banner)}
              >
                {isArrived ? "Greet now" : "Prep file"}
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-9 w-9 rounded-md"
                onClick={() => setBannerDismissed(true)}
                aria-label="Dismiss"
              >
                <X className="w-4 h-4" />
              </Button>
            </div>
          </div>
        );
      })()}

      {/* Filter chips */}
      <div className="flex items-center gap-2 flex-wrap">
        {chips.map((c) => {
          const active = chip === c.k;
          return (
            <button
              key={c.k}
              type="button"
              onClick={() => setChip(c.k)}
              className={cn(
                "h-8 px-3 rounded-full text-xs font-semibold transition-colors",
                active
                  ? "bg-muted text-foreground"
                  : "text-muted-foreground hover:bg-muted/60",
              )}
            >
              {c.label} · {c.n}
            </button>
          );
        })}
      </div>

      {/* Table */}
      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gradient-to-b from-muted/50 to-muted/20 border-b border-border text-[10.5px] font-bold uppercase tracking-[0.1em] text-muted-foreground">
                <th className="text-left px-4 py-3">Customer & Vehicle</th>
                <th className="text-left px-4 py-3">Status</th>
                <th className="text-right px-4 py-3">Offer</th>
                <th className="text-right px-4 py-3">Age</th>
                <th className="text-right px-4 py-3">Score</th>
                <th className="text-right px-4 py-3 w-10"> </th>
                <th className="text-right px-4 py-3 w-[150px]">Next</th>
              </tr>
            </thead>
            <tbody>
              {loading && rows.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center text-muted-foreground text-sm">
                    Loading leads…
                  </td>
                </tr>
              ) : rows.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center text-muted-foreground text-sm">
                    No leads match this view.
                  </td>
                </tr>
              ) : (
                rows.map((s) => {
                  const action = actionForLead(s);
                  const ActIcon = action.icon;
                  const score = scoreFor(s);
                  const offer = s.offered_price ?? null;
                  const est = s.estimated_offer_high ?? null;
                  const isArrived = s.progress_status === "customer_arrived";
                  return (
                    <tr
                      key={s.id}
                      className={cn(
                        "border-b border-border/50 last:border-b-0 transition-colors",
                        isArrived
                          ? "bg-red-50 hover:bg-red-100/70 border-l-4 border-l-red-500"
                          : "hover:bg-muted/40",
                      )}
                    >
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-full bg-muted flex items-center justify-center text-xs font-bold text-foreground shrink-0">
                            {initialsFor(s.name)}
                          </div>
                          <div className="min-w-0">
                            <div className="font-bold text-foreground truncate">{s.name || "Unknown"}</div>
                            <div className="text-xs text-muted-foreground truncate">
                              {[s.vehicle_year, s.vehicle_make, s.vehicle_model].filter(Boolean).join(" ") || "—"}
                              {s.mileage ? ` · ${Number(s.mileage).toLocaleString()} mi` : ""}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <StatusPill s={s} />
                      </td>
                      <td className="px-4 py-3 text-right">
                        {offer ? (
                          <span className="font-bold text-foreground">${offer.toLocaleString()}</span>
                        ) : est ? (
                          <span className="text-muted-foreground">~${est.toLocaleString()}</span>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right text-sm text-muted-foreground tabular-nums">
                        {formatAge(s.created_at).label}
                      </td>
                      <td className="px-4 py-3 text-right">
                        {score != null ? (
                          <span className="inline-flex items-center justify-center min-w-[32px] h-6 px-1.5 rounded-full bg-muted text-foreground text-xs font-semibold">
                            {score}
                          </span>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button
                          type="button"
                          onClick={() => onView(s)}
                          className="w-8 h-8 inline-flex items-center justify-center rounded-md hover:bg-muted/60 text-muted-foreground"
                          aria-label="Open customer file"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button
                          type="button"
                          onClick={() => action.onClick(s, () => onView(s))}
                          className={cn(
                            "inline-flex items-center gap-1.5 h-8 px-3 rounded-md text-xs font-bold transition-colors",
                            action.cls,
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

      {/* Footer */}
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <div>
          Showing {rows.length} of {chip === "all" ? total.toLocaleString() : filtered.length} {chip === "all" ? "leads" : "filtered"}
        </div>
        {chip === "all" && (
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              className="h-8 rounded-md"
              disabled={page === 0}
              onClick={() => onPageChange(Math.max(0, page - 1))}
            >
              <ChevronLeft className="w-3.5 h-3.5 mr-1" /> Previous
            </Button>
            <span className="text-foreground/70 px-2">
              Page {currentPage} of {totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              className="h-8 rounded-md"
              disabled={currentPage >= totalPages}
              onClick={() => onPageChange(page + 1)}
            >
              Next <ChevronRight className="w-3.5 h-3.5 ml-1" />
            </Button>
          </div>
        )}
      </div>
    </div>
  );
};

export default AllLeadsPage;
