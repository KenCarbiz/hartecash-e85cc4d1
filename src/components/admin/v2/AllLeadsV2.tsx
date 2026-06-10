/**
 * All Leads (Admin V2) — native-V2 leads list.
 *
 * Reuses the existing data plumbing entirely (db.submissions, db.total,
 * db.page/setPage, db.handleView from useAdminDashboard) and just renders
 * it in the V2 design system: PageShell header, KPI strip, quick-filter
 * chips, a clean card-table, and click-through to the shared customer
 * file (AdminOverlays). V1's AllLeadsPage/SubmissionsTable is untouched —
 * this is V2-only, intercepted in AdminDashboardV2.
 */
import { useMemo, useState } from "react";
import {
  Search, Inbox, Flame, CheckCircle2, DollarSign, ChevronLeft, ChevronRight, Car,
} from "lucide-react";
import type { useAdminDashboard } from "@/hooks/useAdminDashboard";
import {
  getStatusLabel, PAGE_SIZE, ACCEPTED_NO_APPOINTMENT_STATUSES,
  ACCEPTED_WITH_APPOINTMENT_STATUSES, type Submission,
} from "@/lib/adminConstants";
import { cn } from "@/lib/utils";
import { PageShell, Card, Pill, StatCard, Loading } from "./theme";

type Db = ReturnType<typeof useAdminDashboard>;

const ACCEPTED = new Set<string>([...ACCEPTED_NO_APPOINTMENT_STATUSES, ...ACCEPTED_WITH_APPOINTMENT_STATUSES]);
const WITH_APPT = new Set<string>(ACCEPTED_WITH_APPOINTMENT_STATUSES);
const CLOSED = new Set<string>(["purchase_complete", "check_request_submitted"]);

const SOURCE_LABEL: Record<string, string> = {
  trade: "Trade-In", in_store_trade: "In-Store Trade", inventory: "Sell", service: "Service",
};
const sourceLabel = (s: string | null) => (s ? SOURCE_LABEL[s] || s.replace(/_/g, " ") : "—");
const money = (n: number) => (n >= 1000 ? `$${(n / 1000).toFixed(n >= 10000 ? 0 : 1)}k` : `$${n}`);
const isAccepted = (s: Submission) => !!s.offered_price || ACCEPTED.has(s.progress_status);
const isToday = (iso: string) => { const d = new Date(iso), n = new Date(); return d.toDateString() === n.toDateString(); };
const relAge = (iso: string) => {
  const h = Math.floor((Date.now() - new Date(iso).getTime()) / 3.6e6);
  if (h < 1) return "just now";
  if (h < 24) return `${h}h`;
  return `${Math.floor(h / 24)}d`;
};

type Chip = "all" | "new" | "hot" | "appts" | "accepted" | "dead";
const CHIPS: { key: Chip; label: string }[] = [
  { key: "all", label: "All" },
  { key: "new", label: "New" },
  { key: "hot", label: "Hot" },
  { key: "appts", label: "Appointments" },
  { key: "accepted", label: "Accepted" },
  { key: "dead", label: "Dead" },
];

const initials = (n: string | null) => (n || "?").split(" ").map((p) => p.charAt(0)).slice(0, 2).join("").toUpperCase();

