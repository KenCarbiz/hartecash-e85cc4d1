/**
 * Website Acquisition Widget (Admin V2) — outcome-focused redesign of
 * the Trade Widget page.
 *
 * Leads with results, not embed code: KPIs, a live customer-experience
 * preview (real /embed iframe), a performance snapshot, widget types,
 * optimization recommendations, and widget health. The technical
 * settings + install code are preserved and pushed to the bottom via a
 * "Widget settings & install" toggle that mounts the existing
 * TradeWidgetAdmin (live preview, toggles, embed script — all intact).
 *
 * REAL: KPIs (leads this month / offers / vehicles) from submissions,
 * the live preview iframe, the 14-day trend, and the full settings/embed
 * tool. PREVIEW ("Soon"): views/starts/conversion (no widget-view
 * tracking yet), health checks, and recommendations.
 */
import { lazy, Suspense, useEffect, useMemo, useState } from "react";
import {
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid,
} from "recharts";
import {
  Monitor, Smartphone, DollarSign, CheckCircle2, Inbox, Percent, Eye,
  MousePointerClick, Settings2, PanelRightOpen, LayoutTemplate, Wrench,
  Sparkles, ShieldCheck, Gauge, Activity as ActivityIcon, CircleCheck, CircleAlert,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import type { useAdminDashboard } from "@/hooks/useAdminDashboard";
import { cn } from "@/lib/utils";
import { PageShell, Card, SectionLabel, Pill, StatCard, SecondaryButton, Loading } from "./theme";
import InstallPanel from "./InstallPanel";

const TradeWidgetAdmin = lazy(() => import("@/components/admin/TradeWidgetAdmin"));

type Db = ReturnType<typeof useAdminDashboard>;
const SoonChip = () => <Pill tone="gray">Soon</Pill>;

const WIDGET_TYPES = [
  { icon: PanelRightOpen, name: "Slide-Out Experience", desc: "Appears from the right. Recommended.", rec: true },
  { icon: MousePointerClick, name: "Floating Trade Widget", desc: "Follows visitors site-wide. Highest conversion." },
  { icon: LayoutTemplate, name: "Embedded Trade Form", desc: "Inline on VDP / landing pages." },
  { icon: Wrench, name: "Service Drive Widget", desc: "Targets service-lane customers." },
];

const HEALTH = [
  { label: "Installation", icon: ShieldCheck },
  { label: "Load Speed", icon: Gauge },
  { label: "Mobile", icon: Smartphone },
  { label: "Tracking", icon: ActivityIcon },
  { label: "SSL", icon: ShieldCheck },
];

const RECS = [
  { title: "Expand VDP coverage", body: "Install the widget on every vehicle detail page to capture more in-market shoppers.", lift: "+18%" },
  { title: "Enable a floating CTA on mobile", body: "Mobile conversion trails desktop — a floating button lifts mobile starts.", lift: "+11%" },
];

const WebsiteWidget = ({ db }: { db: Db; onNavigate: (key: string) => void }) => {
  const dealershipId = db.tenant.dealership_id;
  const [device, setDevice] = useState<"desktop" | "mobile">("desktop");
  const [manage, setManage] = useState(false);
  const [kpi, setKpi] = useState({ leads: 0, offers: 0, purchased: 0 });

  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const previewUrl = `${origin}/embed/${encodeURIComponent(dealershipId)}`;

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const monthStart = new Date();
      monthStart.setDate(1); monthStart.setHours(0, 0, 0, 0);
      const iso = monthStart.toISOString();
      const [leadsR, offersR, purchasedR] = await Promise.all([
        supabase.from("submissions").select("id", { count: "exact", head: true }).eq("dealership_id", dealershipId).gte("created_at", iso),
        supabase.from("submissions").select("id", { count: "exact", head: true }).eq("dealership_id", dealershipId).not("offered_price", "is", null),
        supabase.from("submissions").select("id", { count: "exact", head: true }).eq("dealership_id", dealershipId).eq("progress_status", "purchase_complete"),
      ]);
      if (!cancelled) setKpi({ leads: leadsR.count || 0, offers: offersR.count || 0, purchased: purchasedR.count || 0 });
    })();
    return () => { cancelled = true; };
  }, [dealershipId]);

  const trend = useMemo(() => {
    const days: { label: string; key: string; leads: number }[] = [];
    const today = new Date();
    for (let i = 13; i >= 0; i--) {
      const d = new Date(today); d.setDate(today.getDate() - i);
      const key = d.toISOString().slice(0, 10);
      days.push({ key, label: d.toLocaleDateString(undefined, { month: "short", day: "numeric" }), leads: 0 });
    }
    const idx = new Map(days.map((d, i) => [d.key, i]));
    for (const s of db.submissions) {
      const i = idx.get((s.created_at || "").slice(0, 10));
      if (i !== undefined) days[i].leads += 1;
    }
    return days;
  }, [db.submissions]);

  return (
    <PageShell
      title="Website Acquisition Widget"
      subtitle="Your on-site trade & sell experience — installed, converting, generating offers."
      actions={
        <div className="flex items-center gap-2">
          <Pill tone="green"><CircleCheck className="h-3 w-3" /> Live</Pill>
          <SecondaryButton onClick={() => setManage((v) => !v)}>
            <Settings2 className="h-4 w-4" /> {manage ? "Hide advanced" : "Advanced settings"}
          </SecondaryButton>
        </div>
      }
    >
      <div className="space-y-4">
        {/* KPIs */}
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <StatCard label="Leads This Month" value={kpi.leads} icon={<Inbox className="h-5 w-5" />} tone="purple" />
          <StatCard label="Offers Generated" value={kpi.offers} icon={<DollarSign className="h-5 w-5" />} tone="teal" />
          <StatCard label="Vehicles Purchased" value={kpi.purchased} icon={<CheckCircle2 className="h-5 w-5" />} tone="green" />
          <StatCard label="Conversion Rate" value="—" hint={<SoonChip />} icon={<Percent className="h-5 w-5" />} tone="gray" />
        </div>

        {/* Live experience preview — the hero */}
        <Card className="p-5">
          <div className="flex items-center justify-between">
            <div>
              <SectionLabel>Customer experience</SectionLabel>
              <div className="mt-1 text-[15px] font-semibold text-[#06194A]">Live preview</div>
            </div>
            <div className="flex items-center gap-1 rounded-xl border border-[#E6EAF0] bg-white p-1">
              {(["desktop", "mobile"] as const).map((d) => (
                <button key={d} onClick={() => setDevice(d)} className={cn("inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[12px] font-semibold capitalize transition", device === d ? "bg-[#6D28D9] text-white" : "text-[#53627A] hover:bg-[#F4F6FA]")}>
                  {d === "desktop" ? <Monitor className="h-4 w-4" /> : <Smartphone className="h-4 w-4" />} {d}
                </button>
              ))}
            </div>
          </div>
          <div className="mt-4 flex justify-center rounded-2xl bg-[#F4F6FA] p-4">
            <div className={cn("overflow-hidden rounded-xl border border-[#E6EAF0] bg-white shadow-sm transition-all", device === "mobile" ? "w-[390px] max-w-full" : "w-full")} style={{ height: 520 }}>
              <iframe src={previewUrl} title="Widget live preview" className="h-full w-full" loading="lazy" />
            </div>
          </div>
        </Card>

        {/* Performance */}
        <Card className="p-5">
          <div className="flex items-center justify-between">
            <SectionLabel>Widget performance</SectionLabel>
            <Pill tone="purple">Last 14 days</Pill>
          </div>
          <div className="mt-3 grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Perf label="Views" value="—" soon icon={<Eye className="h-4 w-4" />} />
            <Perf label="Starts" value="—" soon icon={<MousePointerClick className="h-4 w-4" />} />
            <Perf label="Offers" value={kpi.offers} icon={<DollarSign className="h-4 w-4" />} />
            <Perf label="Purchased" value={kpi.purchased} icon={<CheckCircle2 className="h-4 w-4" />} />
          </div>
          <div className="mt-4 h-[200px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={trend} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="wleads" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#6D28D9" stopOpacity={0.28} />
                    <stop offset="100%" stopColor="#6D28D9" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#EEF1F6" vertical={false} />
                <XAxis dataKey="label" tick={{ fontSize: 11, fill: "#9AA6BC" }} axisLine={false} tickLine={false} interval={1} />
                <YAxis tick={{ fontSize: 11, fill: "#9AA6BC" }} axisLine={false} tickLine={false} allowDecimals={false} width={32} />
                <Tooltip contentStyle={{ borderRadius: 12, border: "1px solid #E6EAF0", fontSize: 12 }} />
                <Area type="monotone" dataKey="leads" stroke="#6D28D9" strokeWidth={2.5} fill="url(#wleads)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
          <p className="mt-1 text-[11px] text-[#9AA6BC]">Lead intake (recent). View / start / conversion tracking arrives with widget analytics.</p>
        </Card>

        {/* Recommendations */}
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {RECS.map((r) => (
            <Card key={r.title} className="flex items-start gap-3 p-5">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#F3F0FF] text-[#6D28D9]"><Sparkles className="h-5 w-5" /></span>
              <div className="flex-1">
                <div className="flex items-center justify-between gap-2">
                  <div className="text-[14px] font-semibold text-[#06194A]">{r.title}</div>
                  <Pill tone="green">Lift {r.lift}</Pill>
                </div>
                <p className="mt-1 text-[12px] text-[#53627A]">{r.body}</p>
              </div>
            </Card>
          ))}
        </div>

        {/* Widget types */}
        <Card className="p-5">
          <SectionLabel>Widget types</SectionLabel>
          <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {WIDGET_TYPES.map((w) => (
              <div key={w.name} className={cn("rounded-xl border p-4", w.rec ? "border-[#6D28D9]/40 bg-[#FAF8FF]" : "border-[#E6EAF0]")}>
                <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-[#6D28D9] to-[#0D9488] text-white"><w.icon className="h-5 w-5" /></span>
                <div className="mt-2 flex items-center gap-1.5 text-[13px] font-semibold text-[#06194A]">{w.name}{w.rec && <Pill tone="purple">Recommended</Pill>}</div>
                <p className="mt-1 text-[12px] text-[#7A879C]">{w.desc}</p>
                <button onClick={() => setManage(true)} className="mt-2 text-[12px] font-semibold text-[#6D28D9] hover:underline">Configure →</button>
              </div>
            ))}
          </div>
        </Card>

        {/* Widget health */}
        <Card className="p-5">
          <div className="flex items-center justify-between"><SectionLabel>Widget health</SectionLabel><SoonChip /></div>
          <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
            {HEALTH.map((h) => (
              <div key={h.label} className="flex items-center gap-2 rounded-xl border border-[#F0F2F7] px-3 py-2.5">
                <h.icon className="h-4 w-4 text-[#9AA6BC]" />
                <div><div className="text-[12px] font-semibold text-[#06194A]">{h.label}</div><div className="flex items-center gap-1 text-[11px] text-[#9AA6BC]"><CircleAlert className="h-3 w-3" /> Pending</div></div>
              </div>
            ))}
          </div>
        </Card>

        {/* Install (per-provider chooser + real snippet) */}
        <InstallPanel dealershipId={dealershipId} />

        {/* Advanced settings (preserves the real admin) */}
        {manage && (
          <Card className="p-5">
            <SectionLabel>Advanced settings &amp; embed variants</SectionLabel>
            <div className="mt-3">
              <Suspense fallback={<Loading label="Loading widget settings…" />}>
                <TradeWidgetAdmin />
              </Suspense>
            </div>
          </Card>
        )}
      </div>
    </PageShell>
  );
};

const Perf = ({ label, value, soon, icon }: { label: string; value: string | number; soon?: boolean; icon: React.ReactNode }) => (
  <div className="rounded-xl border border-[#F0F2F7] bg-[#FAFBFD] p-3">
    <div className="flex items-center gap-1.5 text-[11px] font-medium text-[#9AA6BC]"><span className="text-[#6D28D9]">{icon}</span>{label}{soon && <SoonChip />}</div>
    <div className="mt-1 text-[22px] font-bold text-[#06194A]">{value}</div>
  </div>
);

export default WebsiteWidget;
