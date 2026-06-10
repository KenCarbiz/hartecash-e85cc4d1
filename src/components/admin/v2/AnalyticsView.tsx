/**
 * V2 Analytics — funnel, source performance, cohort retention, and
 * multi-store comparison, with drill-down into the Leads list.
 *
 * Reads full-book submission rows (useAnalyticsData) and computes
 * everything client-side, consistent with the existing reporting
 * surfaces. Drill-down sets the corresponding Leads filter
 * (status/source/store) and navigates to the Leads section, so the user
 * stays inside the admin shell.
 *
 * Note on "ROI": Autocurb does not track ad spend, so the source table
 * reports *performance* (leads, accepted, conversion, offered revenue),
 * not net ROI. This is labelled inline so the number is never misread.
 */
import { useMemo, useState } from "react";
import { ArrowRight, TrendingDown, Info } from "lucide-react";
import type { useAdminDashboard } from "@/hooks/useAdminDashboard";
import {
  ACCEPTED_NO_APPOINTMENT_STATUSES, ACCEPTED_WITH_APPOINTMENT_STATUSES,
} from "@/lib/adminConstants";
import { PageShell, Card, SectionLabel, Pill } from "./theme";
import { useAnalyticsData, type AnalyticsRow } from "./useAnalyticsData";

type Db = ReturnType<typeof useAdminDashboard>;

const ACCEPTED = new Set<string>([
  ...ACCEPTED_NO_APPOINTMENT_STATUSES,
  ...ACCEPTED_WITH_APPOINTMENT_STATUSES,
]);
const WITH_APPT = new Set<string>(ACCEPTED_WITH_APPOINTMENT_STATUSES);
const CLOSED = new Set<string>(["purchase_complete", "check_request_submitted"]);

const SOURCE_LABELS: Record<string, string> = {
  trade: "Trade-In",
  in_store_trade: "In-Store Trade",
  inventory: "Sell My Car",
  service: "Service Lane",
};
const sourceLabel = (s: string | null) =>
  !s ? "Unknown" : SOURCE_LABELS[s] || s.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

const isAccepted = (r: AnalyticsRow) => !!r.offered_price || ACCEPTED.has(r.progress_status);
const money = (n: number) =>
  n >= 1_000_000 ? `$${(n / 1_000_000).toFixed(1)}M` : n >= 1000 ? `$${(n / 1000).toFixed(n >= 10000 ? 0 : 1)}k` : `$${n}`;
const pct = (num: number, den: number) => (den ? Math.round((num / den) * 100) : 0);

const RANGES = [
  { label: "30 days", days: 30 },
  { label: "90 days", days: 90 },
  { label: "12 months", days: 365 },
  { label: "All time", days: 0 },
];

