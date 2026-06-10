/**
 * Performance (Admin V2) — native-V2 hub over the existing panels.
 *
 * Reimplements PerformanceHub's role-aware tab shell in the V2 design
 * system and mounts the SAME sub-panels (ExecutiveKPIHub, ExecutiveHUD,
 * BDCHealthPanel, SalesManagerDispatch) with identical role gating and
 * the same drill-down / open-submission wiring. V2-only; V1 untouched.
 */
import { lazy, Suspense, useState } from "react";
import { BarChart3, Gauge, Activity, Users } from "lucide-react";
import type { useAdminDashboard } from "@/hooks/useAdminDashboard";
import { canViewExecutiveHUD } from "@/lib/adminConstants";
import { cn } from "@/lib/utils";
import ExecutiveKPIHub from "@/components/admin/ExecutiveKPIHub";
import { PageShell, Loading } from "./theme";

const ExecutiveHUD = lazy(() => import("@/components/admin/ExecutiveHUD"));
const BDCHealthPanel = lazy(() => import("@/components/admin/BDCHealthPanel"));
const SalesManagerDispatch = lazy(() => import("@/components/admin/SalesManagerDispatch"));

type Db = ReturnType<typeof useAdminDashboard>;
type Tab = "kpi" | "hud" | "bdc" | "dispatch";

const PerformanceV2 = ({ db, initialTab = "kpi" }: { db: Db; initialTab?: Tab }) => {
  const role = db.userRole;
  const showHud = canViewExecutiveHUD(role);
  const showBdcHealth = ["admin", "gsm_gm", "used_car_manager", "manager", "bdc_manager"].includes(role);
  const showManagerDispatch = ["admin", "gsm_gm", "gm", "used_car_manager", "manager"].includes(role);

  const tabs = ([
    { key: "kpi", label: "KPI Hub", icon: BarChart3, show: true },
    { key: "hud", label: "GM HUD", icon: Gauge, show: showHud },
    { key: "bdc", label: "BDC Health", icon: Activity, show: showBdcHealth },
    { key: "dispatch", label: "Manager Dispatch", icon: Users, show: showManagerDispatch },
  ] as { key: Tab; label: string; icon: typeof BarChart3; show: boolean }[]).filter((t) => t.show);

  const [tab, setTab] = useState<Tab>(tabs.some((t) => t.key === initialTab) ? initialTab : "kpi");

  const openSubmission = (id: string) => { const s = db.submissions.find((x) => x.id === id); if (s) db.handleView(s); };
  type DrillTarget =
    | { kind: "progress"; value: string; label?: string; chip?: string }
    | { kind: "decline_reason"; value: string; label?: string }
    | { kind: "competitor"; value: string; label?: string };
  const hudDrill = (target: DrillTarget) => {
    (db.setLeadsPrefilter as ((t: DrillTarget) => void) | undefined)?.(target);
    db.setActiveSection("submissions");
  };

  return (
    <PageShell title="Performance" subtitle="Headline KPIs, live GM HUD, BDC activity, and manager dispatch.">
      {tabs.length > 1 && (
        <div className="mb-5 inline-flex flex-wrap gap-1 rounded-xl border border-[#E6EAF0] bg-white p-1">
          {tabs.map((t) => (
            <button key={t.key} onClick={() => setTab(t.key)}
              className={cn("inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-[13px] font-semibold transition", tab === t.key ? "bg-[#6D28D9] text-white" : "text-[#53627A] hover:bg-[#F4F6FA]")}>
              <t.icon className="h-4 w-4" /> {t.label}
            </button>
          ))}
        </div>
      )}

      <Suspense fallback={<Loading />}>
        {tab === "kpi" && <ExecutiveKPIHub />}
        {tab === "hud" && showHud && <ExecutiveHUD onDrillDown={hudDrill} />}
        {tab === "bdc" && showBdcHealth && <BDCHealthPanel />}
        {tab === "dispatch" && showManagerDispatch && <SalesManagerDispatch onOpenSubmission={openSubmission} />}
      </Suspense>
    </PageShell>
  );
};

export default PerformanceV2;