const AllLeadsV2 = ({ db }: { db: Db }) => {
  const [chip, setChip] = useState<Chip>("all");
  const [q, setQ] = useState("");
  const subs = db.submissions;

  const matchChip = (s: Submission): boolean => {
    switch (chip) {
      case "new": return s.progress_status === "new";
      case "hot": return s.is_hot_lead;
      case "appts": return s.appointment_set || WITH_APPT.has(s.progress_status);
      case "accepted": return isAccepted(s) && !CLOSED.has(s.progress_status) && s.progress_status !== "dead_lead";
      case "dead": return s.progress_status === "dead_lead";
      default: return true;
    }
  };

  const rows = useMemo(() => {
    const query = q.trim().toLowerCase();
    return subs.filter((s) => {
      if (!matchChip(s)) return false;
      if (!query) return true;
      const hay = [s.name, s.email, s.phone, s.vin, s.vehicle_year, s.vehicle_make, s.vehicle_model].filter(Boolean).join(" ").toLowerCase();
      return hay.includes(query);
    });
    // matchChip is a pure helper closing over `chip` (already a dep).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [subs, chip, q]);

  const kpis = useMemo(() => {
    const accepted = subs.filter((s) => isAccepted(s) && !CLOSED.has(s.progress_status) && s.progress_status !== "dead_lead");
    return {
      newToday: subs.filter((s) => isToday(s.created_at)).length,
      accepted: accepted.length,
      pipeline: accepted.reduce((sum, s) => sum + (s.offered_price || 0), 0),
    };
  }, [subs]);

  const totalPages = Math.max(1, Math.ceil(db.total / PAGE_SIZE));
  const page = db.page + 1;

  return (
    <PageShell
      title="All Leads"
      subtitle="Every submission across your store — newest first."
      actions={
        <div className="flex items-center gap-2 rounded-xl border border-[#E6EAF0] bg-white px-3 py-2">
          <span className="text-[12px] text-[#7A879C]">Total</span>
          <span className="text-[14px] font-bold text-[#06194A]">{db.total.toLocaleString()}</span>
        </div>
      }
    >
      <div className="space-y-4">
        {/* KPIs */}
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <StatCard label="Total Leads" value={db.total.toLocaleString()} icon={<Inbox className="h-5 w-5" />} tone="purple" />
          <StatCard label="New Today" value={kpis.newToday} icon={<Flame className="h-5 w-5" />} tone="amber" />
          <StatCard label="Accepted" value={kpis.accepted} icon={<CheckCircle2 className="h-5 w-5" />} tone="green" />
          <StatCard label="Pipeline" value={money(kpis.pipeline)} hint="Offered on accepted" icon={<DollarSign className="h-5 w-5" />} tone="teal" />
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative w-full sm:min-w-[200px] sm:flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#9AA6BC]" />
            <input
              value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search name, phone, VIN, vehicle…"
              className="w-full rounded-xl border border-[#E6EAF0] bg-white py-2 pl-9 pr-3 text-[13px] text-[#06194A] outline-none focus:border-[#6D28D9]/40"
            />
          </div>
          {CHIPS.map((c) => (
            <button key={c.key} onClick={() => setChip(c.key)} className={cn("rounded-lg px-3 py-1.5 text-[12px] font-semibold transition", chip === c.key ? "bg-[#6D28D9] text-white" : "border border-[#E6EAF0] bg-white text-[#53627A] hover:text-[#6D28D9]")}>
              {c.label}
            </button>
          ))}
        </div>

        {/* Table */}
        <Card className="overflow-hidden">
          <div className="hidden grid-cols-[2fr_1fr_1fr_0.8fr_0.6fr] gap-3 border-b border-[#E6EAF0] bg-[#FAFBFD] px-5 py-2.5 text-[10px] font-bold uppercase tracking-wider text-[#9AA6BC] lg:grid">
            <span>Customer &amp; vehicle</span><span>Status</span><span>Source</span><span className="text-right">Offer</span><span className="text-right">Age</span>
          </div>
          {db.loading ? (
            <Loading label="Loading leads…" className="px-5" />
          ) : rows.length === 0 ? (
            <div className="px-5 py-10 text-center text-sm text-[#7A879C]">No leads match this view.</div>
          ) : (
            <div className="divide-y divide-[#E6EAF0]">
              {rows.map((s) => {
                const vehicle = [s.vehicle_year, s.vehicle_make, s.vehicle_model].filter(Boolean).join(" ");
                const offer = s.offered_price || s.estimated_offer_high;
                const closed = CLOSED.has(s.progress_status);
                const dead = s.progress_status === "dead_lead";
                return (
                  <button key={s.id} onClick={() => db.handleView(s)} className="grid w-full grid-cols-1 gap-3 px-5 py-3 text-left transition hover:bg-[#F8FAFC] lg:grid-cols-[2fr_1fr_1fr_0.8fr_0.6fr] lg:items-center">
                    <div className="flex items-center gap-3">
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#6D28D9] text-[12px] font-bold text-white">{initials(s.name)}</span>
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5 truncate text-[13px] font-semibold text-[#06194A]">{s.name || "Unknown"}{s.is_hot_lead && <Flame className="h-3.5 w-3.5 text-[#B45309]" />}</div>
                        <div className="flex items-center gap-1 truncate text-[12px] text-[#7A879C]"><Car className="h-3 w-3" />{vehicle || "Vehicle pending"}</div>
                      </div>
                    </div>
                    <div><Pill tone={closed ? "green" : dead ? "red" : isAccepted(s) ? "teal" : "purple"}>{getStatusLabel(s.progress_status)}</Pill></div>
                    <div className="text-[12px] text-[#53627A]">{sourceLabel(s.lead_source)}</div>
                    <div className="text-[13px] font-semibold text-[#0F7A3E] lg:text-right">{offer ? money(offer) : "—"}</div>
                    <div className="text-[12px] text-[#9AA6BC] lg:text-right">{relAge(s.created_at)}</div>
                  </button>
                );
              })}
            </div>
          )}

          {/* Pagination */}
          <div className="flex flex-col gap-2 border-t border-[#E6EAF0] px-5 py-3 sm:flex-row sm:items-center sm:justify-between">
            <span className="text-[12px] text-[#7A879C]">{rows.length} shown · page {page} of {totalPages} · {db.total.toLocaleString()} total</span>
            <div className="flex items-center gap-2">
              <button onClick={() => db.setPage(Math.max(0, db.page - 1))} disabled={db.page === 0} className="inline-flex items-center gap-1 rounded-lg border border-[#E6EAF0] px-2.5 py-1.5 text-[12px] font-semibold text-[#53627A] disabled:opacity-40 hover:text-[#6D28D9]"><ChevronLeft className="h-3.5 w-3.5" /> Prev</button>
              <button onClick={() => db.setPage(db.page + 1)} disabled={page >= totalPages} className="inline-flex items-center gap-1 rounded-lg border border-[#E6EAF0] px-2.5 py-1.5 text-[12px] font-semibold text-[#53627A] disabled:opacity-40 hover:text-[#6D28D9]">Next <ChevronRight className="h-3.5 w-3.5" /></button>
            </div>
          </div>
        </Card>
      </div>
    </PageShell>
  );
};

export default AllLeadsV2;
