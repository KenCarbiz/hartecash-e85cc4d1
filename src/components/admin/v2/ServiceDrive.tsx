/**
 * Service Drive (Admin V2) — outcome-focused redesign of the Service
 * Quick Entry launcher.
 *
 * Turns service-acquisition into a revenue surface: a fast-entry launcher
 * into the real 90-second capture tool, an opportunity tracker, and a
 * conversion funnel — instead of a single "open the tool" card.
 *
 * REAL: tracker KPIs, funnel, and the recent list are computed from
 * service-sourced submissions (lead_source = 'service') for the tenant.
 * The actual capture (VIN → Black Book → customer → hand-off) stays in
 * the existing /service-quick-entry tool, launched from here.
 */
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Zap, ScanLine, ArrowRight, CalendarCheck, DollarSign, CheckCircle2,
  Users, Clock, TrendingDown,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import type { useAdminDashboard } from "@/hooks/useAdminDashboard";
import { ACCEPTED_WITH_APPOINTMENT_STATUSES, getStatusLabel } from "@/lib/adminConstants";
import { PageShell, Card, SectionLabel, Pill, StatCard, PrimaryButton } from "./theme";

type Db = ReturnType<typeof useAdminDashboard>;
const APPT = new Set<string>(ACCEPTED_WITH_APPOINTMENT_STATUSES);

interface SvcRow {
  id: string;
  name: string | null;
  vehicle_year: string | null;
  vehicle_make: string | null;
  vehicle_model: string | null;
  progress_status: string;
  offered_price: number | null;
  created_at: string;
}

const relTime = (iso: string) => {
  const m = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
};
const pct = (a: number, b: number) => (b ? Math.round((a / b) * 100) : 0);

