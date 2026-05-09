import React, { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import AdminLoadingSkeleton from "./AdminLoadingSkeleton";

const ChannelsSettings = React.lazy(() => import("./ChannelsSettings"));
const NotificationSettings = React.lazy(() => import("./NotificationSettings"));
const NotificationLog = React.lazy(() => import("./NotificationLog"));
const ObjectionPlaybookEditor = React.lazy(() => import("./ObjectionPlaybookEditor"));
const TradeUpIncentiveEditor = React.lazy(() => import("./TradeUpIncentiveEditor"));
const VoiceAgentTrainingEditor = React.lazy(() => import("./VoiceAgentTrainingEditor"));
const VoiceQualityPanel = React.lazy(() => import("./VoiceQualityPanel"));
const PrivacyPosturePanel = React.lazy(() => import("./PrivacyPosturePanel"));
const ConsentLog = React.lazy(() => import("./ConsentLog"));
const CommunicationLog = React.lazy(() => import("./CommunicationLog"));
const VoiceComplianceLog = React.lazy(() => import("./VoiceComplianceLog"));
const StaffActivityLog = React.lazy(() => import("./StaffActivityLog"));
const TenantViewLog = React.lazy(() => import("./TenantViewLog"));

interface CommunicationsHubProps {
  /**
   * The legacy section key the sidebar fired this hub from. Lets deep
   * links to /admin?section=channels etc. land on the right tab. Falls
   * back to "channels" when the consolidated "communications" key is
   * what the user clicked.
   */
  initialTab?: "channels" | "notifications" | "objections" | "incentives" | "voice_ai" | "voice_quality" | "compliance";
  /** Whether the current user can manage channels + notifications.
   *  When false, those tab triggers are hidden so a compliance-only
   *  viewer sees only the audit logs. */
  canManageChannels?: boolean;
  /** Super-admin only — shows the cross-tenant view-as audit row. */
  showTenantViewLog?: boolean;
}

/**
 * Communications hub — single page with tabs for everything that
 * controls how the system speaks to leads:
 *
 *   - Channels       — per-tenant on/off switches (SMS, email, voice,
 *                      click-to-dial, demo mode, TCPA disclosure).
 *   - Notifications  — staff/customer template settings + sent log.
 *   - Compliance     — consent log, comm log, voice compliance, staff
 *                      activity, optional tenant-view audit.
 *
 * Replaces the previous three sidebar entries (channels, notifications,
 * compliance). The legacy section keys still resolve here on the right
 * tab so existing bookmarks / breadcrumbs continue to work — see
 * AdminSectionRenderer.
 */
const CommunicationsHub = ({
  initialTab = "channels",
  canManageChannels = true,
  showTenantViewLog = false,
}: CommunicationsHubProps) => {
  const [tab, setTab] = useState<string>(
    canManageChannels ? initialTab : "compliance",
  );

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-card-foreground">Communications</h2>
        <p className="text-sm text-muted-foreground">
          Control how the system reaches your leads — channels on/off,
          notification templates, and the audit trail.
        </p>
      </div>

      <Tabs value={tab} onValueChange={setTab} className="w-full">
        <TabsList>
          {canManageChannels && <TabsTrigger value="channels">Channels</TabsTrigger>}
          {canManageChannels && <TabsTrigger value="notifications">Notifications</TabsTrigger>}
          {canManageChannels && <TabsTrigger value="objections">Objection Playbook</TabsTrigger>}
          {canManageChannels && <TabsTrigger value="incentives">Trade-Up Incentives</TabsTrigger>}
          {canManageChannels && <TabsTrigger value="voice_ai">Voice AI Training</TabsTrigger>}
          {canManageChannels && <TabsTrigger value="voice_quality">Voice Quality</TabsTrigger>}
          <TabsTrigger value="compliance">Compliance</TabsTrigger>
        </TabsList>

        {canManageChannels && (
          <TabsContent value="channels" className="pt-4">
            <React.Suspense fallback={<AdminLoadingSkeleton />}>
              <ChannelsSettings />
            </React.Suspense>
          </TabsContent>
        )}

        {canManageChannels && (
        <TabsContent value="notifications" className="pt-4">
          <React.Suspense fallback={<AdminLoadingSkeleton />}>
            <Tabs defaultValue="settings" className="w-full">
              <TabsList>
                <TabsTrigger value="settings">Settings</TabsTrigger>
                <TabsTrigger value="log">Sent Messages</TabsTrigger>
              </TabsList>
              <TabsContent value="settings" className="pt-4">
                <NotificationSettings />
              </TabsContent>
              <TabsContent value="log" className="pt-4">
                <NotificationLog />
              </TabsContent>
            </Tabs>
          </React.Suspense>
        </TabsContent>
        )}

        {canManageChannels && (
          <TabsContent value="objections" className="pt-4">
            <React.Suspense fallback={<AdminLoadingSkeleton />}>
              <ObjectionPlaybookEditor />
            </React.Suspense>
          </TabsContent>
        )}

        {canManageChannels && (
          <TabsContent value="incentives" className="pt-4">
            <React.Suspense fallback={<AdminLoadingSkeleton />}>
              <TradeUpIncentiveEditor />
            </React.Suspense>
          </TabsContent>
        )}

        {canManageChannels && (
          <TabsContent value="voice_ai" className="pt-4">
            <React.Suspense fallback={<AdminLoadingSkeleton />}>
              <VoiceAgentTrainingEditor />
            </React.Suspense>
          </TabsContent>
        )}

        {canManageChannels && (
          <TabsContent value="voice_quality" className="pt-4">
            <React.Suspense fallback={<AdminLoadingSkeleton />}>
              <VoiceQualityPanel />
            </React.Suspense>
          </TabsContent>
        )}

        <TabsContent value="compliance" className="pt-4 space-y-6">
          <React.Suspense fallback={<AdminLoadingSkeleton />}>
            <PrivacyPosturePanel />
            <div className="border-t border-border pt-6">
              <ConsentLog />
            </div>
            <div className="border-t border-border pt-6">
              <CommunicationLog />
            </div>
            <div className="border-t border-border pt-6">
              <VoiceComplianceLog />
            </div>
            <div className="border-t border-border pt-6">
              <StaffActivityLog />
            </div>
            {showTenantViewLog && (
              <div className="border-t border-border pt-6">
                <TenantViewLog />
              </div>
            )}
          </React.Suspense>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default CommunicationsHub;
