import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { TrendingUp, TrendingDown, Users, DollarSign, Clock, Flame, Camera, FileText } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface SubmissionRow {
  id: string;
  created_at: string;
  progress_status: string;
  offered_price: number | null;
  estimated_offer_low: number | null;
  estimated_offer_high: number | null;
  acv_value: number | null;
  photos_uploaded: boolean;
  docs_uploaded: boolean;
  is_hot_lead: boolean;
  lead_source: string;
  status_updated_at: string | null;
}

interface FunnelMetrics {
  sourceBreakdown: { key: string; label: string; count: number; color: string }[];
  todayLeads: number;
  weekLeads: number;
  monthLeads: number;
  prevMonthLeads: number;
  hotLeads: number;
  photosUploaded: number;
  docsUploaded: number;
  stageConversion: { stage: string; count: number; pct: number }[];
  totalOfferedValue: number;
  avgOfferAmount: number;
  pendingDealValue: number;
  closedDealValue: number;
  avgResponseDays: number;
  totalLeads: number;
  completedLeads: number;
  deadLeads: number;
  loading: boolean;
}

const STAGE_LABELS: Record<string, string> = {
  new: "New Lead",
  offer_accepted: "Offer Accepted",
  not_contacted: "Not Contacted",
  inspection_scheduled: "Inspection Sched.",
  inspection_completed: "Inspection Done",
  deal_finalized: "Deal Finalized",
  title_ownership_verified: "Title/Ownership",
  check_request_submitted: "Check Request",
  purchase_complete: "Purchased",
  manager_approval_inspection: "MAI",
};

const FUNNEL_STAGES = [
  "new", "offer_accepted", "inspection_scheduled", "inspection_completed",
  "deal_finalized", "check_request_submitted", "purchase_complete",
];

const SOURCE_CONFIG: { key: string; label: string; color: string; ring: string }[] = [
  { key: "inventory", label: "Off Street Purchase", color: "hsl(210, 70%, 50%)", ring: "hsl(210, 70%, 50%)" },
  { key: "service", label: "Service Drive", color: "hsl(160, 60%, 45%)", ring: "hsl(160, 60%, 45%)" },
  { key: "trade", label: "Trade-In", color: "hsl(280, 60%, 55%)", ring: "hsl(280, 60%, 55%)" },
  { key: "in_store_trade", label: "In-Store Trade", color: "hsl(35, 85%, 55%)", ring: "hsl(35, 85%, 55%)" },
];

type PeriodKey = "7d" | "30d" | "90d" | "all";

const PERIOD_OPTIONS: { value: PeriodKey; label: string }[] = [
  { value: "7d", label: "Last 7 Days" },
  { value: "30d", label: "Last 30 Days" },
  { value: "90d", label: "Last 90 Days" },
  { value: "all", label: "All Time" },
];

function filterByPeriod(rows: SubmissionRow[], period: PeriodKey): SubmissionRow[] {
  if (period === "all") return rows;
  const now = new Date();
  const daysMap: Record<Exclude<PeriodKey, "all">, number> = { "7d": 7, "30d": 30, "90d": 90 };
  const cutoff = new Date(now.getTime() - daysMap[period] * 24 * 60 * 60 * 1000);
  return rows.filter(r => new Date(r.created_at) >= cutoff);
}

