/**
 * Unified Command Center — the V2 landing page.
 *
 * Consolidates the headline KPIs (leads, active deals, pipeline value,
 * conversion, schedule) and the three primary quick actions into a
 * single airy view. Reads from the same useAdminDashboard data the rest
 * of admin uses — no new data sources — so it stays in lockstep with V1.
 *
 * The layout is configurable: "Customize" enters an edit mode where the
 * dealer can drag widgets to reorder them and toggle their visibility.
 * Preferences persist per-user via useDashboardLayout (localStorage).
 *
 * Note on scope: counts that span the whole book of business (Total
 * Leads, Appointments, Appraiser Queue) come from server-side totals.
 * The deal/pipeline/conversion tiles and the charts are derived from the
 * currently-loaded leads page and are labelled as a recent snapshot so
 * they never over-claim.
 */
import { useMemo, useState, type ReactNode } from "react";
import { Reorder, useDragControls } from "framer-motion";
import {
  Inbox, CalendarDays, RotateCcw, TrendingUp, DollarSign, Target,
  Plus, CalendarPlus, ClipboardCheck, ArrowRight,
  GripVertical, Eye, EyeOff, Settings2, Check,
} from "lucide-react";
import {
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid,
} from "recharts";
import type { useAdminDashboard } from "@/hooks/useAdminDashboard";
import {
  ACCEPTED_NO_APPOINTMENT_STATUSES, ACCEPTED_WITH_APPOINTMENT_STATUSES,
  getStatusLabel, type Submission,
} from "@/lib/adminConstants";
import {
  PageShell, Card, SectionLabel, StatCard, Pill, PrimaryButton, SecondaryButton,
} from "./theme";
import { useDashboardLayout, type WidgetId } from "./useDashboardLayout";
import { useAdminKpis } from "./useAdminKpis";

type Db = ReturnType<typeof useAdminDashboard>;

const ACCEPTED = new Set<string>([
  ...ACCEPTED_NO_APPOINTMENT_STATUSES,
  ...ACCEPTED_WITH_APPOINTMENT_STATUSES,
]);
const CLOSED = new Set<string>(["purchase_complete", "check_request_submitted"]);

const currency = (n: number) =>
  n >= 1000 ? `$${(n / 1000).toFixed(n >= 10000 ? 0 : 1)}k` : `$${n}`;

const WIDGET_LABELS: Record<WidgetId, string> = {
  kpis: "Key metrics",
  operations: "Operations & quick actions",
  analytics: "Lead trend & pipeline",
  recent: "Recent activity",
};

