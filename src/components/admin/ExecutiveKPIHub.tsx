import { useEffect, useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  TrendingUp, TrendingDown, Users, DollarSign, Clock, Building2,
  UserCheck, Target, Calendar, ArrowUpRight, ArrowDownRight, BarChart3
} from "lucide-react";
import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip as ReTooltip, ResponsiveContainer, Legend, PieChart, Pie, Cell
} from "recharts";

/* ── types ────────────────────────────────────────────── */

interface Sub {
  id: string;
  created_at: string;
  progress_status: string;
  offered_price: number | null;
  acv_value: number | null;
  lead_source: string;
  status_updated_at: string | null;
  status_updated_by: string | null;
  appraised_by: string | null;
}

interface Location {
  id: string;
  name: string;
  city: string;
  state: string;
}

interface StoreMetrics {
  name: string;
  total: number;
  newLeads: number;
  contacted: number;
  inProgress: number;
  completed: number;
  dead: number;
  conversionRate: number;
  avgDays: number;
  pendingValue: number;
  closedValue: number;
  totalPipeline: number;
}

const SOURCE_LABELS: Record<string, string> = {
  inventory: "Off Street Purchase",
  service: "Service Drive",
  trade: "Trade-In",
  in_store_trade: "In-Store Trade",
};

const SOURCE_COLORS = ["hsl(210,70%,50%)", "hsl(160,60%,45%)", "hsl(280,60%,55%)", "hsl(35,85%,55%)", "hsl(0,0%,60%)"];

const COMPLETED_STATUSES = ["purchase_complete"];
const DEAD_STATUSES = ["dead_lead"];
const IN_PROGRESS_STATUSES = ["contacted", "inspection_scheduled", "inspection_completed", "appraisal_completed", "manager_approval", "price_agreed", "title_verified", "ownership_verified"];

/* ── helpers ──────────────────────────────────────────── */

function weeksAgo(n: number) {
  const d = new Date();
  d.setDate(d.getDate() - n * 7);
  d.setHours(0, 0, 0, 0);
  return d;
}

function getWeekLabel(date: Date) {
  return `${date.getMonth() + 1}/${date.getDate()}`;
}

/* ── main component ───────────────────────────────────── */

interface ExecutiveKPIHubProps {
  standalone?: boolean;
}

