import { useEffect, useState, useMemo, lazy, Suspense } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import {
  Building2, Users, TrendingUp, TrendingDown, DollarSign, ArrowLeft,
  BarChart3, CheckCircle2, Clock, XCircle, Car, Target, AlertTriangle,
  UserCheck, Moon, Sun, Plus,
} from "lucide-react";
import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip as ReTooltip, ResponsiveContainer, Legend, PieChart, Pie, Cell,
} from "recharts";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
const AddTenantWizard = lazy(() => import("@/components/admin/AddTenantWizard"));

/* ── types ───────────────────────────────────────── */

interface TenantRow {
  dealership_id: string;
  slug: string;
  display_name: string;
  is_active: boolean;
  custom_domain: string | null;
  created_at: string;
}

interface DealerAccount {
  dealership_id: string;
  plan_tier: string;
  plan_cost: number;
  onboarding_status: string;
  start_date: string | null;
  billing_date: number | null;
}

interface Sub {
  dealership_id: string;
  progress_status: string;
  offered_price: number | null;
  created_at: string;
  lead_source: string;
}

const STORE_COLORS = [
  "hsl(210,70%,50%)", "hsl(160,60%,45%)", "hsl(280,60%,55%)",
  "hsl(35,85%,55%)", "hsl(340,65%,50%)", "hsl(190,70%,45%)",
];
const STATUS_COLORS: Record<string, string> = {
  active: "hsl(160,60%,45%)",
  pending: "hsl(35,85%,55%)",
  paused: "hsl(210,70%,50%)",
  cancelled: "hsl(0,65%,50%)",
};

const COMPLETED = ["purchase_complete"];
const DEAD = ["dead_lead"];

function weeksAgo(n: number) {
  const d = new Date();
  d.setDate(d.getDate() - n * 7);
  d.setHours(0, 0, 0, 0);
  return d;
}
function getWeekLabel(date: Date) {
  return `${date.getMonth() + 1}/${date.getDate()}`;
}

/* ── main ────────────────────────────────────────── */