const AnalyticsView = ({ db, onNavigate }: { db: Db; onNavigate: (key: string) => void }) => {
  const { data, isLoading, isError } = useAnalyticsData(db.tenant.dealership_id, db.userRole, db.userEmail);
  const [rangeDays, setRangeDays] = useState(90);

  const rows = useMemo(() => {
    const all = data?.rows ?? [];
    if (!rangeDays) return all;
    const cutoff = Date.now() - rangeDays * 86_400_000;
    return all.filter((r) => new Date(r.created_at).getTime() >= cutoff);
  }, [data, rangeDays]);

  // ── Funnel (cumulative milestones) ──
  const funnel = useMemo(() => {
    const total = rows.length;
    const accepted = rows.filter(isAccepted).length;
    const appt = rows.filter((r) => WITH_APPT.has(r.progress_status)).length;
    const won = rows.filter((r) => CLOSED.has(r.progress_status)).length;
    return [
      { label: "Leads", n: total },
      { label: "Offer accepted", n: accepted },
      { label: "Appointment+", n: appt },
      { label: "Purchased", n: won },
    ];
  }, [rows]);

  // ── Source performance ──
  const sources = useMemo(() => {
    const map = new Map<string, { key: string; leads: number; accepted: number; revenue: number }>();
    for (const r of rows) {
      const key = r.lead_source || "__unknown__";
      const e = map.get(key) || { key, leads: 0, accepted: 0, revenue: 0 };
      e.leads += 1;
      if (isAccepted(r)) {
        e.accepted += 1;
        e.revenue += r.offered_price || 0;
      }
      map.set(key, e);
    }
    return [...map.values()].sort((a, b) => b.leads - a.leads);
  }, [rows]);

  // ── Cohort retention by intake week (last 8 weeks) ──
  const cohorts = useMemo(() => {
    // Monday-anchored week key.
    const weekStart = (d: Date) => {
      const x = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
      const dow = (x.getUTCDay() + 6) % 7; // Mon=0
      x.setUTCDate(x.getUTCDate() - dow);
      return x;
    };
    const map = new Map<string, { ts: number; leads: number; accepted: number }>();
    for (const r of rows) {
      const ws = weekStart(new Date(r.created_at));
      const key = ws.toISOString().slice(0, 10);
      const e = map.get(key) || { ts: ws.getTime(), leads: 0, accepted: 0 };
      e.leads += 1;
      if (isAccepted(r)) e.accepted += 1;
      map.set(key, e);
    }
    return [...map.entries()]
      .map(([key, v]) => ({ key, ...v }))
      .sort((a, b) => b.ts - a.ts)
      .slice(0, 8)
      .reverse();
  }, [rows]);

  // ── Store comparison ──
  const locName = useMemo(() => {
    const m = new Map<string, string>();
    for (const l of db.dealerLocations) m.set(l.id, l.name);
    return m;
  }, [db.dealerLocations]);

  const stores = useMemo(() => {
    if (db.dealerLocations.length <= 1) return [];
    const map = new Map<string, { key: string; leads: number; accepted: number; revenue: number }>();
    for (const r of rows) {
      const key = r.store_location_id || "__unassigned__";
      const e = map.get(key) || { key, leads: 0, accepted: 0, revenue: 0 };
      e.leads += 1;
      if (isAccepted(r)) {
        e.accepted += 1;
        e.revenue += r.offered_price || 0;
      }
      map.set(key, e);
    }
    return [...map.values()].sort((a, b) => b.leads - a.leads);
  }, [rows, db.dealerLocations.length]);

  const drillSource = (key: string) => {
    db.setStatusFilter("");
    db.setStoreFilter("");
    db.setSourceFilter(key === "__unknown__" ? "" : key);
    onNavigate("submissions");
  };
  const drillStore = (key: string) => {
    db.setStatusFilter("");
    db.setSourceFilter("");
    db.setStoreFilter(key);
    onNavigate("submissions");
  };

  const maxFunnel = funnel[0]?.n || 1;
  const maxCohort = Math.max(1, ...cohorts.map((c) => c.leads));

  return (
    <PageShell
      title="Analytics"
      subtitle="Funnel, source performance, cohort retention and store comparison."
      actions={
        <div className="flex items-center gap-1 rounded-xl border border-[#E6EAF0] bg-white p-1">
          {RANGES.map((r) => (
            <button
              key={r.days}
              type="button"
              onClick={() => setRangeDays(r.days)}
              className={`rounded-lg px-3 py-1.5 text-[12px] font-semibold transition ${
                rangeDays === r.days
                  ? "bg-[#6D28D9] text-white"
                  : "text-[#53627A] hover:bg-[#F4F6FA]"
              }`}
            >
              {r.label}
            </button>
          ))}
        </div>
      }
    >
      {isError ? (
        <Card className="p-8 text-center text-sm text-[#B91C1C]">
          Couldn't load analytics data. Please try again.
        </Card>
      ) : isLoading ? (
        <Card className="p-8 text-center text-sm text-[#7A879C]">Crunching the numbers…</Card>
      ) : rows.length === 0 ? (
        <Card className="p-8 text-center text-sm text-[#7A879C]">
          No leads in this period. Try a wider range.
        </Card>
      ) : (
        <div className="space-y-4">
          {data?.capped && (
            <div className="flex items-center gap-2 rounded-xl border border-[#FEF3E2] bg-[#FFFBF3] px-4 py-2.5 text-[12px] text-[#B45309]">
              <Info className="h-4 w-4 shrink-0" />
              Showing the most recent 8,000 leads — older history is summarised elsewhere.
            </div>
          )}

          {/* Funnel + Cohort */}
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <Card className="p-5">
              <SectionLabel>Conversion funnel</SectionLabel>
              <div className="mt-1 text-[15px] font-semibold text-[#06194A]">
                {funnel[0].n.toLocaleString()} leads → {funnel[3].n.toLocaleString()} purchased
              </div>
              <div className="mt-4 space-y-3">
                {funnel.map((step, i) => {
                  const prev = i > 0 ? funnel[i - 1].n : step.n;
                  const stepConv = i > 0 ? pct(step.n, prev) : 100;
                  return (
                    <div key={step.label}>
                      <div className="flex items-center justify-between text-[12px]">
                        <span className="font-medium text-[#3B4763]">{step.label}</span>
                        <span className="text-[#53627A]">
                          {step.n.toLocaleString()}
                          {i > 0 && (
                            <span className="ml-2 text-[#9AA6BC]">
                              {stepConv}% of prev
                            </span>
                          )}
                        </span>
                      </div>
                      <div className="mt-1 h-2.5 w-full overflow-hidden rounded-full bg-[#F0F2F7]">
                        <div
                          className="h-full rounded-full bg-gradient-to-r from-[#6D28D9] to-[#0D9488]"
                          style={{ width: `${Math.max(pct(step.n, maxFunnel), 2)}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
              <div className="mt-4 flex items-center gap-1.5 text-[12px] text-[#53627A]">
                <TrendingDown className="h-3.5 w-3.5 text-[#B45309]" />
                Lead→purchase: <strong className="text-[#06194A]">{pct(funnel[3].n, funnel[0].n)}%</strong>
              </div>
            </Card>

            <Card className="p-5">
              <SectionLabel>Cohort retention</SectionLabel>
              <div className="mt-1 text-[15px] font-semibold text-[#06194A]">
                Acceptance by intake week
              </div>
              <div className="mt-4 space-y-2.5">
                {cohorts.map((c) => {
                  const accPct = pct(c.accepted, c.leads);
                  return (
                    <div key={c.key} className="flex items-center gap-3">
                      <span className="w-16 shrink-0 text-[11px] text-[#7A879C]">
                        {new Date(`${c.key}T00:00:00Z`).toLocaleDateString(undefined, {
                          month: "short",
                          day: "numeric",
                          timeZone: "UTC",
                        })}
                      </span>
                      <div className="relative h-5 flex-1 overflow-hidden rounded-md bg-[#F0F2F7]">
                        <div
                          className="h-full bg-[#EEF0FF]"
                          style={{ width: `${pct(c.leads, maxCohort)}%` }}
                        />
                        <div
                          className="absolute inset-y-0 left-0 bg-gradient-to-r from-[#6D28D9] to-[#0D9488]"
                          style={{ width: `${pct(c.accepted, maxCohort)}%` }}
                        />
                      </div>
                      <span className="w-24 shrink-0 text-right text-[11px] text-[#53627A]">
                        {c.accepted}/{c.leads} · {accPct}%
                      </span>
                    </div>
                  );
                })}
              </div>
            </Card>
          </div>

          {/* Source performance */}
          <Card className="overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4">
              <div>
                <SectionLabel>Source performance</SectionLabel>
                <div className="mt-1 text-[15px] font-semibold text-[#06194A]">By lead source</div>
              </div>
              <Pill tone="gray">
                <Info className="h-3 w-3" /> Offered revenue — ad spend not tracked
              </Pill>
            </div>
            <SourceStoreTable
              firstCol="Source"
              rows={sources.map((s) => ({
                key: s.key,
                name: sourceLabel(s.key === "__unknown__" ? null : s.key),
                leads: s.leads,
                accepted: s.accepted,
                revenue: s.revenue,
              }))}
              onDrill={drillSource}
            />
          </Card>

          {/* Store comparison */}
          {stores.length > 0 && (
            <Card className="overflow-hidden">
              <div className="px-5 py-4">
                <SectionLabel>Store comparison</SectionLabel>
                <div className="mt-1 text-[15px] font-semibold text-[#06194A]">By rooftop / location</div>
              </div>
              <SourceStoreTable
                firstCol="Store"
                rows={stores.map((s) => ({
                  key: s.key,
                  name: s.key === "__unassigned__" ? "Unassigned" : locName.get(s.key) || "Unknown store",
                  leads: s.leads,
                  accepted: s.accepted,
                  revenue: s.revenue,
                }))}
                onDrill={drillStore}
              />
            </Card>
          )}
        </div>
      )}
    </PageShell>
  );
};

type TableRow = { key: string; name: string; leads: number; accepted: number; revenue: number };

const SourceStoreTable = ({
  firstCol,
  rows,
  onDrill,
}: {
  firstCol: string;
  rows: TableRow[];
  onDrill: (key: string) => void;
}) => (
  <div className="overflow-x-auto border-t border-[#F0F2F7]">
    <div className="min-w-[520px]">
    <div className="grid grid-cols-[1.6fr_repeat(4,1fr)] gap-2 bg-[#FAFBFD] px-5 py-2 text-[10px] font-bold uppercase tracking-wider text-[#9AA6BC]">
      <span>{firstCol}</span>
      <span className="text-right">Leads</span>
      <span className="text-right">Accepted</span>
      <span className="text-right">Conv.</span>
      <span className="text-right">Revenue</span>
    </div>
    <div className="divide-y divide-[#F0F2F7]">
      {rows.map((r) => (
        <button
          key={r.key}
          type="button"
          onClick={() => onDrill(r.key)}
          className="grid w-full grid-cols-[1.6fr_repeat(4,1fr)] items-center gap-2 px-5 py-3 text-left transition hover:bg-[#F8FAFC]"
        >
          <span className="flex items-center gap-1.5 truncate text-[13px] font-semibold text-[#06194A]">
            {r.name}
            <ArrowRight className="h-3 w-3 text-[#C9B8F0]" />
          </span>
          <span className="text-right text-[13px] text-[#3B4763]">{r.leads.toLocaleString()}</span>
          <span className="text-right text-[13px] text-[#3B4763]">{r.accepted.toLocaleString()}</span>
          <span className="text-right text-[13px] font-semibold text-[#6D28D9]">
            {pct(r.accepted, r.leads)}%
          </span>
          <span className="text-right text-[13px] font-semibold text-[#0F7A3E]">
            {r.revenue > 0 ? money(r.revenue) : "—"}
          </span>
        </button>
      ))}
    </div>
    </div>
  </div>
);

export default AnalyticsView;