const ExecutiveKPIHub = ({ standalone = false }: ExecutiveKPIHubProps) => {
  const [subs, setSubs] = useState<Sub[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [loading, setLoading] = useState(true);
  const [timeRange, setTimeRange] = useState<"30" | "60" | "90" | "all">("all");

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    const [{ data: subData }, { data: locData }] = await Promise.all([
      supabase.from("submissions").select("id, created_at, progress_status, offered_price, acv_value, lead_source, status_updated_at, status_updated_by, appraised_by"),
      supabase.from("dealership_locations").select("id, name, city, state").eq("is_active", true).order("sort_order"),
    ]);
    if (subData) setSubs(subData);
    if (locData) setLocations(locData);
    setLoading(false);
  };

  const filteredSubs = useMemo(() => {
    if (timeRange === "all") return subs;
    const days = parseInt(timeRange);
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - days);
    return subs.filter(s => new Date(s.created_at) >= cutoff);
  }, [subs, timeRange]);

  /* ── per-source metrics ─────────────────────────── */
  const sourceMetrics = useMemo(() => {
    const map: Record<string, number> = {};
    filteredSubs.forEach(s => {
      const src = s.lead_source || "inventory";
      map[src] = (map[src] || 0) + 1;
    });
    return Object.entries(map).map(([key, count], i) => ({
      name: SOURCE_LABELS[key] || key,
      value: count,
      color: SOURCE_COLORS[i % SOURCE_COLORS.length],
    }));
  }, [filteredSubs]);

  /* ── per-store metrics ──────────────────────────── */
  const storeMetrics = useMemo((): StoreMetrics[] => {
    // Group subs by source as a proxy for "store" — since lead_source maps to store channels
    const sourceMap: Record<string, Sub[]> = {};
    filteredSubs.forEach(s => {
      const src = s.lead_source || "inventory";
      if (!sourceMap[src]) sourceMap[src] = [];
      sourceMap[src].push(s);
    });

    return Object.entries(sourceMap).map(([key, items]) => {
      const completed = items.filter(s => COMPLETED_STATUSES.includes(s.progress_status)).length;
      const dead = items.filter(s => DEAD_STATUSES.includes(s.progress_status)).length;
      const inProgress = items.filter(s => IN_PROGRESS_STATUSES.includes(s.progress_status)).length;
      const newLeads = items.filter(s => s.progress_status === "new").length;
      const contacted = items.filter(s => s.progress_status === "contacted").length;

      let totalDays = 0, dayCount = 0;
      items.forEach(s => {
        if (s.status_updated_at && s.progress_status !== "new") {
          const days = (new Date(s.status_updated_at).getTime() - new Date(s.created_at).getTime()) / 864e5;
          if (days >= 0 && days < 365) { totalDays += days; dayCount++; }
        }
      });

      let pendingValue = 0, closedValue = 0;
      items.forEach(s => {
        const val = s.offered_price || s.acv_value || 0;
        if (val > 0) {
          if (COMPLETED_STATUSES.includes(s.progress_status)) closedValue += val;
          else if (!DEAD_STATUSES.includes(s.progress_status)) pendingValue += val;
        }
      });

      return {
        name: SOURCE_LABELS[key] || key,
        total: items.length,
        newLeads,
        contacted,
        inProgress,
        completed,
        dead,
        conversionRate: items.length > 0 ? Math.round((completed / items.length) * 1000) / 10 : 0,
        avgDays: dayCount > 0 ? Math.round((totalDays / dayCount) * 10) / 10 : 0,
        pendingValue,
        closedValue,
        totalPipeline: pendingValue + closedValue,
      };
    }).sort((a, b) => b.total - a.total);
  }, [filteredSubs]);

  /* ── staff performance ──────────────────────────── */
  const staffMetrics = useMemo(() => {
    const map: Record<string, { name: string; deals: number; totalValue: number }> = {};
    filteredSubs.forEach(s => {
      const who = s.appraised_by || s.status_updated_by;
      if (!who) return;
      const clean = who.split("—")[0].trim();
      if (!map[clean]) map[clean] = { name: clean, deals: 0, totalValue: 0 };
      if (COMPLETED_STATUSES.includes(s.progress_status)) {
        map[clean].deals++;
        map[clean].totalValue += s.offered_price || s.acv_value || 0;
      }
    });
    return Object.values(map).sort((a, b) => b.deals - a.deals).slice(0, 10);
  }, [filteredSubs]);

  /* ── weekly trend ───────────────────────────────── */
  const weeklyTrend = useMemo(() => {
    const weeks: { label: string; start: Date; end: Date; leads: number; closed: number }[] = [];
    for (let i = 11; i >= 0; i--) {
      const start = weeksAgo(i + 1);
      const end = weeksAgo(i);
      weeks.push({ label: getWeekLabel(start), start, end, leads: 0, closed: 0 });
    }
    subs.forEach(s => {
      const d = new Date(s.created_at);
      weeks.forEach(w => {
        if (d >= w.start && d < w.end) {
          w.leads++;
          if (COMPLETED_STATUSES.includes(s.progress_status)) w.closed++;
        }
      });
    });
    return weeks.map(w => ({ week: w.label, Leads: w.leads, Closed: w.closed }));
  }, [subs]);

  /* ── aggregate KPIs ─────────────────────────────── */
  const kpis = useMemo(() => {
    const total = filteredSubs.length;
    const completed = filteredSubs.filter(s => COMPLETED_STATUSES.includes(s.progress_status)).length;
    const dead = filteredSubs.filter(s => DEAD_STATUSES.includes(s.progress_status)).length;
    const active = total - completed - dead;
    const convRate = total > 0 ? Math.round((completed / total) * 1000) / 10 : 0;

    let pipeline = 0, closed = 0;
    filteredSubs.forEach(s => {
      const val = s.offered_price || s.acv_value || 0;
      if (val > 0) {
        if (COMPLETED_STATUSES.includes(s.progress_status)) closed += val;
        else if (!DEAD_STATUSES.includes(s.progress_status)) pipeline += val;
      }
    });

    // Month trend
    const now = new Date();
    const thisMonth = filteredSubs.filter(s => {
      const d = new Date(s.created_at);
      return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
    }).length;
    const lastMonth = filteredSubs.filter(s => {
      const d = new Date(s.created_at);
      const lm = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      return d.getMonth() === lm.getMonth() && d.getFullYear() === lm.getFullYear();
    }).length;
    const trend = lastMonth > 0 ? Math.round(((thisMonth - lastMonth) / lastMonth) * 100) : thisMonth > 0 ? 100 : 0;

    return { total, completed, dead, active, convRate, pipeline, closed, thisMonth, trend };
  }, [filteredSubs]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="text-muted-foreground text-sm">Loading executive dashboard…</div>
      </div>
    );
  }

  return (
    <div className={`space-y-6 ${standalone ? "p-6 max-w-[1600px] mx-auto" : ""}`}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-black text-card-foreground tracking-tight">Executive Dashboard</h2>
          <p className="text-sm text-muted-foreground mt-0.5">Enterprise performance at a glance</p>
        </div>
        <div className="flex items-center gap-2">
          {(["30", "60", "90", "all"] as const).map(r => (
            <button
              key={r}
              onClick={() => setTimeRange(r)}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${
                timeRange === r
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "bg-muted/50 text-muted-foreground hover:bg-muted"
              }`}
            >
              {r === "all" ? "All Time" : `${r}d`}
            </button>
          ))}
        </div>
      </div>

      {/* Row 1 — Top KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        <KpiCard label="Total Leads" value={kpis.total} icon={Users} color="text-blue-500" bg="from-blue-500/15 to-blue-600/5" />
        <KpiCard label="Active Deals" value={kpis.active} icon={Target} color="text-violet-500" bg="from-violet-500/15 to-violet-600/5" />
        <KpiCard label="Conversion" value={`${kpis.convRate}%`} icon={TrendingUp} color="text-emerald-500" bg="from-emerald-500/15 to-emerald-600/5"
          badge={kpis.trend !== 0 ? { value: `${kpis.trend > 0 ? "+" : ""}${kpis.trend}%`, positive: kpis.trend > 0 } : undefined} />
        <KpiCard label="Pipeline Value" value={`$${(kpis.pipeline / 1000).toFixed(0)}k`} icon={DollarSign} color="text-amber-500" bg="from-amber-500/15 to-amber-600/5" />
        <KpiCard label="Closed Revenue" value={`$${(kpis.closed / 1000).toFixed(0)}k`} icon={UserCheck} color="text-emerald-600" bg="from-emerald-600/15 to-emerald-700/5" />
      </div>

      {/* Row 2 — Per-Channel Breakdown Table + Source Pie */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Channel Table */}
        <div className="lg:col-span-2 bg-card rounded-xl border border-border p-5 shadow-sm overflow-x-auto">
          <h3 className="text-[11px] font-bold text-muted-foreground uppercase tracking-widest mb-4">Performance by Channel</h3>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left py-2 text-[10px] font-bold text-muted-foreground uppercase">Channel</th>
                <th className="text-right py-2 text-[10px] font-bold text-muted-foreground uppercase">Leads</th>
                <th className="text-right py-2 text-[10px] font-bold text-muted-foreground uppercase">Active</th>
                <th className="text-right py-2 text-[10px] font-bold text-muted-foreground uppercase">Closed</th>
                <th className="text-right py-2 text-[10px] font-bold text-muted-foreground uppercase">Conv %</th>
                <th className="text-right py-2 text-[10px] font-bold text-muted-foreground uppercase">Avg Days</th>
                <th className="text-right py-2 text-[10px] font-bold text-muted-foreground uppercase">Pipeline</th>
                <th className="text-right py-2 text-[10px] font-bold text-muted-foreground uppercase">Closed $</th>
              </tr>
            </thead>
            <tbody>
              {storeMetrics.map((sm, i) => (
                <tr key={sm.name} className="border-b border-border/50 last:border-0 hover:bg-muted/30 transition-colors">
                  <td className="py-2.5 font-semibold text-card-foreground flex items-center gap-2">
                    <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: SOURCE_COLORS[i % SOURCE_COLORS.length] }} />
                    {sm.name}
                  </td>
                  <td className="text-right py-2.5 font-bold text-card-foreground">{sm.total}</td>
                  <td className="text-right py-2.5 text-muted-foreground">{sm.inProgress + sm.newLeads + sm.contacted}</td>
                  <td className="text-right py-2.5 text-emerald-600 font-semibold">{sm.completed}</td>
                  <td className="text-right py-2.5">
                    <span className={`font-bold ${sm.conversionRate >= 10 ? "text-emerald-600" : sm.conversionRate >= 5 ? "text-amber-600" : "text-red-500"}`}>
                      {sm.conversionRate}%
                    </span>
                  </td>
                  <td className="text-right py-2.5 text-muted-foreground">{sm.avgDays}</td>
                  <td className="text-right py-2.5 font-semibold text-amber-600">${sm.pendingValue.toLocaleString()}</td>
                  <td className="text-right py-2.5 font-semibold text-emerald-600">${sm.closedValue.toLocaleString()}</td>
                </tr>
              ))}
              {/* Totals row */}
              <tr className="bg-muted/30 font-bold">
                <td className="py-2.5 text-card-foreground">Total</td>
                <td className="text-right py-2.5">{kpis.total}</td>
                <td className="text-right py-2.5">{kpis.active}</td>
                <td className="text-right py-2.5 text-emerald-600">{kpis.completed}</td>
                <td className="text-right py-2.5 text-emerald-600">{kpis.convRate}%</td>
                <td className="text-right py-2.5">—</td>
                <td className="text-right py-2.5 text-amber-600">${kpis.pipeline.toLocaleString()}</td>
                <td className="text-right py-2.5 text-emerald-600">${kpis.closed.toLocaleString()}</td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Source Pie */}
        <div className="bg-card rounded-xl border border-border p-5 shadow-sm flex flex-col items-center justify-center">
          <h3 className="text-[11px] font-bold text-muted-foreground uppercase tracking-widest mb-3 self-start">Lead Sources</h3>
          <ResponsiveContainer width="100%" height={220}>
            <PieChart>
              <Pie data={sourceMetrics} dataKey="value" cx="50%" cy="50%" innerRadius={50} outerRadius={80} paddingAngle={3}>
                {sourceMetrics.map((s, i) => <Cell key={s.name} fill={s.color} />)}
              </Pie>
              <ReTooltip
                contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }}
                formatter={(value: number, name: string) => [`${value} leads`, name]}
              />
            </PieChart>
          </ResponsiveContainer>
          <div className="flex flex-wrap gap-x-3 gap-y-1 mt-2">
            {sourceMetrics.map(s => (
              <div key={s.name} className="flex items-center gap-1.5">
                <div className="w-2 h-2 rounded-full" style={{ background: s.color }} />
                <span className="text-[10px] text-muted-foreground">{s.name}: {s.value}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Row 3 — Trend Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Weekly Lead Volume */}
        <div className="bg-card rounded-xl border border-border p-5 shadow-sm">
          <h3 className="text-[11px] font-bold text-muted-foreground uppercase tracking-widest mb-4">12-Week Lead Volume</h3>
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={weeklyTrend}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="week" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} />
              <YAxis tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} />
              <ReTooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }} />
              <Bar dataKey="Leads" fill="hsl(210,70%,50%)" radius={[4, 4, 0, 0]} />
              <Bar dataKey="Closed" fill="hsl(160,60%,45%)" radius={[4, 4, 0, 0]} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Conversion Trend */}
        <div className="bg-card rounded-xl border border-border p-5 shadow-sm">
          <h3 className="text-[11px] font-bold text-muted-foreground uppercase tracking-widest mb-4">Weekly Conversion Trend</h3>
          <ResponsiveContainer width="100%" height={240}>
            <LineChart data={weeklyTrend.map(w => ({
              ...w,
              Rate: w.Leads > 0 ? Math.round((w.Closed / w.Leads) * 100) : 0,
            }))}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="week" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} />
              <YAxis tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} unit="%" />
              <ReTooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }} formatter={(v: number) => [`${v}%`, "Rate"]} />
              <Line type="monotone" dataKey="Rate" stroke="hsl(280,60%,55%)" strokeWidth={2.5} dot={{ r: 3 }} activeDot={{ r: 5 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Row 4 — Staff Performance */}
      {staffMetrics.length > 0 && (
        <div className="bg-card rounded-xl border border-border p-5 shadow-sm">
          <h3 className="text-[11px] font-bold text-muted-foreground uppercase tracking-widest mb-4">Staff Performance — Closed Deals</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left py-2 text-[10px] font-bold text-muted-foreground uppercase">Staff Member</th>
                  <th className="text-right py-2 text-[10px] font-bold text-muted-foreground uppercase">Deals Closed</th>
                  <th className="text-right py-2 text-[10px] font-bold text-muted-foreground uppercase">Total Value</th>
                  <th className="text-left py-2 text-[10px] font-bold text-muted-foreground uppercase pl-4">Performance</th>
                </tr>
              </thead>
              <tbody>
                {staffMetrics.map((sm, i) => {
                  const maxDeals = staffMetrics[0]?.deals || 1;
                  const pct = Math.round((sm.deals / maxDeals) * 100);
                  return (
                    <tr key={sm.name} className="border-b border-border/50 last:border-0">
                      <td className="py-2.5 font-semibold text-card-foreground">{sm.name}</td>
                      <td className="text-right py-2.5 font-bold text-card-foreground">{sm.deals}</td>
                      <td className="text-right py-2.5 font-semibold text-emerald-600">${sm.totalValue.toLocaleString()}</td>
                      <td className="py-2.5 pl-4">
                        <div className="h-5 bg-muted/30 rounded-full overflow-hidden w-40">
                          <div className="h-full rounded-full bg-gradient-to-r from-blue-500 to-violet-500 transition-all duration-500" style={{ width: `${pct}%` }} />
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

/* ── KPI Card ─────────────────────────────────────────── */

function KpiCard({ label, value, icon: Icon, color, bg, badge }: {
  label: string; value: string | number; icon: React.ElementType; color: string; bg: string;
  badge?: { value: string; positive: boolean };
}) {
  return (
    <div className="relative overflow-hidden bg-card rounded-xl border border-border p-4 shadow-sm">
      <div className={`absolute inset-0 bg-gradient-to-br ${bg} pointer-events-none`} />
      <div className="relative">
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider">{label}</span>
          <Icon className={`w-4 h-4 ${color}`} />
        </div>
        <div className="flex items-baseline gap-1.5">
          <span className="text-3xl font-black text-card-foreground tracking-tight">{value}</span>
          {badge && (
            <span className={`text-[10px] font-bold flex items-center gap-0.5 ${badge.positive ? "text-emerald-500" : "text-red-500"}`}>
              {badge.positive ? <TrendingUp className="w-2.5 h-2.5" /> : <TrendingDown className="w-2.5 h-2.5" />}
              {badge.value}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

export default ExecutiveKPIHub;