const SuperAdminDashboard = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [authorized, setAuthorized] = useState(false);
  const [tenants, setTenants] = useState<TenantRow[]>([]);
  const [accounts, setAccounts] = useState<DealerAccount[]>([]);
  const [subs, setSubs] = useState<Sub[]>([]);
  const [timeRange, setTimeRange] = useState<"30" | "60" | "90" | "all">("all");
  const [dark, setDark] = useState(() => localStorage.getItem("super-admin-dark") === "true");

  // Dark mode
  useEffect(() => {
    if (dark) document.documentElement.classList.add("dark");
    else document.documentElement.classList.remove("dark");
    localStorage.setItem("super-admin-dark", String(dark));
    return () => { document.documentElement.classList.remove("dark"); };
  }, [dark]);

  useEffect(() => {
    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { navigate("/admin/login"); return; }

      const { data: roleData } = await supabase
        .from("user_roles")
        .select("role, dealership_id")
        .eq("user_id", user.id)
        .eq("role", "admin")
        .eq("dealership_id", "default")
        .maybeSingle();

      if (!roleData) {
        toast.error("You don't have super-admin access.");
        navigate("/admin");
        return;
      }

      setAuthorized(true);
      await loadData();
    };
    init();
  }, [navigate]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [{ data: tenantData }, { data: accountData }, { data: subData }] = await Promise.all([
        supabase.from("tenants").select("dealership_id, slug, display_name, is_active, custom_domain, created_at").order("created_at", { ascending: true }),
        supabase.from("dealer_accounts").select("dealership_id, plan_tier, plan_cost, onboarding_status, start_date, billing_date"),
        supabase.from("submissions").select("dealership_id, progress_status, offered_price, created_at, lead_source"),
      ]);

      setTenants((tenantData || []) as TenantRow[]);
      setAccounts((accountData || []) as DealerAccount[]);
      setSubs((subData || []) as Sub[]);
    } catch {
      toast.error("Failed to load platform data");
    }
    setLoading(false);
  };

  /* ── filtered subs ──────────────────────────────── */
  const filteredSubs = useMemo(() => {
    if (timeRange === "all") return subs;
    const days = parseInt(timeRange);
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - days);
    return subs.filter(s => new Date(s.created_at) >= cutoff);
  }, [subs, timeRange]);

  /* ── platform KPIs ─────────────────────────────── */
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
      const val = s.offered_price || 0;
      if (val > 0) {
        if (COMPLETED.includes(s.progress_status)) closed += val;
        else if (!DEAD.includes(s.progress_status) && s.progress_status !== "partial") pipeline += val;
      }
    });

    const activeTenants = tenants.filter(t => t.is_active).length;
    const mrr = accounts
      .filter(a => a.onboarding_status === "active")
      .reduce((s, a) => s + Number(a.plan_cost), 0);

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

    return {
      totalTenants: tenants.length, activeTenants, mrr,
      total, completed, dead, abandoned, active, convRate, dropOffRate,
      pipeline, closed, trend,
    };
  }, [filteredSubs, tenants, accounts]);

  /* ── per-tenant breakdown ──────────────────────── */
  const tenantBreakdown = useMemo(() => {
    const tenantMap = new Map(tenants.map(t => [t.dealership_id, t]));
    const acctMap = new Map(accounts.map(a => [a.dealership_id, a]));
    const map: Record<string, Sub[]> = {};
    filteredSubs.forEach(s => {
      if (!map[s.dealership_id]) map[s.dealership_id] = [];
      map[s.dealership_id].push(s);
    });

    return tenants.map(t => {
      const items = map[t.dealership_id] || [];
      const completed = items.filter(s => COMPLETED.includes(s.progress_status)).length;
      const dead = items.filter(s => DEAD.includes(s.progress_status)).length;
      const active = items.length - completed - dead;
      let pipeline = 0, closed = 0;
      items.forEach(s => {
        const val = s.offered_price || 0;
        if (val > 0) {
          if (COMPLETED.includes(s.progress_status)) closed += val;
          else if (!DEAD.includes(s.progress_status)) pipeline += val;
        }
      });
      const acct = acctMap.get(t.dealership_id);
      return {
        ...t,
        acct,
        total: items.length,
        active,
        completed,
        dead,
        convRate: items.length > 0 ? Math.round((completed / items.length) * 1000) / 10 : 0,
        pipeline,
        closed,
      };
    }).sort((a, b) => b.total - a.total);
  }, [filteredSubs, tenants, accounts]);

  /* ── status pie for tenants ────────────────────── */
  const statusPie = useMemo(() => {
    const counts: Record<string, number> = { active: 0, pending: 0, paused: 0, cancelled: 0 };
    tenants.forEach(t => {
      const acct = accounts.find(a => a.dealership_id === t.dealership_id);
      const status = acct?.onboarding_status || "pending";
      counts[status] = (counts[status] || 0) + 1;
    });
    return Object.entries(counts).filter(([, v]) => v > 0).map(([name, value]) => ({
      name: name.charAt(0).toUpperCase() + name.slice(1),
      value,
      color: STATUS_COLORS[name] || "hsl(0,0%,60%)",
    }));
  }, [tenants, accounts]);

  /* ── 12-week platform trend ────────────────────── */
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

  /* ── conversion funnel ─────────────────────────── */
  const funnelStages = useMemo(() => {
    const statusMap: Record<string, string> = {
      new: "New", partial: "Abandoned", contacted: "Contacted",
      inspection_scheduled: "Inspected", inspected: "Inspected",
      offer_made: "Contacted", offer_accepted: "Contacted",
      paperwork: "Inspected", purchase_complete: "Purchased", dead_lead: "Dead",
    };
    const counts: Record<string, number> = { New: 0, Abandoned: 0, Contacted: 0, Inspected: 0, Purchased: 0, Dead: 0 };
    filteredSubs.forEach(s => {
      const stage = statusMap[s.progress_status] || "New";
      counts[stage]++;
    });
    return [
      { name: "New", count: counts.New + counts.Contacted + counts.Inspected + counts.Purchased, color: "hsl(210,70%,50%)" },
      { name: "Contacted", count: counts.Contacted + counts.Inspected + counts.Purchased, color: "hsl(190,70%,45%)" },
      { name: "Inspected", count: counts.Inspected + counts.Purchased, color: "hsl(280,60%,55%)" },
      { name: "Purchased", count: counts.Purchased, color: "hsl(160,60%,45%)" },
    ];
  }, [filteredSubs]);

  if (!authorized) return null;

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="bg-card border-b border-border">
        <div className="max-w-[1600px] mx-auto px-4 sm:px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => navigate("/admin")}>
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div>
              <h1 className="text-xl sm:text-2xl font-black text-card-foreground tracking-tight font-display">
                Platform Command Center
              </h1>
              <p className="text-sm text-muted-foreground">
                All tenants · Subscriptions · Performance
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {/* Time range filter */}
            <div className="hidden sm:flex items-center gap-1.5">
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
            {/* Dark/Light toggle */}
            <button
              onClick={() => setDark(!dark)}
              className="p-2 rounded-lg bg-muted/50 hover:bg-muted transition-colors text-muted-foreground"
            >
              {dark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-[1600px] mx-auto px-4 sm:px-6 py-6 space-y-6">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <p className="text-muted-foreground text-sm">Loading platform data…</p>
          </div>
        ) : (
          <>
            {/* Row 1 — Top KPIs */}
            <div className="grid grid-cols-2 lg:grid-cols-6 gap-3">
              <KpiCard label="Total Tenants" value={kpis.totalTenants} icon={Building2} color="text-blue-500" bg="from-blue-500/15 to-blue-600/5" />
              <KpiCard label="Active Tenants" value={kpis.activeTenants} icon={CheckCircle2} color="text-emerald-500" bg="from-emerald-500/15 to-emerald-600/5" />
              <KpiCard label="MRR" value={`$${kpis.mrr.toLocaleString()}`} icon={DollarSign} color="text-emerald-600" bg="from-emerald-600/15 to-emerald-700/5" />
              <KpiCard label="Platform Leads" value={kpis.total.toLocaleString()} icon={Car} color="text-violet-500" bg="from-violet-500/15 to-violet-600/5"
                badge={kpis.trend !== 0 ? { value: `${kpis.trend > 0 ? "+" : ""}${kpis.trend}%`, positive: kpis.trend > 0 } : undefined} />
              <KpiCard label="Purchased" value={kpis.completed.toLocaleString()} icon={UserCheck} color="text-emerald-500" bg="from-emerald-500/15 to-emerald-600/5" />
              <KpiCard label="Conversion" value={`${kpis.convRate}%`} icon={TrendingUp} color="text-amber-500" bg="from-amber-500/15 to-amber-600/5" />
            </div>

            {/* Row 2 — Revenue KPIs */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="bg-card rounded-xl border border-border p-5 shadow-sm">
                <h4 className="text-[11px] font-bold text-muted-foreground uppercase tracking-widest mb-3">Revenue Pipeline</h4>
                <div className="space-y-2">
                  <div className="flex justify-between items-baseline">
                    <span className="text-xs text-muted-foreground">Pipeline Value</span>
                    <span className="text-lg font-black text-amber-600">${kpis.pipeline.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between items-baseline">
                    <span className="text-xs text-muted-foreground">Closed Revenue</span>
                    <span className="text-lg font-black text-emerald-600">${kpis.closed.toLocaleString()}</span>
                  </div>
                  <div className="h-px bg-border" />
                  <div className="flex justify-between items-baseline">
                    <span className="text-xs font-semibold text-muted-foreground">Abandoned</span>
                    <span className="text-sm font-bold text-amber-500">{kpis.abandoned} ({kpis.dropOffRate}%)</span>
                  </div>
                </div>
              </div>

              {/* Tenant Status Pie */}
              <div className="bg-card rounded-xl border border-border p-5 shadow-sm flex flex-col items-center">
                <h4 className="text-[11px] font-bold text-muted-foreground uppercase tracking-widest mb-3 self-start">Tenant Status</h4>
                <div className="flex items-center gap-6">
                  <DonutChart data={statusPie} total={kpis.totalTenants} />
                  <div className="space-y-1.5">
                    {statusPie.map(s => (
                      <div key={s.name} className="flex items-center gap-2">
                        <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: s.color }} />
                        <span className="text-xs text-muted-foreground">{s.name}: <span className="font-bold text-card-foreground">{s.value}</span></span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Active deals breakdown */}
              <div className="bg-card rounded-xl border border-border p-5 shadow-sm">
                <h4 className="text-[11px] font-bold text-muted-foreground uppercase tracking-widest mb-3">Deal Status</h4>
                <div className="grid grid-cols-2 gap-3">
                  <MiniStat label="Active" value={kpis.active} color="text-blue-500" />
                  <MiniStat label="Completed" value={kpis.completed} color="text-emerald-500" />
                  <MiniStat label="Dead" value={kpis.dead} color="text-red-500" />
                  <MiniStat label="Abandoned" value={kpis.abandoned} color="text-amber-500" />
                </div>
              </div>
            </div>

            {/* Row 3 — Tenant Performance Table */}
            <div className="bg-card rounded-xl border border-border p-5 shadow-sm overflow-x-auto">
              <div className="flex items-center gap-2 mb-4">
                <Users className="w-4 h-4 text-muted-foreground" />
                <h3 className="text-[11px] font-bold text-muted-foreground uppercase tracking-widest">Performance by Dealership</h3>
              </div>
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left py-2 text-[10px] font-bold text-muted-foreground uppercase">Dealership</th>
                    <th className="text-left py-2 text-[10px] font-bold text-muted-foreground uppercase hidden sm:table-cell">Status</th>
                    <th className="text-right py-2 text-[10px] font-bold text-muted-foreground uppercase hidden md:table-cell">Plan</th>
                    <th className="text-right py-2 text-[10px] font-bold text-muted-foreground uppercase hidden md:table-cell">Cost</th>
                    <th className="text-right py-2 text-[10px] font-bold text-muted-foreground uppercase">Leads</th>
                    <th className="text-right py-2 text-[10px] font-bold text-muted-foreground uppercase">Active</th>
                    <th className="text-right py-2 text-[10px] font-bold text-muted-foreground uppercase hidden lg:table-cell">Closed</th>
                    <th className="text-right py-2 text-[10px] font-bold text-muted-foreground uppercase">Conv %</th>
                    <th className="text-right py-2 text-[10px] font-bold text-muted-foreground uppercase hidden lg:table-cell">Pipeline</th>
                    <th className="text-right py-2 text-[10px] font-bold text-muted-foreground uppercase hidden lg:table-cell">Closed $</th>
                  </tr>
                </thead>
                <tbody>
                  {tenantBreakdown.map((t, i) => (
                    <tr key={t.dealership_id} className="border-b border-border/50 last:border-0 hover:bg-muted/30 transition-colors">
                      <td className="py-2.5 font-semibold text-card-foreground flex items-center gap-2">
                        <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: STORE_COLORS[i % STORE_COLORS.length] }} />
                        <div>
                          <div>{t.display_name || t.slug}</div>
                          <div className="text-[10px] text-muted-foreground font-mono font-normal sm:hidden">
                            {t.custom_domain || t.slug}
                          </div>
                        </div>
                      </td>
                      <td className="py-2.5 hidden sm:table-cell">
                        <StatusBadge status={t.acct?.onboarding_status || "pending"} />
                      </td>
                      <td className="text-right py-2.5 hidden md:table-cell capitalize text-muted-foreground text-xs">
                        {t.acct?.plan_tier || "—"}
                      </td>
                      <td className="text-right py-2.5 hidden md:table-cell font-medium text-card-foreground">
                        {t.acct ? `$${Number(t.acct.plan_cost).toLocaleString()}/mo` : "—"}
                      </td>
                      <td className="text-right py-2.5 font-bold text-card-foreground">{t.total}</td>
                      <td className="text-right py-2.5 text-muted-foreground">{t.active}</td>
                      <td className="text-right py-2.5 text-emerald-600 font-semibold hidden lg:table-cell">{t.completed}</td>
                      <td className="text-right py-2.5">
                        <span className={`font-bold ${t.convRate >= 10 ? "text-emerald-600" : t.convRate >= 5 ? "text-amber-600" : "text-red-500"}`}>
                          {t.convRate}%
                        </span>
                      </td>
                      <td className="text-right py-2.5 font-semibold text-amber-600 hidden lg:table-cell">${t.pipeline.toLocaleString()}</td>
                      <td className="text-right py-2.5 font-semibold text-emerald-600 hidden lg:table-cell">${t.closed.toLocaleString()}</td>
                    </tr>
                  ))}
                  {/* Totals row */}
                  <tr className="bg-muted/30 font-bold">
                    <td className="py-2.5 text-card-foreground">All Tenants</td>
                    <td className="py-2.5 hidden sm:table-cell" />
                    <td className="py-2.5 hidden md:table-cell" />
                    <td className="text-right py-2.5 hidden md:table-cell text-card-foreground">${kpis.mrr.toLocaleString()}/mo</td>
                    <td className="text-right py-2.5">{kpis.total}</td>
                    <td className="text-right py-2.5">{kpis.active}</td>
                    <td className="text-right py-2.5 text-emerald-600 hidden lg:table-cell">{kpis.completed}</td>
                    <td className="text-right py-2.5 text-emerald-600">{kpis.convRate}%</td>
                    <td className="text-right py-2.5 text-amber-600 hidden lg:table-cell">${kpis.pipeline.toLocaleString()}</td>
                    <td className="text-right py-2.5 text-emerald-600 hidden lg:table-cell">${kpis.closed.toLocaleString()}</td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* Row 4 — Charts */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              {/* 12-Week Trend */}
              <div className="bg-card rounded-xl border border-border p-5 shadow-sm lg:col-span-2">
                <h3 className="text-[11px] font-bold text-muted-foreground uppercase tracking-widest mb-4">12-Week Platform Trend</h3>
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
                <h3 className="text-[11px] font-bold text-muted-foreground uppercase tracking-widest mb-4">Conversion Trend</h3>
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

            {/* Row 5 — Conversion Funnel */}
            <div className="bg-card rounded-xl border border-border p-5 shadow-sm">
              <h3 className="text-[11px] font-bold text-muted-foreground uppercase tracking-widest mb-5">Platform Conversion Funnel</h3>
              <div className="flex flex-col gap-1.5">
                {funnelStages.map((stage, i) => {
                  const maxCount = funnelStages[0]?.count || 1;
                  const widthPct = Math.max((stage.count / maxCount) * 100, 8);
                  const prevCount = i > 0 ? funnelStages[i - 1].count : stage.count;
                  const dropOff = prevCount > 0 && i > 0 ? Math.round(((prevCount - stage.count) / prevCount) * 100) : 0;
                  return (
                    <div key={stage.name} className="flex items-center gap-3">
                      <span className="text-[10px] font-bold text-muted-foreground uppercase w-20 text-right shrink-0">{stage.name}</span>
                      <div className="flex-1 relative">
                        <div
                          className="h-9 rounded-lg flex items-center px-3 transition-all duration-500"
                          style={{ width: `${widthPct}%`, background: stage.color, minWidth: 60 }}
                        >
                          <span className="text-white text-xs font-black">{stage.count}</span>
                        </div>
                      </div>
                      {dropOff > 0 && (
                        <span className="text-[10px] font-semibold text-red-500 w-16 shrink-0">−{dropOff}% drop</span>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

/* ── Sub-components ───────────────────────────────── */

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

function DonutChart({ data, total }: { data: { name: string; value: number; color: string }[]; total: number }) {
  const size = 100;
  const strokeWidth = 16;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const center = size / 2;

  let offset = 0;
  const segments = data.map(d => {
    const pct = total > 0 ? d.value / total : 0;
    const dashArray = pct * circumference;
    const dashOffset = -offset * circumference;
    offset += pct;
    return { ...d, dashArray, dashOffset };
  });

  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90">
        <circle cx={center} cy={center} r={radius} fill="none" stroke="hsl(var(--muted))" strokeWidth={strokeWidth} opacity={0.3} />
        {segments.map(seg => (
          <circle key={seg.name} cx={center} cy={center} r={radius} fill="none" stroke={seg.color} strokeWidth={strokeWidth}
            strokeDasharray={`${seg.dashArray} ${circumference - seg.dashArray}`} strokeDashoffset={seg.dashOffset}
            className="transition-all duration-500" />
        ))}
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-lg font-black text-card-foreground">{total}</span>
        <span className="text-[9px] text-muted-foreground font-medium">Total</span>
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const cfg: Record<string, { bg: string; text: string; icon: typeof CheckCircle2 }> = {
    active: { bg: "bg-emerald-500/10", text: "text-emerald-600", icon: CheckCircle2 },
    pending: { bg: "bg-amber-500/10", text: "text-amber-600", icon: Clock },
    paused: { bg: "bg-blue-500/10", text: "text-blue-600", icon: Clock },
    cancelled: { bg: "bg-red-500/10", text: "text-red-500", icon: XCircle },
  };
  const c = cfg[status] || cfg.pending;
  const Icon = c.icon;
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${c.bg} ${c.text}`}>
      <Icon className="w-3 h-3" />
      {status}
    </span>
  );
}

function MiniStat({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="text-center">
      <span className={`text-2xl font-black ${color}`}>{value.toLocaleString()}</span>
      <p className="text-[10px] text-muted-foreground mt-0.5">{label}</p>
    </div>
  );
}

export default SuperAdminDashboard;
