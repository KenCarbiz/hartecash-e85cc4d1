import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { TrendingUp, TrendingDown, Users, DollarSign, Clock, Flame, Camera, FileText, ArrowRight, CalendarDays, Zap } from "lucide-react";

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
  // Source breakdown
  inventoryLeads: number;
  serviceLeads: number;
  // Time-based
  todayLeads: number;
  weekLeads: number;
  monthLeads: number;
  prevMonthLeads: number;
  // Quality
  hotLeads: number;
  photosUploaded: number;
  docsUploaded: number;
  // Funnel conversion per stage
  stageConversion: { stage: string; count: number; pct: number }[];
  // Revenue
  totalOfferedValue: number;
  avgOfferAmount: number;
  pendingDealValue: number;
  closedDealValue: number;
  // Speed
  avgResponseDays: number;
  // Totals
  totalLeads: number;
  completedLeads: number;
  deadLeads: number;
  loading: boolean;
}

const STAGE_LABELS: Record<string, string> = {
  new: "New Lead",
  contacted: "Contacted",
  inspection_scheduled: "Inspection Sched.",
  inspection_completed: "Inspection Done",
  title_verified: "Title Verified",
  ownership_verified: "Ownership Verified",
  appraisal_completed: "Appraisal Done",
  manager_approval: "Mgr Approval",
  price_agreed: "Price Agreed",
  purchase_complete: "Purchased",
};

const FUNNEL_STAGES = [
  "new",
  "contacted",
  "inspection_scheduled",
  "inspection_completed",
  "appraisal_completed",
  "price_agreed",
  "purchase_complete",
];

