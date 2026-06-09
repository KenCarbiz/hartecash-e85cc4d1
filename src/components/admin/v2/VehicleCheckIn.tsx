/**
 * Vehicle Check-In (Admin V2) — outcome-focused redesign of the
 * Inspection Check-In launcher.
 *
 * Replaces the single generic "Open Check-In" card with a premium lane
 * surface: a scan hero, three action tiles (Scan VIN / Existing Lead /
 * Walk-In), a today tracker, and a today's-activity list. The real
 * tablet capture flow stays at /inspection-checkin, launched from here.
 *
 * Metrics derive from the loaded leads (recent snapshot), consistent
 * with the Lane Dashboard + Command Center.
 */
import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import {
  ScanLine, Search, UserPlus, ArrowRight, Car, RotateCcw, ClipboardCheck,
  CheckCircle2, Clock,
} from "lucide-react";
import type { useAdminDashboard } from "@/hooks/useAdminDashboard";
import { getStatusLabel } from "@/lib/adminConstants";
import { PageShell, Card, SectionLabel, Pill, StatCard, PrimaryButton } from "./theme";

type Db = ReturnType<typeof useAdminDashboard>;

const isToday = (iso: string) => {
  const d = new Date(iso); const n = new Date();
  return d.getFullYear() === n.getFullYear() && d.getMonth() === n.getMonth() && d.getDate() === n.getDate();
};
const relTime = (iso: string) => {
  const m = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  return h < 24 ? `${h}h ago` : `${Math.floor(h / 24)}d ago`;
};

const VehicleCheckIn = ({ db, onNavigate }: { db: Db; onNavigate: (key: string) => void }) => {
  const navigate = useNavigate();
  const open = () => navigate("/inspection-checkin");

  const m = useMemo(() => {
    const subs = db.submissions;
    const today = subs.filter((s) => isToday(s.created_at));
    const completed = subs.filter((s) => s.progress_status === "inspection_completed" && isToday(s.created_at)).length;
    return { today: today.length, completed };
  }, [db.submissions]);

  const recent = useMemo(
    () => [...db.submissions].filter((s) => isToday(s.created_at)).sort((a, b) => (b.created_at || "").localeCompare(a.created_at || "")).slice(0, 8),
    [db.submissions],
  );

  return (
    <PageShell
      title="Vehicle Check-In"
      subtitle="Walk the lot, scan VINs, and create inspections in seconds."
      actions={<PrimaryButton onClick={open}><ScanLine className="h-4 w-4" /> Scan a VIN</PrimaryButton>}
    >
      <div className="space-y-4">
        {/* Scan hero */}
        <Card className="overflow-hidden border-0 bg-gradient-to-br from-[#06194A] to-[#1E2A6B] p-6 text-white">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="max-w-lg">
              <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-white/70">Tablet-ready</div>
              <h2 className="mt-1 text-[22px] font-bold">Scan a VIN to start an inspection</h2>
              <p className="mt-1 text-[13px] text-white/85">Scan the door-jamb VIN, match an existing lead or create a walk-in, and jump straight into the inspection.</p>
            </div>
            <button onClick={open} className="inline-flex items-center gap-2 rounded-xl bg-white px-5 py-3 text-[14px] font-bold text-[#06194A] shadow-lg transition hover:opacity-95 active:scale-[0.98]">
              <ScanLine className="h-5 w-5" /> Open Check-In <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        </Card>

        {/* Action tiles */}
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <Tile icon={<ScanLine className="h-6 w-6" />} title="Scan VIN" body="Camera scan or manual entry of the door-jamb VIN." onClick={open} />
          <Tile icon={<Search className="h-6 w-6" />} title="Existing Lead" body="Attach the inspection to a lead that's already in the system." onClick={open} />
          <Tile icon={<UserPlus className="h-6 w-6" />} title="Walk-In Customer" body="Create a brand-new acquisition opportunity on the spot." onClick={open} />
        </div>

        {/* Today tracker */}
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <StatCard label="Checked In Today" value={m.today} icon={<Car className="h-5 w-5" />} tone="purple" />
          <StatCard label="Appraisals Waiting" value={db.appraiserQueueCount} icon={<RotateCcw className="h-5 w-5" />} tone="amber" onClick={() => onNavigate("appraiser-queue")} />
          <StatCard label="Inspections Done Today" value={m.completed} icon={<ClipboardCheck className="h-5 w-5" />} tone="green" />
          <StatCard label="All Leads" value={db.total} icon={<Search className="h-5 w-5" />} tone="teal" onClick={() => onNavigate("submissions")} />
        </div>

        {/* Today's activity */}
        <Card className="overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4">
            <SectionLabel>Today's check-in activity</SectionLabel>
            <button onClick={() => onNavigate("submissions")} className="inline-flex items-center gap-1 text-[12px] font-semibold text-[#6D28D9] hover:underline">View all <ArrowRight className="h-3.5 w-3.5" /></button>
          </div>
          <div className="divide-y divide-[#F0F2F7] border-t border-[#F0F2F7]">
            {recent.length === 0 && <div className="px-5 py-8 text-center text-sm text-[#7A879C]">No check-ins yet today. Scan a VIN to get started.</div>}
            {recent.map((s) => {
              const vehicle = [s.vehicle_year, s.vehicle_make, s.vehicle_model].filter(Boolean).join(" ");
              const done = s.progress_status === "inspection_completed" || s.progress_status === "purchase_complete";
              return (
                <button key={s.id} onClick={() => db.handleView(s)} className="flex w-full items-center gap-3 px-5 py-3 text-left transition hover:bg-[#F8FAFC]">
                  <span className={`flex h-8 w-8 items-center justify-center rounded-full ${done ? "bg-[#E8F8EE] text-[#0F7A3E]" : "bg-[#F3F0FF] text-[#6D28D9]"}`}>{done ? <CheckCircle2 className="h-4 w-4" /> : <Clock className="h-4 w-4" />}</span>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[13px] font-semibold text-[#06194A]">{s.name || "Walk-in"}{vehicle ? ` · ${vehicle}` : ""}</div>
                    <div className="text-[11px] text-[#9AA6BC]">{relTime(s.created_at)}</div>
                  </div>
                  <Pill tone={done ? "green" : "purple"}>{getStatusLabel(s.progress_status)}</Pill>
                </button>
              );
            })}
          </div>
        </Card>
      </div>
    </PageShell>
  );
};

const Tile = ({ icon, title, body, onClick }: { icon: React.ReactNode; title: string; body: string; onClick: () => void }) => (
  <button onClick={onClick} className="flex flex-col rounded-2xl border border-[#E6EAF0] bg-white p-5 text-left shadow-[0_1px_2px_rgba(15,23,42,0.04)] transition hover:-translate-y-0.5 hover:border-[#6D28D9]/30 hover:shadow-[0_10px_30px_-12px_rgba(15,23,42,0.18)]">
    <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-[#6D28D9] to-[#0D9488] text-white">{icon}</span>
    <div className="mt-3 text-[15px] font-bold text-[#06194A]">{title}</div>
    <p className="mt-1 flex-1 text-[13px] text-[#53627A]">{body}</p>
    <span className="mt-3 inline-flex items-center gap-1 text-[12px] font-semibold text-[#6D28D9]">Open <ArrowRight className="h-3.5 w-3.5" /></span>
  </button>
);

export default VehicleCheckIn;