const ServiceDrive = ({ db, onNavigate }: { db: Db; onNavigate: (key: string) => void }) => {
  const navigate = useNavigate();
  const [rows, setRows] = useState<SvcRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("submissions")
        .select("id, name, vehicle_year, vehicle_make, vehicle_model, progress_status, offered_price, created_at")
        .eq("dealership_id", db.tenant.dealership_id)
        .eq("lead_source", "service")
        .order("created_at", { ascending: false })
        .limit(500);
      if (!cancelled) {
        setRows(((data as unknown) as SvcRow[]) || []);
        setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [db.tenant.dealership_id]);

  const m = useMemo(() => {
    const opportunities = rows.length;
    const offers = rows.filter((r) => !!r.offered_price).length;
    const appointments = rows.filter((r) => APPT.has(r.progress_status)).length;
    const purchased = rows.filter((r) => r.progress_status === "purchase_complete").length;
    return { opportunities, offers, appointments, purchased };
  }, [rows]);

  const funnel = [
    { label: "Opportunities", n: m.opportunities },
    { label: "Offers sent", n: m.offers },
    { label: "Appointments", n: m.appointments },
    { label: "Purchased", n: m.purchased },
  ];
  const maxN = funnel[0].n || 1;

  const drillToLeads = () => { db.setSourceFilter("service"); db.setStatusFilter(""); onNavigate("submissions"); };

  return (
    <PageShell
      title="Service Drive Capture"
      subtitle="Turn service customers into acquisition opportunities."
      actions={
        <PrimaryButton onClick={() => navigate("/service-quick-entry")}>
          <Zap className="h-4 w-4" /> Start opportunity
        </PrimaryButton>
      }
    >
      <div className="space-y-4">
        {/* Fast-entry launcher */}
        <Card className="overflow-hidden border-0 bg-gradient-to-br from-[#6D28D9] to-[#0D9488] p-6 text-white">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="max-w-lg">
              <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-white/70">90-second capture</div>
              <h2 className="mt-1 text-[22px] font-bold">Capture a vehicle in the service drive</h2>
              <p className="mt-1 text-[13px] text-white/85">
                Scan a VIN for instant Black Book values, add the customer, and hand off a real offer — all
                while they wait. Opens the tablet-friendly capture tool.
              </p>
            </div>
            <button
              onClick={() => navigate("/service-quick-entry")}
              className="inline-flex items-center gap-2 rounded-xl bg-white px-5 py-3 text-[14px] font-bold text-[#6D28D9] shadow-lg transition hover:opacity-95 active:scale-[0.98]"
            >
              <ScanLine className="h-5 w-5" /> Start opportunity <ArrowRight className="h-4 w-4" />
            </button>
          </div>
          <div className="mt-5 grid grid-cols-1 gap-2 sm:grid-cols-3">
            {[
              { t: "1. VIN + Mileage", s: "Instant Black Book values" },
              { t: "2. Customer Info", s: "Name, phone, optional payoff" },
              { t: "3. Hand Off", s: "QR code or SMS / email link" },
            ].map((x) => (
              <div key={x.t} className="rounded-xl bg-white/10 p-3 backdrop-blur-sm">
                <div className="text-[12px] font-semibold">{x.t}</div>
                <div className="text-[11px] text-white/75">{x.s}</div>
              </div>
            ))}
          </div>
        </Card>

        {/* Opportunity tracker */}
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <StatCard label="Opportunities Created" value={m.opportunities} icon={<Users className="h-5 w-5" />} tone="purple" onClick={drillToLeads} />
          <StatCard label="Offers Sent" value={m.offers} icon={<DollarSign className="h-5 w-5" />} tone="teal" />
          <StatCard label="Appointments Set" value={m.appointments} icon={<CalendarCheck className="h-5 w-5" />} tone="amber" />
          <StatCard label="Vehicles Purchased" value={m.purchased} icon={<CheckCircle2 className="h-5 w-5" />} tone="green" />
        </div>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {/* Conversion funnel */}
          <Card className="p-5">
            <SectionLabel>Service drive funnel</SectionLabel>
            <div className="mt-4 space-y-3">
              {funnel.map((f, i) => (
                <div key={f.label}>
                  <div className="flex items-center justify-between text-[12px]">
                    <span className="font-medium text-[#3B4763]">{f.label}</span>
                    <span className="font-semibold text-[#06194A]">
                      {f.n}{i > 0 && <span className="ml-2 font-normal text-[#9AA6BC]">{pct(f.n, funnel[i - 1].n)}%</span>}
                    </span>
                  </div>
                  <div className="mt-1 h-2.5 w-full overflow-hidden rounded-full bg-[#F0F2F7]">
                    <div className="h-full rounded-full bg-gradient-to-r from-[#6D28D9] to-[#0D9488]" style={{ width: `${Math.max(pct(f.n, maxN), 2)}%` }} />
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-4 flex items-center gap-1.5 text-[12px] text-[#53627A]">
              <TrendingDown className="h-3.5 w-3.5 text-[#B45309]" />
              Opportunity→purchase: <strong className="text-[#06194A]">{pct(m.purchased, m.opportunities)}%</strong>
            </div>
          </Card>

          {/* Recent service opportunities */}
          <Card className="overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4">
              <SectionLabel>Recent service opportunities</SectionLabel>
              <button onClick={drillToLeads} className="inline-flex items-center gap-1 text-[12px] font-semibold text-[#6D28D9] hover:underline">View all <ArrowRight className="h-3.5 w-3.5" /></button>
            </div>
            <div className="divide-y divide-[#F0F2F7] border-t border-[#F0F2F7]">
              {loading && <div className="px-5 py-8 text-center text-sm text-[#7A879C]">Loading…</div>}
              {!loading && rows.length === 0 && <div className="px-5 py-8 text-center text-sm text-[#7A879C]">No service-drive opportunities yet. Start one above.</div>}
              {rows.slice(0, 6).map((r) => {
                const vehicle = [r.vehicle_year, r.vehicle_make, r.vehicle_model].filter(Boolean).join(" ");
                const sold = r.progress_status === "purchase_complete";
                return (
                  <div key={r.id} className="flex items-center gap-3 px-5 py-3">
                    <span className={`flex h-8 w-8 items-center justify-center rounded-full ${sold ? "bg-[#E8F8EE] text-[#0F7A3E]" : "bg-[#E6FAF7] text-[#0F766E]"}`}>
                      {sold ? <CheckCircle2 className="h-4 w-4" /> : <Clock className="h-4 w-4" />}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-[13px] font-semibold text-[#06194A]">{r.name || "Service customer"}</div>
                      <div className="truncate text-[12px] text-[#7A879C]">{vehicle || "Vehicle pending"}</div>
                    </div>
                    {r.offered_price ? <span className="hidden text-[13px] font-semibold text-[#0F7A3E] sm:block">${(r.offered_price / 1000).toFixed(1)}k</span> : null}
                    <Pill tone={sold ? "green" : "teal"}>{getStatusLabel(r.progress_status)}</Pill>
                  </div>
                );
              })}
            </div>
          </Card>
        </div>
      </div>
    </PageShell>
  );
};

export default ServiceDrive;