function computeMetrics(subs: SubmissionRow[]): Omit<FunnelMetrics, "loading"> {
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const weekStart = new Date(todayStart); weekStart.setDate(weekStart.getDate() - 7);
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const prevMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const prevMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0);

  let todayLeads = 0, weekLeads = 0, monthLeads = 0, prevMonthLeads = 0;
  let hotLeads = 0, photosUploaded = 0, docsUploaded = 0;
  let totalOfferedValue = 0, offeredCount = 0;
  let pendingDealValue = 0, closedDealValue = 0;
  let totalResponseDays = 0, responseCount = 0;
  let completedLeads = 0, deadLeads = 0;

  const sourceCounts: Record<string, number> = {};
  const statusCounts: Record<string, number> = {};

  subs.forEach((s: SubmissionRow) => {
    const created = new Date(s.created_at);

    const src = s.lead_source || "inventory";
    sourceCounts[src] = (sourceCounts[src] || 0) + 1;

    if (created >= todayStart) todayLeads++;
    if (created >= weekStart) weekLeads++;
    if (created >= monthStart) monthLeads++;
    if (created >= prevMonthStart && created <= prevMonthEnd) prevMonthLeads++;

    if (s.is_hot_lead) hotLeads++;
    if (s.photos_uploaded) photosUploaded++;
    if (s.docs_uploaded) docsUploaded++;

    const st = s.progress_status || "new";
    statusCounts[st] = (statusCounts[st] || 0) + 1;
    if (st === "purchase_complete") completedLeads++;
    if (st === "dead_lead") deadLeads++;

    const offerVal = s.offered_price || s.acv_value || 0;
    if (offerVal > 0) {
      totalOfferedValue += offerVal;
      offeredCount++;
      if (st === "purchase_complete") closedDealValue += offerVal;
      else if (st !== "dead_lead") pendingDealValue += offerVal;
    }

    if (s.status_updated_at && st !== "new") {
      const updatedAt = new Date(s.status_updated_at);
      const days = (updatedAt.getTime() - created.getTime()) / (1000 * 60 * 60 * 24);
      if (days >= 0 && days < 365) { totalResponseDays += days; responseCount++; }
    }
  });

  const total = subs.length;

  const sourceBreakdown = SOURCE_CONFIG.map(sc => ({
    key: sc.key,
    label: sc.label,
    count: sourceCounts[sc.key] || 0,
    color: sc.color,
  }));
  Object.keys(sourceCounts).forEach(key => {
    if (!SOURCE_CONFIG.find(sc => sc.key === key)) {
      sourceBreakdown.push({ key, label: key, count: sourceCounts[key], color: "hsl(0, 0%, 60%)" });
    }
  });

  const stageConversion = FUNNEL_STAGES.map(stage => {
    const stageIdx = FUNNEL_STAGES.indexOf(stage);
    const reachedCount = subs.filter(s => {
      const sIdx = FUNNEL_STAGES.indexOf(s.progress_status);
      return sIdx >= stageIdx;
    }).length;
    return { stage, count: statusCounts[stage] || 0, pct: total > 0 ? Math.round((reachedCount / total) * 100) : 0 };
  });

  return {
    sourceBreakdown,
    todayLeads, weekLeads, monthLeads, prevMonthLeads,
    hotLeads, photosUploaded, docsUploaded,
    stageConversion, totalOfferedValue,
    avgOfferAmount: offeredCount > 0 ? Math.round(totalOfferedValue / offeredCount) : 0,
    pendingDealValue, closedDealValue,
    avgResponseDays: responseCount > 0 ? Math.round((totalResponseDays / responseCount) * 10) / 10 : 0,
    totalLeads: total, completedLeads, deadLeads,
  };
}

