import React, { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import AdminLoadingSkeleton from "./AdminLoadingSkeleton";

const WhiteLabelSettings = React.lazy(() => import("./WhiteLabelSettings"));
const IntegrationsStatus = React.lazy(() => import("./IntegrationsStatus"));
const ApiAccessPanel = React.lazy(() => import("./ApiAccessPanel"));
const VautoIntegration = React.lazy(() => import("./VautoIntegration"));

interface IntegrationsHubProps {
  /** Deep-link tab from legacy keys:
   *  "white-label"          → white-label
   *  "integrations-status"  → status
   *  "api-access"           → api
   *  "vauto-integration"    → vauto
   *  "integrations"         → status (default — landing tab) */
  initialTab?: "status" | "api" | "vauto" | "white-label";
}

/**
 * Integrations hub — every external/enterprise integration on tabs:
 *
 *   - Status      — health of all wired integrations (IntegrationsStatus)
 *   - API Access  — public API keys + rate limits (ApiAccessPanel)
 *   - vAuto       — vAuto inventory sync settings (VautoIntegration)
 *   - White Label — branding override for re-sellers (WhiteLabelSettings)
 *
 * All four are enterprise-gated technical surfaces and previously sat
 * as four separate sidebar entries in the Integrations group. Merging
 * keeps the wiring/health/keys workflow in one destination.
 */
const IntegrationsHub = ({ initialTab = "status" }: IntegrationsHubProps) => {
  const [tab, setTab] = useState<string>(initialTab);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-card-foreground">Integrations</h2>
        <p className="text-sm text-muted-foreground">
          Status, keys, and per-integration configuration in one place.
        </p>
      </div>

      <Tabs value={tab} onValueChange={setTab} className="w-full">
        <TabsList>
          <TabsTrigger value="status">Status</TabsTrigger>
          <TabsTrigger value="api">API Access</TabsTrigger>
          <TabsTrigger value="vauto">vAuto</TabsTrigger>
          <TabsTrigger value="white-label">White Label</TabsTrigger>
        </TabsList>

        <TabsContent value="status" className="pt-4">
          <React.Suspense fallback={<AdminLoadingSkeleton />}>
            <IntegrationsStatus />
          </React.Suspense>
        </TabsContent>

        <TabsContent value="api" className="pt-4">
          <React.Suspense fallback={<AdminLoadingSkeleton />}>
            <ApiAccessPanel />
          </React.Suspense>
        </TabsContent>

        <TabsContent value="vauto" className="pt-4">
          <React.Suspense fallback={<AdminLoadingSkeleton />}>
            <VautoIntegration />
          </React.Suspense>
        </TabsContent>

        <TabsContent value="white-label" className="pt-4">
          <React.Suspense fallback={<AdminLoadingSkeleton />}>
            <WhiteLabelSettings />
          </React.Suspense>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default IntegrationsHub;
