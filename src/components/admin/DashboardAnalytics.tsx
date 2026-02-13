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

      // Calculate average days in pipeline
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

      // Count by status
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

  const KPICard = ({
    icon: Icon,
    label,
    value,
    subtext,
  }: {
    icon: React.ComponentType<{ className?: string }>;
    label: string;
    value: string | number;
    subtext?: string;
  }) => (
    <div className="bg-card rounded-lg border border-border p-4 shadow-sm">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs text-muted-foreground font-semibold uppercase tracking-wide mb-1">
            {label}
          </p>
          <p className="text-2xl font-bold text-card-foreground">{value}</p>
          {subtext && <p className="text-xs text-muted-foreground mt-1">{subtext}</p>}
        </div>
        <Icon className="w-5 h-5 text-muted-foreground/50" />
      </div>
    </div>
  );

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard
          icon={Users}
          label="Total Leads"
          value={analytics.totalLeads}
          subtext={`${analytics.completedLeads} completed`}
        />
        <KPICard
          icon={TrendingUp}
          label="Conversion Rate"
          value={`${analytics.conversionRate}%`}
          subtext={`${analytics.completedLeads}/${analytics.totalLeads} purchases`}
        />
        <KPICard
          icon={Clock}
          label="Avg Days in Pipeline"
          value={analytics.avgDaysInPipeline}
          subtext="from creation"
        />
        <KPICard
          icon={DollarSign}
          label="Active Deals"
          value={
            analytics.totalLeads -
            analytics.completedLeads -
            (analytics.byStatus["dead_lead"] || 0)
          }
          subtext="in progress"
        />
      </div>

      {Object.keys(analytics.byStatus).length > 0 && (
        <div className="bg-card rounded-lg border border-border p-4 shadow-sm">
          <h4 className="text-sm font-semibold text-card-foreground mb-3">
            Leads by Status
          </h4>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
            {Object.entries(analytics.byStatus)
              .sort(([, a], [, b]) => b - a)
              .map(([status, count]) => (
                <div key={status} className="bg-muted/50 rounded-md p-2 text-center">
                  <p className="text-xs text-muted-foreground capitalize font-medium mb-1">
                    {status.replace(/_/g, " ")}
                  </p>
                  <p className="text-lg font-semibold text-card-foreground">{count}</p>
                </div>
              ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default DashboardAnalytics;
