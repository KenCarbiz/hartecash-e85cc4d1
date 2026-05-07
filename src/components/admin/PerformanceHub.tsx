import React, { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import AdminLoadingSkeleton from "./AdminLoadingSkeleton";
import ExecutiveKPIHub from "./ExecutiveKPIHub";

const ExecutiveHUD = React.lazy(() => import("./ExecutiveHUD"));
const BDCHealthPanel = React.lazy(() => import("./BDCHealthPanel"));

interface PerformanceHubProps {
  /** Deep-link tab from legacy keys:
   *  "executive" → kpi
   *  "gm-hud"    → hud
   *  "bdc-health" → bdc
   *  "performance" → kpi (default) */
  initialTab?: "kpi" | "hud" | "bdc";
  /** When false (role can't view HUD) the HUD tab is hidden and we
   *  render only the KPI surface. Routed by canViewExecutiveHUD. */
  showHud?: boolean;
  /** Whether the viewer can see BDC Health (manager / GSM / GM /
   *  admin). When false the BDC tab is hidden. */
  showBdcHealth?: boolean;
  /** Drill-down handler for the GM HUD funnel + decline buckets.
   *  Threaded down from AdminSectionRenderer so clicking a tile
   *  opens All Leads pre-filtered. */
  onHudDrillDown?: (target:
    | { kind: "progress"; value: string; label?: string; chip?: string }
    | { kind: "decline_reason"; value: string; label?: string }
    | { kind: "competitor"; value: string; label?: string }
  ) => void;
}

/**
 * Performance hub — KPI + GM HUD on a single page with role-aware tabs.
 *
 * Both surfaces are leadership dashboards over the same underlying
 * lead/offer/appointment data; the previous split between two sidebar
 * entries forced a GM/owner to context-switch between two routes for
 * the same mental task. The HUD tab only appears for roles that
 * canViewExecutiveHUD; everyone else just sees the KPI tab content
 * directly (no tab strip clutter).
 */
const PerformanceHub = ({
  initialTab = "kpi",
  showHud = false,
  showBdcHealth = false,
  onHudDrillDown,
}: PerformanceHubProps) => {
  const [tab, setTab] = useState<string>(initialTab);

  // Role with no extra tabs → render KPI inline, skip the tab strip.
  if (!showHud && !showBdcHealth) {
    return <ExecutiveKPIHub />;
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-card-foreground">Performance</h2>
        <p className="text-sm text-muted-foreground">
          Headline KPIs, live GM HUD, and per-rep BDC activity.
        </p>
      </div>

      <Tabs value={tab} onValueChange={setTab} className="w-full">
        <TabsList>
          <TabsTrigger value="kpi">KPI Hub</TabsTrigger>
          {showHud && <TabsTrigger value="hud">GM HUD</TabsTrigger>}
          {showBdcHealth && <TabsTrigger value="bdc">BDC Health</TabsTrigger>}
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
      </Tabs>
    </div>
  );
};

export default PerformanceHub;