const DashboardAnalytics = () => {
  const [allSubmissions, setAllSubmissions] = useState<SubmissionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState<PeriodKey>("all");

  useEffect(() => {
    const fetchSubmissions = async () => {
      try {
        const { data: subs } = await supabase
          .from("submissions")
          .select("id, created_at, progress_status, offered_price, estimated_offer_low, estimated_offer_high, acv_value, photos_uploaded, docs_uploaded, is_hot_lead, lead_source, status_updated_at");

        if (subs) setAllSubmissions(subs as SubmissionRow[]);
      } catch (err) {
        console.error("Analytics error:", err);
      } finally {
        setLoading(false);
      }
    };
    fetchSubmissions();
  }, []);

  const filtered = useMemo(() => filterByPeriod(allSubmissions, period), [allSubmissions, period]);
  const metrics = useMemo(() => computeMetrics(filtered), [filtered]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8 gap-3 animate-in fade-in">
        <div className="w-6 h-6 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
        <span className="text-sm text-muted-foreground font-medium">Loading analytics...</span>
      </div>
    );
  }

  const monthTrend = metrics.prevMonthLeads > 0
    ? Math.round(((metrics.monthLeads - metrics.prevMonthLeads) / metrics.prevMonthLeads) * 100)
    : metrics.monthLeads > 0 ? 100 : 0;

  const conversionRate = metrics.totalLeads > 0
    ? Math.round((metrics.completedLeads / metrics.totalLeads) * 1000) / 10 : 0;

  const activeDeals = metrics.totalLeads - metrics.completedLeads - metrics.deadLeads;

  return (
    <div className="space-y-4">
      {/* Period selector */}
      <div className="flex items-center justify-between">
        <h4 className="text-[11px] font-bold text-muted-foreground uppercase tracking-widest">Analytics</h4>
        <Select value={period} onValueChange={(val) => setPeriod(val as PeriodKey)}>
          <SelectTrigger className="w-[160px] h-8 text-xs">
            <SelectValue placeholder="Select period" />
          </SelectTrigger>
          <SelectContent>
            {PERIOD_OPTIONS.map(opt => (
              <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="relative overflow-hidden bg-card rounded-xl border border-border p-4 shadow-sm">
          <div className="absolute inset-0 bg-gradient-to-br from-blue-500/15 to-blue-600/5 pointer-events-none" />
          <div className="relative">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider">Total Leads</span>
              <Users className="w-4 h-4 text-blue-500" />
            </div>
            <div className="flex items-baseline gap-1.5">
              <span className="text-3xl font-black text-card-foreground tracking-tight">{metrics.totalLeads}</span>
              {monthTrend !== 0 && (
                <span className={`text-[10px] font-bold ${monthTrend > 0 ? "text-emerald-500" : "text-red-500"} flex items-center gap-0.5`}>
                  {monthTrend > 0 ? <TrendingUp className="w-2.5 h-2.5" /> : <TrendingDown className="w-2.5 h-2.5" />}
                  {monthTrend > 0 ? "+" : ""}{monthTrend}% mo
                </span>
              )}
            </div>
            <p className="text-[10px] text-muted-foreground mt-0.5">{metrics.todayLeads} today / {metrics.weekLeads} this week</p>
          </div>
        </div>

        <div className="relative overflow-hidden bg-card rounded-xl border border-border p-4 shadow-sm">
          <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/15 to-emerald-600/5 pointer-events-none" />
          <div className="relative">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider">Conversion</span>
              <TrendingUp className="w-4 h-4 text-emerald-500" />
            </div>
            <span className="text-3xl font-black text-card-foreground tracking-tight">{conversionRate}%</span>
            <p className="text-[10px] text-muted-foreground mt-0.5">{metrics.completedLeads} purchased / {activeDeals} active</p>
          </div>
        </div>

        <div className="relative overflow-hidden bg-card rounded-xl border border-border p-4 shadow-sm">
          <div className="absolute inset-0 bg-gradient-to-br from-amber-500/15 to-amber-600/5 pointer-events-none" />
          <div className="relative">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider">Pipeline Value</span>
              <DollarSign className="w-4 h-4 text-amber-500" />
            </div>
            <span className="text-3xl font-black text-card-foreground tracking-tight">${(metrics.pendingDealValue / 1000).toFixed(0)}k</span>
            <p className="text-[10px] text-muted-foreground mt-0.5">Avg offer: ${metrics.avgOfferAmount.toLocaleString()}</p>
          </div>
        </div>

        <div className="relative overflow-hidden bg-card rounded-xl border border-border p-4 shadow-sm">
          <div className="absolute inset-0 bg-gradient-to-br from-violet-500/15 to-violet-600/5 pointer-events-none" />
          <div className="relative">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider">Avg Response</span>
              <Clock className="w-4 h-4 text-violet-500" />
            </div>
            <span className="text-3xl font-black text-card-foreground tracking-tight">{metrics.avgResponseDays}d</span>
            <p className="text-[10px] text-muted-foreground mt-0.5">Closed revenue: ${(metrics.closedDealValue / 1000).toFixed(0)}k</p>
          </div>
        </div>
      </div>

      {/* Lead quality indicators */}
      <div className="grid grid-cols-3 gap-3">
        <div className="flex flex-col items-center gap-1 rounded-xl border border-border bg-card p-3 shadow-sm">
          <Flame className="w-4 h-4 text-red-500" />
          <span className="text-lg font-black text-card-foreground">{metrics.hotLeads}</span>
          <span className="text-[10px] text-muted-foreground font-medium">Hot Leads</span>
        </div>
        <div className="flex flex-col items-center gap-1 rounded-xl border border-border bg-card p-3 shadow-sm">
          <Camera className="w-4 h-4 text-blue-500" />
          <span className="text-lg font-black text-card-foreground">{metrics.photosUploaded}</span>
          <span className="text-[10px] text-muted-foreground font-medium">Photos Uploaded</span>
        </div>
        <div className="flex flex-col items-center gap-1 rounded-xl border border-border bg-card p-3 shadow-sm">
          <FileText className="w-4 h-4 text-emerald-500" />
          <span className="text-lg font-black text-card-foreground">{metrics.docsUploaded}</span>
          <span className="text-[10px] text-muted-foreground font-medium">Docs Uploaded</span>
        </div>
      </div>

      {/* Source breakdown */}
      <div className="bg-card rounded-xl border border-border p-4 shadow-sm">
        <h4 className="text-[11px] font-bold text-muted-foreground uppercase tracking-widest mb-3">Lead Sources</h4>
        <div className="space-y-2">
          {metrics.sourceBreakdown.map(src => {
            const pct = metrics.totalLeads > 0 ? Math.round((src.count / metrics.totalLeads) * 100) : 0;
            return (
              <div key={src.key} className="flex items-center gap-3">
                <span className="text-xs text-muted-foreground w-32 shrink-0">{src.label}</span>
                <div className="flex-1 h-6 bg-muted/30 rounded-full overflow-hidden relative">
                  <div
                    className="h-full rounded-full transition-all duration-500 flex items-center justify-end pr-2"
                    style={{ width: `${Math.max(pct, 4)}%`, background: src.color }}
                  >
                    {pct > 15 && <span className="text-[10px] font-bold text-white drop-shadow-sm">{src.count}</span>}
                  </div>
                </div>
                <span className="text-xs font-bold text-card-foreground w-10 text-right">{pct}%</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Pipeline Overview bar */}
      <div className="bg-card rounded-xl border border-border p-4 shadow-sm">
        <h4 className="text-[11px] font-bold text-muted-foreground uppercase tracking-widest mb-3">Pipeline Overview</h4>
        <div className="flex rounded-lg overflow-hidden h-8 bg-muted/30">
          {metrics.stageConversion.map((s, i) => {
            const widthPct = metrics.totalLeads > 0 ? (s.count / metrics.totalLeads) * 100 : 0;
            if (widthPct === 0) return null;
            return (
              <div
                key={s.stage}
                className="relative group flex items-center justify-center transition-all duration-300 hover:brightness-110 cursor-default"
                style={{
                  width: `${Math.max(widthPct, 3)}%`,
                  background: `hsl(${160 + i * 28}, 55%, ${48 - i * 3}%)`,
                }}
                title={`${STAGE_LABELS[s.stage]}: ${s.count} (${s.pct}%)`}
              >
                {widthPct > 8 && (
                  <span className="text-[10px] font-bold text-white drop-shadow-sm">{s.count}</span>
                )}
              </div>
            );
          })}
        </div>
        <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2.5">
          {metrics.stageConversion.map((s, i) => (
            <div key={s.stage} className="flex items-center gap-1.5">
              <div className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ background: `hsl(${160 + i * 28}, 55%, ${48 - i * 3}%)` }} />
              <span className="text-[10px] text-muted-foreground">{STAGE_LABELS[s.stage]}: {s.count}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default DashboardAnalytics;
