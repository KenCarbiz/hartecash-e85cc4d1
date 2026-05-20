import React, { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import AdminLoadingSkeleton from "./AdminLoadingSkeleton";

const SiteConfiguration = React.lazy(() => import("./SiteConfiguration"));
const AppearanceSettings = React.lazy(() => import("./AppearanceSettings"));
const LandingFlowConfig = React.lazy(() => import("./LandingFlowConfig"));
const TrackerVehicleMapping = React.lazy(() => import("./TrackerVehicleMapping"));

interface BrandingHubProps {
  /** Deep-link tab. Maps from legacy section keys:
   *  "site-config"  → identity
   *  "appearance"   → appearance
   *  "landing-flow" → landing
   *  "branding"     → identity (default) */
  initialTab?: "identity" | "appearance" | "landing" | "tracker";
  userRole?: string;
  canManageAccess?: boolean;
  /** Forwarded to SiteConfiguration so the auto-scroll on a specific
   *  config card (e.g. Onboarding Wizard handoffs) still works. */
  focusField?: string;
}

/**
 * Branding hub — every surface that controls how the dealer's site
 * looks and reads on three tabs:
 *
 *   - Identity   — dealer name, address, hours, logo, social links,
 *                  hero copy, about content (SiteConfiguration).
 *   - Appearance — UI/text scale, top-bar, sidebar color, theme
 *                  primitives (AppearanceSettings).
 *   - Landing    — landing-page form variant, hero layout, template
 *                  picker (LandingFlowConfig).
 *
 * Replaces the prior three sidebar entries (site-config, appearance,
 * landing-flow). Legacy keys still route here on the right tab.
 */
const BrandingHub = ({
  initialTab = "identity",
  userRole,
  canManageAccess = true,
  focusField,
}: BrandingHubProps) => {
  const [tab, setTab] = useState<string>(initialTab);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-card-foreground">Branding</h2>
        <p className="text-sm text-muted-foreground">
          Identity, appearance, and the landing-page flow your customers see.
        </p>
      </div>

      <Tabs value={tab} onValueChange={setTab} className="w-full">
        <TabsList>
          <TabsTrigger value="identity">Identity</TabsTrigger>
          <TabsTrigger value="appearance">Appearance</TabsTrigger>
          <TabsTrigger value="landing">Landing</TabsTrigger>
        </TabsList>

        <TabsContent value="identity" className="pt-4">
          <React.Suspense fallback={<AdminLoadingSkeleton />}>
            <SiteConfiguration focusField={focusField} />
          </React.Suspense>
        </TabsContent>

        <TabsContent value="appearance" className="pt-4">
          <React.Suspense fallback={<AdminLoadingSkeleton />}>
            <AppearanceSettings userRole={userRole} canManageAccess={canManageAccess} />
          </React.Suspense>
        </TabsContent>

        <TabsContent value="landing" className="pt-4">
          <React.Suspense fallback={<AdminLoadingSkeleton />}>
            <LandingFlowConfig />
          </React.Suspense>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default BrandingHub;
