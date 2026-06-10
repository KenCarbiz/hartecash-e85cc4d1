/**
 * Lane Dashboard (Admin V2) — the "Lane Tools" workspace landing.
 *
 * A workspace, NOT a merge of the two tools: it shows live lane
 * activity + KPIs and routes into the two separate workflows
 * (Vehicle Check-In and Service Drive Capture), which keep their own
 * pages/users/outcomes. Reads the same useAdminDashboard data — no new
 * data sources. Counts are derived from the loaded leads (a recent
 * snapshot), consistent with the Command Center.
 */
import { useMemo } from "react";
import {
  ScanLine, Zap, RotateCcw, DollarSign, Car, Wrench, ArrowRight,
  CheckCircle2, Clock, Activity as ActivityIcon,
} from "lucide-react";
import type { useAdminDashboard } from "@/hooks/useAdminDashboard";
import { getStatusLabel } from "@/lib/adminConstants";
import { PageShell, Card, SectionLabel, Pill, StatCard, PrimaryButton } from "./theme";

type Db = ReturnType<typeof useAdminDashboard>;

const isToday = (iso: string) => {
  const d = new Date(iso);
  const n = new Date();
  return d.getFullYear() === n.getFullYear() && d.getMonth() === n.getMonth() && d.getDate() === n.getDate();
};
const relTime = (iso: string) => {
  const m = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m} min ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
};

const LaneDashboard = ({ db, onNavigate }: { db: Db; onNavigate: (key: string) => void }) => {
  const subs = db.submissions;

  const m = useMemo(() => {
    const today = subs.filter((s) => isToday(s.created_at));
    const service = subs.filter((s) => s.lead_source === "service");
    const serviceToday = service.filter((s) => isToday(s.created_at));
    const offers = subs.filter((s) => !!s.offered_price);
    const offersToday = offers.filter((s) => isToday(s.created_at));
    return {
      checkedInToday: today.length,
      serviceOps: serviceToday.length || service.length,
      offersSent: offersToday.length || offers.length,
    };
  }, [subs]);

  const recent = useMemo(
    () =>
      [...subs]
        .sort((a, b) => (b.created_at || "").localeCompare(a.created_at || ""))
        .slice(0, 8),
    [subs],
  );

  return (
    <PageShell
      title="Lane Operations"
      subtitle="Vehicle acquisition activity happening right now."
      actions={
        <PrimaryButton onClick={() => onNavigate("inspection-checkin")}>
          <ScanLine className="h-4 w-4" /> Scan a VIN
        </PrimaryButton>
      }
    >
      <div className="space-y-4">
        {/* KPI row */}
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <StatCard label="Vehicles Checked In Today" value={m.checkedInToday} icon={<Car className="h-5 w-5" />} tone="purple" onClick={() => onNavigate("inspection-checkin")} />
          <StatCard label="Service Drive Opportunities" value={m.serviceOps} icon={<Zap className="h-5 w-5" />} tone="teal" onClick={() => onNavigate("service-quick-entry")} />
          <StatCard label="Appraisals Waiting" value={db.appraiserQueueCount} icon={<RotateCcw className="h-5 w-5" />} tone="amber" onClick={() => onNavigate("appraiser-queue")} />
          <StatCard label="Offers Sent" value={m.offersSent} icon={<DollarSign className="h-5 w-5" />} tone="green" />
        </div>

        {/* Action cards */}
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <ActionCard
            icon={<ScanLine className="h-6 w-6" />}
            title="Vehicle Check-In"
            body="Walk the lot, scan VINs, create inspections instantly."
            cta="Open Check-In"
            onClick={() => onNavigate("inspection-checkin")}
            stats={[`Today's scans: ${m.checkedInToday}`, `Appraisals waiting: ${db.appraiserQueueCount}`]}
          />
          <ActionCard
            icon={<Zap className="h-6 w-6" />}
            title="Service Drive Capture"
            body="Capture acquisition opportunities while customers wait for service."
            cta="Open Service Drive"
            onClick={() => onNavigate("service-quick-entry")}
            stats={[`Today's opportunities: ${m.serviceOps}`, `Offers sent: ${m.offersSent}`]}
          />
        </div>

        {/* Recent lane activity */}
        <Card className="overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4">
            <div className="flex items-center gap-2">
              <ActivityIcon className="h-4 w-4 text-[#6D28D9]" />
              <SectionLabel>Recent lane activity</SectionLabel>
            </div>
            <button type="button" onClick={() => onNavigate("submissions")} className="inline-flex items-center gap-1 text-[12px] font-semibold text-[#6D28D9] hover:underline">
              View all leads <ArrowRight className="h-3.5 w-3.5" />
            </button>
          </div>
          <div className="divide-y divide-[#E6EAF0] border-t border-[#E6EAF0]">
            {recent.length === 0 && (
              <div className="px-5 py-8 text-center text-sm text-[#7A879C]">{db.loading ? "Loading lane activity…" : "No activity yet today."}</div>
            )}
            {recent.map((s) => {
              const vehicle = [s.vehicle_year, s.vehicle_make, s.vehicle_model].filter(Boolean).join(" ");
              const isService = s.lead_source === "service";
              const sold = s.progress_status === "purchase_complete";
              return (
                <button key={s.id} type="button" onClick={() => db.handleView(s)} className="flex w-full items-center gap-4 px-5 py-3 text-left transition hover:bg-[#F8FAFC]">
                  <span className={`flex h-9 w-9 items-center justify-center rounded-xl ${isService ? "bg-[#E6FAF7] text-[#0F766E]" : "bg-[#F3F0FF] text-[#6D28D9]"}`}>
                    {isService ? <Wrench className="h-4 w-4" /> : <ScanLine className="h-4 w-4" />}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[13px] font-semibold text-[#06194A]">
                      {s.name || "Unknown"} · {vehicle || "Vehicle pending"}
                    </div>
                    <div className="flex items-center gap-1.5 text-[11px] text-[#9AA6BC]">
                      {sold ? <CheckCircle2 className="h-3 w-3 text-[#0F7A3E]" /> : <Clock className="h-3 w-3" />}
                      {relTime(s.created_at)}
                    </div>
                  </div>
                  <Pill tone={isService ? "teal" : "purple"}>{isService ? "Service Drive" : "Check-In"}</Pill>
                  <span className="hidden text-[12px] text-[#53627A] sm:block">{getStatusLabel(s.progress_status)}</span>
                </button>
              );
            })}
          </div>
        </Card>
      </div>
    </PageShell>
  );
};

const ActionCard = ({
  icon, title, body, cta, onClick, stats,
}: {
  icon: React.ReactNode; title: string; body: string; cta: string; onClick: () => void; stats: string[];
}) => (
  <Card className="flex flex-col p-6">
    <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#EEF0FF] text-[#6D28D9]">{icon}</span>
    <div className="mt-3 text-[17px] font-bold text-[#06194A]">{title}</div>
    <p className="mt-1 flex-1 text-[13px] leading-relaxed text-[#53627A]">{body}</p>
    <div className="mt-4 flex flex-wrap gap-2">
      {stats.map((s) => (
        <span key={s} className="rounded-lg bg-[#F4F6FA] px-2.5 py-1 text-[11px] font-medium text-[#53627A]">{s}</span>
      ))}
    </div>
    <div className="mt-4">
      <PrimaryButton onClick={onClick}>{cta} <ArrowRight className="h-4 w-4" /></PrimaryButton>
    </div>
  </Card>
);

export default LaneDashboard;
