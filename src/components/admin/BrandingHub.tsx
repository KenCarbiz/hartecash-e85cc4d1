import React, { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Building2, Palette, LayoutTemplate, Car } from "lucide-react";
import { cn } from "@/lib/utils";
import AdminLoadingSkeleton from "./AdminLoadingSkeleton";

const SiteConfiguration = React.lazy(() => import("./SiteConfiguration"));
const AppearanceSettings = React.lazy(() => import("./AppearanceSettings"));
const LandingFlowConfig = React.lazy(() => import("./LandingFlowConfig"));
const TrackerVehicleMapping = React.lazy(() => import("./TrackerVehicleMapping"));

interface BrandingHubProps {
  initialTab?: "identity" | "appearance" | "landing" | "tracker";
  userRole?: string;
  canManageAccess?: boolean;
  focusField?: string;
}

const TABS: Array<{
  value: "identity" | "appearance" | "landing" | "tracker";
  label: string;
  hint: string;
  icon: React.ComponentType<{ className?: string }>;
}> = [
  { value: "identity",   label: "Identity",         hint: "Who you are",           icon: Building2 },
  { value: "appearance", label: "Appearance",       hint: "How your brand looks",  icon: Palette },
  { value: "landing",    label: "Landing",          hint: "How your page works",   icon: LayoutTemplate },
  { value: "tracker",    label: "Tracker Vehicles", hint: "Your landing vehicle",  icon: Car },
];

/**
 * Branding hub — premium dealer setup control center. One page, four
 * focused tabs (Identity, Appearance, Landing, Tracker Vehicles).
 *
 * The shell here owns: page chrome, the polished tab bar, layout
 * spacing, and lazy loading. Each tab's content (and its Save button)
 * lives in its own child component so we don't centralize saves or
 * risk breaking field wiring.
 */
const BrandingHub = ({
  initialTab = "identity",
  userRole,
  canManageAccess = true,
  focusField,
}: BrandingHubProps) => {
  const [tab, setTab] = useState<string>(initialTab);

  return (
    <div className="space-y-6 max-w-[1400px]">
      {/* ───────── Page title ───────── */}
      <div className="space-y-1.5">
        <h1 className="text-2xl font-semibold tracking-tight text-card-foreground">
          Branding
        </h1>
        <p className="text-sm text-muted-foreground max-w-2xl">
          Manage your dealership identity, visual appearance, landing-page flow,
          and the vehicle imagery customers see across your site.
        </p>
      </div>

      {/* ───────── Polished tab bar ───────── */}
      <Tabs value={tab} onValueChange={setTab} className="w-full">
        <TabsList
          className={cn(
            "h-auto p-1.5 bg-muted/60 border border-border/60",
            "rounded-xl shadow-sm",
            "grid grid-cols-2 sm:grid-cols-4 gap-1 w-full",
          )}
        >
          {TABS.map(({ value, label, hint, icon: Icon }) => (
            <TabsTrigger
              key={value}
              value={value}
              className={cn(
                "flex flex-col items-start gap-0.5 px-4 py-2.5 rounded-lg",
                "text-left transition-all",
                "data-[state=active]:bg-background data-[state=active]:shadow-sm",
                "data-[state=active]:border data-[state=active]:border-border/80",
                "data-[state=active]:text-foreground",
                "text-muted-foreground hover:text-foreground/80",
              )}
            >
              <span className="flex items-center gap-2 text-sm font-semibold">
                <Icon className="h-4 w-4" />
                {label}
              </span>
              <span className="text-[11px] font-normal text-muted-foreground/80 pl-6 hidden sm:block">
                {hint}
              </span>
            </TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value="identity" className="pt-6">
          <React.Suspense fallback={<AdminLoadingSkeleton />}>
            <SiteConfiguration focusField={focusField} />
          </React.Suspense>
        </TabsContent>

        <TabsContent value="appearance" className="pt-6">
          <React.Suspense fallback={<AdminLoadingSkeleton />}>
            <AppearanceSettings userRole={userRole} canManageAccess={canManageAccess} />
          </React.Suspense>
        </TabsContent>

        <TabsContent value="landing" className="pt-6">
          <React.Suspense fallback={<AdminLoadingSkeleton />}>
            <LandingFlowConfig />
          </React.Suspense>
        </TabsContent>

        <TabsContent value="tracker" className="pt-6">
          <React.Suspense fallback={<AdminLoadingSkeleton />}>
            <TrackerVehicleMapping />
          </React.Suspense>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default BrandingHub;
