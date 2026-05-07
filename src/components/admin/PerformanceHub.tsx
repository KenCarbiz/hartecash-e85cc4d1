import React, { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import AdminLoadingSkeleton from "./AdminLoadingSkeleton";
import ExecutiveKPIHub from "./ExecutiveKPIHub";

const ExecutiveHUD = React.lazy(() => import("./ExecutiveHUD"));
const BDCHealthPanel = React.lazy(() => import("./BDCHealthPanel"));
const SalesManagerDispatch = React.lazy(() => import("./SalesManagerDispatch"));

interface PerformanceHubProps {
  /** Deep-link tab from legacy keys:
   *  "executive" → kpi
   *  "gm-hud"    → hud
   *  "bdc-health" → bdc
   *  "manager-dispatch" → dispatch
   *  "performance" → kpi (default) */
  initialTab?: "kpi" | "hud" | "bdc" | "dispatch";
  /** When false (role can't view HUD) the HUD tab is hidden and we
   *  render only the KPI surface. Routed by canViewExecutiveHUD. */
  showHud?: boolean;
  /** Whether the viewer can see BDC Health (manager / GSM / GM /
   *  admin). When false the BDC tab is hidden. */
  showBdcHealth?: boolean;
  /** Whether the viewer can see Manager Dispatch (sales managers,
   *  GSM/GM, admin). Item 23 of the audit. */
  showManagerDispatch?: boolean;
  /** Drill-down handler for the GM HUD funnel + decline buckets.
   *  Threaded down from AdminSectionRenderer so clicking a tile
   *  opens All Leads pre-filtered. */
  onHudDrillDown?: (target:
    | { kind: "progress"; value: string; label?: string; chip?: string }
    | { kind: "decline_reason"; value: string; label?: string }
    | { kind: "competitor"; value: string; label?: string }
  ) => void;
  /** Opens the customer file slide-out for a given submission_id.
   *  Threaded down so the dispatch panel rows can navigate. */
  onOpenSubmission?: (id: string) => void;
}

/**
 * Performance hub — KPI + GM HUD + BDC Health + Manager Dispatch on
 * a single page with role-aware tabs.
 *
 * Each surface targets a different management persona but they all
 * read from the same submissions/bdc_call_tasks data so a single hub
 * stops a manager from context-switching between four sidebar
 * entries for the same mental task. Tabs only render for roles that
 * have the matching show* flag set.
 */
const PerformanceHub = ({
  initialTab = "kpi",
  showHud = false,
  showBdcHealth = false,
  showManagerDispatch = false,
  onHudDrillDown,
  onOpenSubmission,
}: PerformanceHubProps) => {
  const [tab, setTab] = useState<string>(initialTab);

  // No extra tabs → render KPI inline, skip the tab strip.
  if (!showHud && !showBdcHealth && !showManagerDispatch) {
    return <ExecutiveKPIHub />;
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-card-foreground">Performance</h2>
        <p className="text-sm text-muted-foreground">
          Headline KPIs, live GM HUD, BDC activity, and manager dispatch.
        </p>
      </div>

      <Tabs value={tab} onValueChange={setTab} className="w-full">
        <TabsList>
          <TabsTrigger value="kpi">KPI Hub</TabsTrigger>
          {showHud && <TabsTrigger value="hud">GM HUD</TabsTrigger>}
          {showBdcHealth && <TabsTrigger value="bdc">BDC Health</TabsTrigger>}
          {showManagerDispatch && <TabsTrigger value="dispatch">Manager Dispatch</TabsTrigger>}
        </TabsList>

        <TabsContent value="kpi" className="pt-4">
          <ExecutiveKPIHub />
        </TabsContent>

        {showHud && (
          <TabsContent value="hud" className="pt-4">
            <React.Suspense fallback={<AdminLoadingSkeleton />}>
              <ExecutiveHUD onDrillDown={onHudDrillDown} />
            </React.Suspense>
          </TabsContent>
        )}

        {showBdcHealth && (
          <TabsContent value="bdc" className="pt-4">
            <React.Suspense fallback={<AdminLoadingSkeleton />}>
              <BDCHealthPanel />
            </React.Suspense>
          </TabsContent>
        )}

        {showManagerDispatch && (
          <TabsContent value="dispatch" className="pt-4">
            <React.Suspense fallback={<AdminLoadingSkeleton />}>
              <SalesManagerDispatch onOpenSubmission={onOpenSubmission} />
            </React.Suspense>
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
};

export default PerformanceHub;
