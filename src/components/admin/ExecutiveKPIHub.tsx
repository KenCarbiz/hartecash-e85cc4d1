import { useEffect, useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  TrendingUp, TrendingDown, Users, DollarSign, Target, UserCheck, Building2, AlertTriangle
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
  store_location_id: string | null;
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

const SOURCE_LABELS: Record<string, string> = {
  inventory: "Off Street",
  service: "Service Drive",
  trade: "Trade-In",
  in_store_trade: "In-Store Trade",
};

const STORE_COLORS = [
  "hsl(210,70%,50%)", "hsl(160,60%,45%)", "hsl(280,60%,55%)",
  "hsl(35,85%,55%)", "hsl(340,65%,50%)", "hsl(190,70%,45%)",
];
const SOURCE_COLORS = ["hsl(210,70%,50%)", "hsl(160,60%,45%)", "hsl(280,60%,55%)", "hsl(35,85%,55%)", "hsl(0,0%,60%)"];

const COMPLETED = ["purchase_complete"];
const DEAD = ["dead_lead"];

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

/* ── main ─────────────────────────────────────────────── */

interface ExecutiveKPIHubProps {
  standalone?: boolean;
}

const ExecutiveKPIHub = ({ standalone = false }: ExecutiveKPIHubProps) => {
  const [subs, setSubs] = useState<Sub[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [loading, setLoading] = useState(true);
  const [timeRange, setTimeRange] = useState<"30" | "60" | "90" | "all">("all");
  const [trackAbandoned, setTrackAbandoned] = useState(true);

  useEffect(() => {
    Promise.all([
      supabase.from("submissions").select("id, created_at, progress_status, offered_price, acv_value, lead_source, store_location_id, status_updated_at, status_updated_by, appraised_by"),
      supabase.from("dealership_locations").select("id, name, city, state").eq("is_active", true).order("sort_order"),
      supabase.from("site_config").select("track_abandoned_leads").eq("dealership_id", "default").maybeSingle(),
    ]).then(([{ data: subData }, { data: locData }, { data: cfgData }]) => {
      if (subData) setSubs(subData as any);
      if (locData) setLocations(locData);
      if (cfgData && typeof (cfgData as any).track_abandoned_leads === "boolean") {
        setTrackAbandoned((cfgData as any).track_abandoned_leads);
      }
      setLoading(false);
    });
  }, []);

  const filteredSubs = useMemo(() => {
    let result = subs;
    // Exclude abandoned/partial leads when tracking is disabled
    if (!trackAbandoned) {
      result = result.filter(s => s.progress_status !== "partial");
    }
    if (timeRange !== "all") {
      const days = parseInt(timeRange);
      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() - days);
      result = result.filter(s => new Date(s.created_at) >= cutoff);
    }
    return result;
  }, [subs, timeRange, trackAbandoned]);

  /* ── aggregate KPIs ─────────────────────────────── */
  const kpis = useMemo(() => {
    const total = filteredSubs.length;
    const completed = filteredSubs.filter(s => COMPLETED.includes(s.progress_status)).length;
    const dead = filteredSubs.filter(s => DEAD.includes(s.progress_status)).length;
    const abandoned = filteredSubs.filter(s => s.progress_status === "partial").length;
    const active = total - completed - dead - abandoned;
    const convRate = total > 0 ? Math.round((completed / total) * 1000) / 10 : 0;
    const dropOffRate = total > 0 ? Math.round((abandoned / total) * 1000) / 10 : 0;

    let pipeline = 0, closed = 0;
    filteredSubs.forEach(s => {
      const val = s.offered_price || s.acv_value || 0;
      if (val > 0) {
        if (COMPLETED.includes(s.progress_status)) closed += val;
        else if (!DEAD.includes(s.progress_status) && s.progress_status !== "partial") pipeline += val;
      }
    });

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

    return { total, completed, dead, abandoned, active, convRate, dropOffRate, pipeline, closed, trend };
  }, [filteredSubs]);

  /* ── per-store breakdown ────────────────────────── */
  const storeBreakdown = useMemo(() => {
    const locMap = new Map(locations.map(l => [l.id, l]));
    const map: Record<string, { name: string; subs: Sub[] }> = {};

    filteredSubs.forEach(s => {
      const storeId = s.store_location_id || "__unassigned";
      if (!map[storeId]) {
        const loc = locMap.get(storeId);
        map[storeId] = { name: loc ? loc.name : "Unassigned", subs: [] };
      }
      map[storeId].subs.push(s);
    });

    return Object.entries(map).map(([id, { name, subs: items }]) => {
      const completed = items.filter(s => COMPLETED.includes(s.progress_status)).length;
      const dead = items.filter(s => DEAD.includes(s.progress_status)).length;
      const active = items.length - completed - dead;
      let pipeline = 0, closed = 0;
      items.forEach(s => {
        const val = s.offered_price || s.acv_value || 0;
        if (val > 0) {
          if (COMPLETED.includes(s.progress_status)) closed += val;
          else if (!DEAD.includes(s.progress_status)) pipeline += val;
        }
      });

      // Channel breakdown within this store
      const channels: Record<string, number> = {};
      items.forEach(s => {
        const src = s.lead_source || "inventory";
        channels[src] = (channels[src] || 0) + 1;
      });

      return {
        id,
        name,
        total: items.length,
        active,
        completed,
        dead,
        convRate: items.length > 0 ? Math.round((completed / items.length) * 1000) / 10 : 0,
        pipeline,
        closed,
        channels: Object.entries(channels).map(([k, v]) => ({
          channel: SOURCE_LABELS[k] || k,
          count: v,
        })).sort((a, b) => b.count - a.count),
      };
    }).sort((a, b) => b.total - a.total);
  }, [filteredSubs, locations]);

  /* ── source pie ─────────────────────────────────── */
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

  /* ── staff performance ──────────────────────────── */
  const staffMetrics = useMemo(() => {
    const map: Record<string, { name: string; deals: number; totalValue: number }> = {};
    filteredSubs.forEach(s => {
      const who = s.appraised_by || s.status_updated_by;
      if (!who) return;
      const clean = who.split("—")[0].trim();
      if (!map[clean]) map[clean] = { name: clean, deals: 0, totalValue: 0 };
      if (COMPLETED.includes(s.progress_status)) {
        map[clean].deals++;
        map[clean].totalValue += s.offered_price || s.acv_value || 0;
      }
    });
    return Object.values(map).sort((a, b) => b.deals - a.deals).slice(0, 10);
  }, [filteredSubs]);

  /* ── 12-week trend ──────────────────────────────── */
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
          if (COMPLETED.includes(s.progress_status)) w.closed++;
        }
      });
    });
    return weeks.map(w => ({ week: w.label, Leads: w.leads, Closed: w.closed }));
  }, [subs]);

  if (loading) {
    return <div className="flex items-center justify-center py-20"><p className="text-muted-foreground text-sm">Loading executive dashboard…</p></div>;
  }

  return (
    <div className={`space-y-6 ${standalone ? "p-6 max-w-[1600px] mx-auto" : ""}`}>
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-2xl font-black text-card-foreground tracking-tight">Executive Dashboard</h2>
          <p className="text-sm text-muted-foreground mt-0.5">Multi-rooftop performance at a glance</p>
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

      {/* Row 2 — Store Breakdown Table */}
      <div className="bg-card rounded-xl border border-border p-5 shadow-sm overflow-x-auto">
        <div className="flex items-center gap-2 mb-4">
          <Building2 className="w-4 h-4 text-muted-foreground" />
          <h3 className="text-[11px] font-bold text-muted-foreground uppercase tracking-widest">Performance by Store</h3>
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border">
              <th className="text-left py-2 text-[10px] font-bold text-muted-foreground uppercase">Store</th>
              <th className="text-right py-2 text-[10px] font-bold text-muted-foreground uppercase">Leads</th>
              <th className="text-right py-2 text-[10px] font-bold text-muted-foreground uppercase">Active</th>
              <th className="text-right py-2 text-[10px] font-bold text-muted-foreground uppercase">Closed</th>
              <th className="text-right py-2 text-[10px] font-bold text-muted-foreground uppercase">Conv %</th>
              <th className="text-right py-2 text-[10px] font-bold text-muted-foreground uppercase">Pipeline</th>
              <th className="text-right py-2 text-[10px] font-bold text-muted-foreground uppercase">Closed $</th>
              <th className="text-left py-2 text-[10px] font-bold text-muted-foreground uppercase pl-4">Channel Mix</th>
            </tr>
          </thead>
          <tbody>
            {storeBreakdown.map((sm, i) => (
              <tr key={sm.id} className="border-b border-border/50 last:border-0 hover:bg-muted/30 transition-colors">
                <td className="py-2.5 font-semibold text-card-foreground flex items-center gap-2">
                  <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: STORE_COLORS[i % STORE_COLORS.length] }} />
                  {sm.name}
                </td>
                <td className="text-right py-2.5 font-bold text-card-foreground">{sm.total}</td>
                <td className="text-right py-2.5 text-muted-foreground">{sm.active}</td>
                <td className="text-right py-2.5 text-emerald-600 font-semibold">{sm.completed}</td>
                <td className="text-right py-2.5">
                  <span className={`font-bold ${sm.convRate >= 10 ? "text-emerald-600" : sm.convRate >= 5 ? "text-amber-600" : "text-red-500"}`}>
                    {sm.convRate}%
                  </span>
                </td>
                <td className="text-right py-2.5 font-semibold text-amber-600">${sm.pipeline.toLocaleString()}</td>
                <td className="text-right py-2.5 font-semibold text-emerald-600">${sm.closed.toLocaleString()}</td>
                <td className="py-2.5 pl-4">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {sm.channels.map(ch => (
                      <span key={ch.channel} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-muted/60 text-[10px] font-medium text-muted-foreground">
                        {ch.channel}: {ch.count}
                      </span>
                    ))}
                  </div>
                </td>
              </tr>
            ))}
            {/* Totals */}
            <tr className="bg-muted/30 font-bold">
              <td className="py-2.5 text-card-foreground">All Stores</td>
              <td className="text-right py-2.5">{kpis.total}</td>
              <td className="text-right py-2.5">{kpis.active}</td>
              <td className="text-right py-2.5 text-emerald-600">{kpis.completed}</td>
              <td className="text-right py-2.5 text-emerald-600">{kpis.convRate}%</td>
              <td className="text-right py-2.5 text-amber-600">${kpis.pipeline.toLocaleString()}</td>
              <td className="text-right py-2.5 text-emerald-600">${kpis.closed.toLocaleString()}</td>
              <td className="py-2.5 pl-4"></td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* Row 3 — Source Pie + Trend Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
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

        {/* Weekly Lead Volume */}
        <div className="bg-card rounded-xl border border-border p-5 shadow-sm">
          <h3 className="text-[11px] font-bold text-muted-foreground uppercase tracking-widest mb-4">12-Week Lead Volume</h3>
          <ResponsiveContainer width="100%" height={220}>
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
          <h3 className="text-[11px] font-bold text-muted-foreground uppercase tracking-widest mb-4">Conversion Trend</h3>
          <ResponsiveContainer width="100%" height={220}>
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
                {staffMetrics.map(sm => {
                  const maxDeals = staffMetrics[0]?.deals || 1;
                  const pct = Math.round((sm.deals / maxDeals) * 100);
                  return (
                    <tr key={sm.name} className="border-b border-border/50 last:border-0">
                      <td className="py-2.5 font-semibold text-card-foreground">{sm.name}</td>
                      <td className="text-right py-2.5 font-bold text-card-foreground">{sm.deals}</td>
                      <td className="text-right py-2.5 font-semibold text-emerald-600">${sm.totalValue.toLocaleString()}</td>
                      <td className="py-2.5 pl-4">
                        <div className="h-5 bg-muted/30 rounded-full overflow-hidden w-40">
                          <div className="h-full rounded-full bg-gradient-to-r from-primary/80 to-primary transition-all duration-500" style={{ width: `${pct}%` }} />
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