const DashboardAnalytics = () => {
  const [metrics, setMetrics] = useState<FunnelMetrics>({
    inventoryLeads: 0, serviceLeads: 0,
    todayLeads: 0, weekLeads: 0, monthLeads: 0, prevMonthLeads: 0,
    hotLeads: 0, photosUploaded: 0, docsUploaded: 0,
    stageConversion: [], totalOfferedValue: 0, avgOfferAmount: 0,
    pendingDealValue: 0, closedDealValue: 0, avgResponseDays: 0,
    totalLeads: 0, completedLeads: 0, deadLeads: 0, loading: true,
  });

  useEffect(() => {
    fetchMetrics();
  }, []);

  const fetchMetrics = async () => {
    try {
      const { data: subs } = await supabase
        .from("submissions")
        .select("id, created_at, progress_status, offered_price, estimated_offer_low, estimated_offer_high, acv_value, photos_uploaded, docs_uploaded, is_hot_lead, lead_source, status_updated_at");

      if (!subs) {
        setMetrics(prev => ({ ...prev, loading: false }));
        return;
      }

      const now = new Date();
      const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const weekStart = new Date(todayStart);
      weekStart.setDate(weekStart.getDate() - 7);
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
      const prevMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const prevMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0);

      let inventoryLeads = 0, serviceLeads = 0;
      let todayLeads = 0, weekLeads = 0, monthLeads = 0, prevMonthLeads = 0;
      let hotLeads = 0, photosUploaded = 0, docsUploaded = 0;
      let totalOfferedValue = 0, offeredCount = 0;
      let pendingDealValue = 0, closedDealValue = 0;
      let totalResponseDays = 0, responseCount = 0;
      let completedLeads = 0, deadLeads = 0;

      const statusCounts: Record<string, number> = {};

      subs.forEach((s: SubmissionRow) => {
        const created = new Date(s.created_at);

        // Source
        if (s.lead_source === "service") serviceLeads++;
        else inventoryLeads++;

        // Time
        if (created >= todayStart) todayLeads++;
        if (created >= weekStart) weekLeads++;
        if (created >= monthStart) monthLeads++;
        if (created >= prevMonthStart && created <= prevMonthEnd) prevMonthLeads++;

        // Quality
        if (s.is_hot_lead) hotLeads++;
        if (s.photos_uploaded) photosUploaded++;
        if (s.docs_uploaded) docsUploaded++;

        // Status counts
        const st = s.progress_status || "new";
        statusCounts[st] = (statusCounts[st] || 0) + 1;
        if (st === "purchase_complete") completedLeads++;
        if (st === "dead_lead") deadLeads++;

        // Revenue
        const offerVal = s.offered_price || s.acv_value || 0;
        if (offerVal > 0) {
          totalOfferedValue += offerVal;
          offeredCount++;
          if (st === "purchase_complete") closedDealValue += offerVal;
          else if (st !== "dead_lead") pendingDealValue += offerVal;
        }

        // Response time (creation to first status update)
        if (s.status_updated_at && st !== "new") {
          const updatedAt = new Date(s.status_updated_at);
          const days = (updatedAt.getTime() - created.getTime()) / (1000 * 60 * 60 * 24);
          if (days >= 0 && days < 365) {
            totalResponseDays += days;
            responseCount++;
          }
        }
      });

      // Funnel conversion rates
      const total = subs.length;
      const stageConversion = FUNNEL_STAGES.map(stage => {
        // Count leads that have reached this stage or beyond
        const stageIdx = FUNNEL_STAGES.indexOf(stage);
        const reachedCount = subs.filter(s => {
          const sIdx = FUNNEL_STAGES.indexOf(s.progress_status);
          return sIdx >= stageIdx;
        }).length;
        return {
          stage,
          count: statusCounts[stage] || 0,
          pct: total > 0 ? Math.round((reachedCount / total) * 100) : 0,
        };
      });

      setMetrics({
        inventoryLeads, serviceLeads,
        todayLeads, weekLeads, monthLeads, prevMonthLeads,
        hotLeads, photosUploaded, docsUploaded,
        stageConversion,
        totalOfferedValue,
        avgOfferAmount: offeredCount > 0 ? Math.round(totalOfferedValue / offeredCount) : 0,
        pendingDealValue, closedDealValue,
        avgResponseDays: responseCount > 0 ? Math.round((totalResponseDays / responseCount) * 10) / 10 : 0,
        totalLeads: total, completedLeads, deadLeads,
        loading: false,
      });
    } catch (err) {
      console.error("Analytics error:", err);
      setMetrics(prev => ({ ...prev, loading: false }));
    }
  };

  if (metrics.loading) {
    return <div className="text-sm text-muted-foreground py-4">Loading analytics…</div>;
  }

  const monthTrend = metrics.prevMonthLeads > 0
    ? Math.round(((metrics.monthLeads - metrics.prevMonthLeads) / metrics.prevMonthLeads) * 100)
    : metrics.monthLeads > 0 ? 100 : 0;

  const conversionRate = metrics.totalLeads > 0
    ? Math.round((metrics.completedLeads / metrics.totalLeads) * 1000) / 10
    : 0;

  const activeDeals = metrics.totalLeads - metrics.completedLeads - metrics.deadLeads;

  return (
    <div className="space-y-4">
      {/* Row 1: Primary KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
        <KpiCard label="Today" value={metrics.todayLeads} icon={Zap} color="text-amber-500" bg="from-amber-500/15 to-amber-600/5" />
        <KpiCard label="This Week" value={metrics.weekLeads} icon={CalendarDays} color="text-blue-500" bg="from-blue-500/15 to-blue-600/5" />
        <KpiCard label="This Month" value={metrics.monthLeads} icon={Users} color="text-emerald-500" bg="from-emerald-500/15 to-emerald-600/5"
          badge={monthTrend !== 0 ? { value: `${monthTrend > 0 ? "+" : ""}${monthTrend}%`, positive: monthTrend > 0 } : undefined} />
        <KpiCard label="Conversion" value={`${conversionRate}%`} icon={TrendingUp} color="text-green-500" bg="from-green-500/15 to-green-600/5"
          sub={`${metrics.completedLeads} of ${metrics.totalLeads}`} />
        <KpiCard label="Active Deals" value={activeDeals} icon={DollarSign} color="text-violet-500" bg="from-violet-500/15 to-violet-600/5" />
        <KpiCard label="Avg Response" value={`${metrics.avgResponseDays}d`} icon={Clock} color="text-orange-500" bg="from-orange-500/15 to-orange-600/5" />
      </div>

      {/* Row 2: Source + Quality + Revenue */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {/* Source Breakdown */}
        <div className="bg-card rounded-xl border border-border p-4 shadow-sm">
          <h4 className="text-[11px] font-bold text-muted-foreground uppercase tracking-widest mb-3">Lead Sources</h4>
          <div className="space-y-2">
            <SourceBar label="Inventory" count={metrics.inventoryLeads} total={metrics.totalLeads} color="bg-blue-500" />
            <SourceBar label="Service" count={metrics.serviceLeads} total={metrics.totalLeads} color="bg-emerald-500" />
          </div>
        </div>

        {/* Lead Quality */}
        <div className="bg-card rounded-xl border border-border p-4 shadow-sm">
          <h4 className="text-[11px] font-bold text-muted-foreground uppercase tracking-widest mb-3">Lead Quality</h4>
          <div className="grid grid-cols-3 gap-2">
            <QualityPill icon={Flame} label="Hot" value={metrics.hotLeads} color="text-red-500 bg-red-500/10" />
            <QualityPill icon={Camera} label="Photos" value={metrics.photosUploaded} color="text-blue-500 bg-blue-500/10" />
            <QualityPill icon={FileText} label="Docs" value={metrics.docsUploaded} color="text-emerald-500 bg-emerald-500/10" />
          </div>
        </div>

        {/* Revenue Pipeline */}
        <div className="bg-card rounded-xl border border-border p-4 shadow-sm">
          <h4 className="text-[11px] font-bold text-muted-foreground uppercase tracking-widest mb-3">Revenue Pipeline</h4>
          <div className="space-y-1.5">
            <div className="flex justify-between items-baseline">
              <span className="text-xs text-muted-foreground">Avg Offer</span>
              <span className="text-sm font-bold text-card-foreground">${metrics.avgOfferAmount.toLocaleString()}</span>
            </div>
            <div className="flex justify-between items-baseline">
              <span className="text-xs text-muted-foreground">Pending</span>
              <span className="text-sm font-semibold text-amber-600">${metrics.pendingDealValue.toLocaleString()}</span>
            </div>
            <div className="flex justify-between items-baseline">
              <span className="text-xs text-muted-foreground">Closed</span>
              <span className="text-sm font-semibold text-emerald-600">${metrics.closedDealValue.toLocaleString()}</span>
            </div>
            <div className="h-px bg-border my-1" />
            <div className="flex justify-between items-baseline">
              <span className="text-xs font-semibold text-muted-foreground">Total Pipeline</span>
              <span className="text-sm font-black text-card-foreground">${metrics.totalOfferedValue.toLocaleString()}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Row 3: Funnel Visualization */}
      <div className="bg-card rounded-xl border border-border p-4 shadow-sm">
        <h4 className="text-[11px] font-bold text-muted-foreground uppercase tracking-widest mb-3">Conversion Funnel</h4>
        <div className="flex items-end gap-1 justify-between">
          {metrics.stageConversion.map((s, i) => (
            <div key={s.stage} className="flex-1 flex flex-col items-center gap-1 min-w-0">
              <span className="text-xs font-bold text-card-foreground">{s.count}</span>
              <div className="w-full relative" style={{ height: `${Math.max(s.pct * 0.8, 6)}px` }}>
                <div
                  className="absolute inset-x-0 bottom-0 rounded-t-sm transition-all duration-500"
                  style={{
                    height: "100%",
                    background: `hsl(${140 + i * 25}, 60%, ${50 - i * 2}%)`,
                    opacity: 0.85,
                  }}
                />
              </div>
              <span className="text-[9px] text-muted-foreground font-medium text-center leading-tight truncate w-full">
                {STAGE_LABELS[s.stage] || s.stage}
              </span>
              <span className="text-[9px] text-muted-foreground/60">{s.pct}%</span>
              {i < metrics.stageConversion.length - 1 && (
                <ArrowRight className="w-2.5 h-2.5 text-muted-foreground/30 absolute -right-1.5 top-1/2" style={{ display: "none" }} />
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

// -- Sub-components --

function KpiCard({ label, value, icon: Icon, color, bg, sub, badge }: {
  label: string; value: string | number; icon: React.ElementType; color: string; bg: string;
  sub?: string; badge?: { value: string; positive: boolean };
}) {
  return (
    <div className="relative overflow-hidden bg-card rounded-xl border border-border p-3.5 shadow-sm">
      <div className={`absolute inset-0 bg-gradient-to-br ${bg} pointer-events-none`} />
      <div className="relative">
        <div className="flex items-center justify-between mb-1">
          <span className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wider">{label}</span>
          <Icon className={`w-3.5 h-3.5 ${color}`} />
        </div>
        <div className="flex items-baseline gap-1.5">
          <span className="text-2xl font-black text-card-foreground tracking-tight">{value}</span>
          {badge && (
            <span className={`text-[10px] font-bold ${badge.positive ? "text-emerald-500" : "text-red-500"} flex items-center gap-0.5`}>
              {badge.positive ? <TrendingUp className="w-2.5 h-2.5" /> : <TrendingDown className="w-2.5 h-2.5" />}
              {badge.value}
            </span>
          )}
        </div>
        {sub && <p className="text-[10px] text-muted-foreground mt-0.5">{sub}</p>}
      </div>
    </div>
  );
}

function SourceBar({ label, count, total, color }: { label: string; count: number; total: number; color: string }) {
  const pct = total > 0 ? Math.round((count / total) * 100) : 0;
  return (
    <div className="flex items-center gap-2">
      <span className="text-xs text-muted-foreground w-16 shrink-0">{label}</span>
      <div className="flex-1 h-5 bg-muted/40 rounded-full overflow-hidden">
        <div className={`h-full ${color} rounded-full transition-all duration-500`} style={{ width: `${Math.max(pct, 4)}%` }} />
      </div>
      <span className="text-xs font-bold text-card-foreground w-8 text-right">{count}</span>
      <span className="text-[10px] text-muted-foreground w-8">{pct}%</span>
    </div>
  );
}

function QualityPill({ icon: Icon, label, value, color }: { icon: React.ElementType; label: string; value: number; color: string }) {
  return (
    <div className={`flex flex-col items-center gap-1 rounded-lg p-2 ${color.split(" ")[1]}`}>
      <Icon className={`w-4 h-4 ${color.split(" ")[0]}`} />
      <span className="text-lg font-black text-card-foreground">{value}</span>
      <span className="text-[10px] text-muted-foreground font-medium">{label}</span>
    </div>
  );
}

export default DashboardAnalytics;
