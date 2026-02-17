import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { TrendingUp, Users, DollarSign, Clock } from "lucide-react";

interface AnalyticsData {
  totalLeads: number;
  completedLeads: number;
  conversionRate: number;
  avgDaysInPipeline: number;
  byStatus: Record<string, number>;
  loading: boolean;
}

const PIPELINE_ORDER = [
  "new",
  "contacted",
  "inspection_scheduled",
  "inspection_completed",
  "title_verified",
  "ownership_verified",
  "appraisal_completed",
  "manager_approval",
  "price_agreed",
  "purchase_complete",
  "dead_lead",
];

const PIPELINE_COLORS: Record<string, string> = {
  new: "from-blue-500 to-blue-600",
  contacted: "from-cyan-500 to-cyan-600",
  inspection_scheduled: "from-teal-500 to-teal-600",
  inspection_completed: "from-emerald-500 to-emerald-600",
  title_verified: "from-green-500 to-green-600",
  ownership_verified: "from-lime-500 to-lime-600",
  appraisal_completed: "from-yellow-500 to-yellow-600",
  manager_approval: "from-orange-500 to-orange-600",
  price_agreed: "from-rose-500 to-rose-600",
  purchase_complete: "from-emerald-600 to-emerald-700",
  dead_lead: "from-gray-400 to-gray-500",
};

const DashboardAnalytics = () => {
  const [analytics, setAnalytics] = useState<AnalyticsData>({
    totalLeads: 0,
    completedLeads: 0,
    conversionRate: 0,
    avgDaysInPipeline: 0,
    byStatus: {},
    loading: true,
  });

  useEffect(() => {
    fetchAnalytics();
  }, []);

  const fetchAnalytics = async () => {
    try {
      const { data: submissions } = await supabase
        .from("submissions")
        .select("*");

      if (!submissions) {
        setAnalytics(prev => ({ ...prev, loading: false }));
        return;
      }

      const totalLeads = submissions.length;
      const completedLeads = submissions.filter(
        s => s.progress_status === "purchase_complete"
      ).length;
      const conversionRate = totalLeads > 0 ? (completedLeads / totalLeads) * 100 : 0;

      const now = new Date();
      let totalDays = 0;
      let countForAvg = 0;

      submissions.forEach(s => {
        const createdDate = new Date(s.created_at);
        const days = Math.floor(
          (now.getTime() - createdDate.getTime()) / (1000 * 60 * 60 * 24)
        );
        totalDays += days;
        countForAvg++;
      });

      const avgDaysInPipeline = countForAvg > 0 ? Math.round(totalDays / countForAvg) : 0;

      const byStatus: Record<string, number> = {};
      submissions.forEach(s => {
        const status = s.progress_status || "unknown";
        byStatus[status] = (byStatus[status] || 0) + 1;
      });

      setAnalytics({
        totalLeads,
        completedLeads,
        conversionRate: Math.round(conversionRate * 10) / 10,
        avgDaysInPipeline,
        byStatus,
        loading: false,
      });
    } catch (error) {
      console.error("Failed to fetch analytics", error);
      setAnalytics(prev => ({ ...prev, loading: false }));
    }
  };

  if (analytics.loading) {
    return <div className="text-sm text-muted-foreground">Loading analytics...</div>;
  }

  const kpis = [
    {
      icon: Users,
      label: "Total Leads",
      value: analytics.totalLeads,
      subtext: `${analytics.completedLeads} completed`,
      accent: "from-blue-500/20 to-blue-600/10",
      iconColor: "text-blue-500",
    },
    {
      icon: TrendingUp,
      label: "Conversion Rate",
      value: `${analytics.conversionRate}%`,
      subtext: `${analytics.completedLeads}/${analytics.totalLeads} purchases`,
      accent: "from-emerald-500/20 to-emerald-600/10",
      iconColor: "text-emerald-500",
    },
    {
      icon: Clock,
      label: "Avg Days in Pipeline",
      value: analytics.avgDaysInPipeline,
      subtext: "from creation",
      accent: "from-amber-500/20 to-amber-600/10",
      iconColor: "text-amber-500",
    },
    {
      icon: DollarSign,
      label: "Active Deals",
      value:
        analytics.totalLeads -
        analytics.completedLeads -
        (analytics.byStatus["dead_lead"] || 0),
      subtext: "in progress",
      accent: "from-violet-500/20 to-violet-600/10",
      iconColor: "text-violet-500",
    },
  ];

  // Ordered pipeline entries
  const pipelineEntries = PIPELINE_ORDER
    .filter(key => analytics.byStatus[key] && analytics.byStatus[key] > 0)
    .map(key => ({ key, count: analytics.byStatus[key] }));

  const maxCount = Math.max(...pipelineEntries.map(e => e.count), 1);

  return (
    <div className="space-y-5">
      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {kpis.map((kpi) => (
          <div
            key={kpi.label}
            className="relative overflow-hidden bg-card rounded-xl border border-border p-5 shadow-sm hover:shadow-md transition-shadow"
          >
            <div className={`absolute inset-0 bg-gradient-to-br ${kpi.accent} pointer-events-none`} />
            <div className="relative flex items-start justify-between">
              <div>
                <p className="text-xs text-muted-foreground font-semibold uppercase tracking-wide mb-1.5">
                  {kpi.label}
                </p>
                <p className="text-3xl font-black text-card-foreground tracking-tight">{kpi.value}</p>
                {kpi.subtext && <p className="text-xs text-muted-foreground mt-1">{kpi.subtext}</p>}
              </div>
              <div className={`w-10 h-10 rounded-lg bg-card flex items-center justify-center shadow-sm ${kpi.iconColor}`}>
                <kpi.icon className="w-5 h-5" />
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Pipeline Visualization */}
      {pipelineEntries.length > 0 && (
        <div className="bg-card rounded-xl border border-border p-5 shadow-sm">
          <h4 className="text-sm font-bold text-card-foreground mb-4 tracking-wide uppercase">
            Pipeline Overview
          </h4>
          <div className="space-y-2.5">
            {pipelineEntries.map(({ key, count }) => (
              <div key={key} className="flex items-center gap-3">
                <span className="text-xs text-muted-foreground font-medium capitalize w-40 shrink-0 truncate">
                  {key.replace(/_/g, " ")}
                </span>
                <div className="flex-1 h-7 bg-muted/50 rounded-full overflow-hidden relative">
                  <div
                    className={`h-full bg-gradient-to-r ${PIPELINE_COLORS[key] || "from-gray-400 to-gray-500"} rounded-full transition-all duration-700 ease-out flex items-center justify-end pr-3`}
                    style={{ width: `${Math.max((count / maxCount) * 100, 12)}%` }}
                  >
                    <span className="text-xs font-bold text-white drop-shadow-sm">{count}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default DashboardAnalytics;