/** Edit-mode wrapper: drag handle + visibility toggle around a widget. */
const EditableWidget = ({
  id,
  hidden,
  onToggle,
  children,
}: {
  id: WidgetId;
  hidden: boolean;
  onToggle: () => void;
  children: ReactNode;
}) => {
  const controls = useDragControls();
  return (
    <Reorder.Item
      value={id}
      dragListener={false}
      dragControls={controls}
      className="rounded-2xl border border-dashed border-[#C9B8F0] bg-[#FAF8FF] p-2"
    >
      <div className="mb-2 flex items-center justify-between px-1">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onPointerDown={(e) => controls.start(e)}
            className="cursor-grab touch-none rounded-md p-1 text-[#9AA6BC] hover:bg-white hover:text-[#6D28D9] active:cursor-grabbing"
            aria-label="Drag to reorder"
          >
            <GripVertical className="h-4 w-4" />
          </button>
          <span className="text-[12px] font-semibold text-[#6D28D9]">{WIDGET_LABELS[id]}</span>
        </div>
        <button
          type="button"
          onClick={onToggle}
          className="inline-flex items-center gap-1.5 rounded-lg border border-[#E6EAF0] bg-white px-2 py-1 text-[11px] font-semibold text-[#53627A] transition hover:text-[#6D28D9]"
        >
          {hidden ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
          {hidden ? "Hidden" : "Visible"}
        </button>
      </div>
      {hidden ? (
        <div className="rounded-xl bg-white/60 px-3 py-6 text-center text-[12px] text-[#9AA6BC]">
          Hidden — toggle to show on your dashboard
        </div>
      ) : (
        children
      )}
    </Reorder.Item>
  );
};

const CommandCenter = ({
  db,
  onNavigate,
}: {
  db: Db;
  onNavigate: (key: string) => void;
}) => {
  const subs = db.submissions;
  const layout = useDashboardLayout(db.userId);
  const [editMode, setEditMode] = useState(false);

  // Exact, full-book aggregates when the get_admin_kpis RPC is deployed;
  // otherwise undefined and we fall back to the loaded-page snapshot.
  const { data: kpis } = useAdminKpis(db.tenant.dealership_id, db.userRole, db.userEmail);
  const exact = !!kpis;

  // Loaded-page snapshot — used until exact KPIs are available.
  const snapshot = useMemo(() => {
    const isActive = (s: Submission) =>
      !CLOSED.has(s.progress_status) &&
      s.progress_status !== "dead_lead" &&
      (!!s.offered_price || ACCEPTED.has(s.progress_status));
    const active = subs.filter(isActive);
    const pipeline = active.reduce((sum, s) => sum + (s.offered_price || 0), 0);
    const accepted = subs.filter(
      (s) => !!s.offered_price || ACCEPTED.has(s.progress_status) || CLOSED.has(s.progress_status),
    ).length;
    const conversion = subs.length ? Math.round((accepted / subs.length) * 100) : 0;
    return { activeCount: active.length, pipeline, conversion };
  }, [subs]);

  const stats = {
    activeCount: kpis?.active_deals ?? snapshot.activeCount,
    pipeline: kpis?.pipeline_value ?? snapshot.pipeline,
    conversion: kpis?.conversion_pct ?? snapshot.conversion,
  };
  const totalLeads = kpis?.total_leads ?? db.total;

  // Format a YYYY-MM-DD key into a short "Mon D" axis label.
  const dayLabel = (key: string) => {
    const d = new Date(`${key}T00:00:00Z`);
    return d.toLocaleDateString(undefined, { month: "short", day: "numeric", timeZone: "UTC" });
  };

  // 14-day lead intake trend — exact from RPC, else from loaded leads.
  const trend = useMemo(() => {
    if (kpis) {
      return kpis.trend.map((t) => ({ label: dayLabel(t.date), leads: t.leads }));
    }
    const days: { label: string; key: string; leads: number }[] = [];
    const today = new Date();
    for (let i = 13; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(today.getDate() - i);
      const key = d.toISOString().slice(0, 10);
      days.push({ key, label: dayLabel(key), leads: 0 });
    }
    const idx = new Map(days.map((d, i) => [d.key, i]));
    for (const s of subs) {
      const k = (s.created_at || "").slice(0, 10);
      const i = idx.get(k);
      if (i !== undefined) days[i].leads += 1;
    }
    return days;
  }, [kpis, subs]);

  // Status distribution (top buckets) — exact from RPC, else loaded leads.
  const distribution = useMemo(() => {
    const entries: [string, number][] = kpis
      ? kpis.by_status.map((b) => [b.status, b.n])
      : (() => {
          const counts = new Map<string, number>();
          for (const s of subs) counts.set(s.progress_status, (counts.get(s.progress_status) || 0) + 1);
          return [...counts.entries()];
        })();
    const total = (kpis ? kpis.total_leads : subs.length) || 1;
    return entries
      .map(([status, n]) => ({ status, label: getStatusLabel(status), n, pct: Math.round((n / total) * 100) }))
      .sort((a, b) => b.n - a.n)
      .slice(0, 6);
  }, [kpis, subs]);

  const recent = useMemo(
    () =>
      [...subs]
        .sort((a, b) => (b.created_at || "").localeCompare(a.created_at || ""))
        .slice(0, 6),
    [subs],
  );

  // ── Widget bodies ──
  const widgets: Record<WidgetId, ReactNode> = {
    kpis: (
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard
          label="Total Leads"
          value={totalLeads.toLocaleString()}
          hint="All-time submissions"
          icon={<Inbox className="h-5 w-5" />}
          tone="purple"
          onClick={() => onNavigate("submissions")}
        />
        <StatCard
          label="Active Deals"
          value={stats.activeCount.toLocaleString()}
          hint="Accepted / in progress"
          icon={<TrendingUp className="h-5 w-5" />}
          tone="teal"
          onClick={() => onNavigate("submissions")}
        />
        <StatCard
          label="Pipeline Value"
          value={currency(stats.pipeline)}
          hint="Offered on active deals"
          icon={<DollarSign className="h-5 w-5" />}
          tone="green"
        />
        <StatCard
          label="Conversion"
          value={`${stats.conversion}%`}
          hint="Recent leads accepted"
          icon={<Target className="h-5 w-5" />}
          tone="amber"
        />
      </div>
    ),
    operations: (
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard
          label="Appointments"
          value={db.appointments.length.toLocaleString()}
          hint="Scheduled visits"
          icon={<CalendarDays className="h-5 w-5" />}
          tone="purple"
          onClick={() => onNavigate("accepted-appts")}
        />
        <StatCard
          label="Appraiser Queue"
          value={db.appraiserQueueCount.toLocaleString()}
          hint="Awaiting appraisal"
          icon={<RotateCcw className="h-5 w-5" />}
          tone="red"
          onClick={() => onNavigate("appraiser-queue")}
        />
        <div className="col-span-2">
          <Card className="flex h-full flex-col justify-between p-5">
            <SectionLabel>Quick actions</SectionLabel>
            <div className="mt-3 grid grid-cols-3 gap-2">
              {[
                { label: "Create Lead", icon: Plus, key: "submissions" },
                { label: "Schedule", icon: CalendarPlus, key: "accepted-appts" },
                { label: "Inspection", icon: ClipboardCheck, key: "inspection-checkin" },
              ].map((a) => (
                <button
                  key={a.key}
                  type="button"
                  onClick={() => onNavigate(a.key)}
                  className="flex flex-col items-center gap-1.5 rounded-xl border border-[#E6EAF0] bg-[#F8FAFC] px-2 py-3 text-[12px] font-semibold text-[#06194A] transition hover:border-[#6D28D9]/40 hover:bg-white hover:text-[#6D28D9]"
                >
                  <a.icon className="h-4 w-4" />
                  {a.label}
                </button>
              ))}
            </div>
          </Card>
        </div>
      </div>
    ),
    analytics: (
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card className="p-5 lg:col-span-2">
          <div className="flex items-center justify-between">
            <div>
              <SectionLabel>Lead intake</SectionLabel>
              <div className="mt-1 text-[15px] font-semibold text-[#06194A]">Last 14 days</div>
            </div>
            <Pill tone={exact ? "teal" : "purple"}>{exact ? "Live totals" : "Recent snapshot"}</Pill>
          </div>
          <div className="mt-4 h-[220px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={trend} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="v2leads" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#6D28D9" stopOpacity={0.28} />
                    <stop offset="100%" stopColor="#6D28D9" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#EEF1F6" vertical={false} />
                <XAxis
                  dataKey="label"
                  tick={{ fontSize: 11, fill: "#9AA6BC" }}
                  axisLine={false}
                  tickLine={false}
                  interval="preserveStartEnd"
                  minTickGap={24}
                />
                <YAxis
                  tick={{ fontSize: 11, fill: "#9AA6BC" }}
                  axisLine={false}
                  tickLine={false}
                  allowDecimals={false}
                  width={32}
                />
                <Tooltip
                  contentStyle={{
                    borderRadius: 12,
                    border: "1px solid #E6EAF0",
                    fontSize: 12,
                    boxShadow: "0 8px 24px -12px rgba(15,23,42,0.2)",
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="leads"
                  stroke="#6D28D9"
                  strokeWidth={2.5}
                  fill="url(#v2leads)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card className="p-5">
          <SectionLabel>Pipeline by status</SectionLabel>
          <div className="mt-4 space-y-3">
            {distribution.length === 0 && (
              <p className="text-sm text-[#7A879C]">No leads loaded yet.</p>
            )}
            {distribution.map((d) => (
              <div key={d.status}>
                <div className="flex items-center justify-between text-[12px]">
                  <span className="truncate font-medium text-[#3B4763]">{d.label}</span>
                  <span className="text-[#7A879C]">{d.n}</span>
                </div>
                <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-[#F0F2F7]">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-[#6D28D9] to-[#0D9488]"
                    style={{ width: `${Math.max(d.pct, 4)}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>
    ),
    recent: (
      <Card className="overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4">
          <div>
            <SectionLabel>Recent activity</SectionLabel>
            <div className="mt-1 text-[15px] font-semibold text-[#06194A]">Latest leads</div>
          </div>
          <button
            type="button"
            onClick={() => onNavigate("submissions")}
            className="inline-flex items-center gap-1 text-[12px] font-semibold text-[#6D28D9] hover:underline"
          >
            View all <ArrowRight className="h-3.5 w-3.5" />
          </button>
        </div>
        <div className="divide-y divide-[#F0F2F7] border-t border-[#F0F2F7]">
          {recent.length === 0 && (
            <div className="px-5 py-8 text-center text-sm text-[#7A879C]">
              {db.loading ? "Loading leads…" : "No leads yet."}
            </div>
          )}
          {recent.map((s) => {
            const vehicle = [s.vehicle_year, s.vehicle_make, s.vehicle_model]
              .filter(Boolean)
              .join(" ");
            const closed = CLOSED.has(s.progress_status);
            const dead = s.progress_status === "dead_lead";
            const accepted = !!s.offered_price || ACCEPTED.has(s.progress_status);
            return (
              <button
                key={s.id}
                type="button"
                onClick={() => db.handleView(s)}
                className="flex w-full items-center gap-4 px-5 py-3 text-left transition hover:bg-[#F8FAFC]"
              >
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[13px] font-semibold text-[#06194A]">
                    {s.name || "Unknown"}
                  </div>
                  <div className="truncate text-[12px] text-[#7A879C]">
                    {vehicle || "Vehicle pending"}
                  </div>
                </div>
                {s.offered_price ? (
                  <span className="hidden text-[13px] font-semibold text-[#0F7A3E] sm:block">
                    {currency(s.offered_price)}
                  </span>
                ) : null}
                <Pill tone={closed ? "green" : dead ? "red" : accepted ? "teal" : "purple"}>
                  {getStatusLabel(s.progress_status)}
                </Pill>
              </button>
            );
          })}
        </div>
      </Card>
    ),
  };

  return (
    <PageShell
      title="Command Center"
      subtitle="Your dealership at a glance — leads, deals and today's schedule in one view."
      actions={
        editMode ? (
          <>
            <SecondaryButton onClick={layout.reset}>
              <RotateCcw className="h-4 w-4" /> Reset layout
            </SecondaryButton>
            <PrimaryButton onClick={() => setEditMode(false)}>
              <Check className="h-4 w-4" /> Done
            </PrimaryButton>
          </>
        ) : (
          <>
            <SecondaryButton onClick={() => setEditMode(true)}>
              <Settings2 className="h-4 w-4" /> Customize
            </SecondaryButton>
            <SecondaryButton onClick={() => onNavigate("accepted-appts")}>
              <CalendarPlus className="h-4 w-4" /> Schedule
            </SecondaryButton>
            <PrimaryButton onClick={() => onNavigate("submissions")}>
              <Plus className="h-4 w-4" /> View Leads
            </PrimaryButton>
          </>
        )
      }
    >
      {editMode ? (
        <Reorder.Group
          axis="y"
          values={layout.order}
          onReorder={layout.reorder}
          className="space-y-4"
        >
          {layout.order.map((id) => (
            <EditableWidget
              key={id}
              id={id}
              hidden={layout.isHidden(id)}
              onToggle={() => layout.toggle(id)}
            >
              {widgets[id]}
            </EditableWidget>
          ))}
        </Reorder.Group>
      ) : (
        <div className="space-y-4">
          {layout.order
            .filter((id) => !layout.isHidden(id))
            .map((id) => (
              <div key={id}>{widgets[id]}</div>
            ))}
        </div>
      )}
    </PageShell>
  );
};

export default CommandCenter;
