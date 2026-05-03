import { useState, useEffect } from "react";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarFooter,
  useSidebar,
} from "@/components/ui/sidebar";
import {
  Inbox, CalendarDays, Users, ShieldCheck, SlidersHorizontal,
  Settings, Bell, ListChecks, MessageSquareQuote, BarChart3, Send, MapPin, Car, ScrollText, Shield, Lock, Wrench, Rocket, Gauge, Network, Camera, Gift, Megaphone, ChevronDown, Link2, Code2, Paintbrush, TrendingUp, Store, Truck, Zap, Activity, ScanLine, CreditCard, Phone, DollarSign, Layout, Globe, Palette, UserCheck, Award, Flame, Home, Tag, Receipt, Key,
  // Icons added to bring the left-bar in line with the approved
  // Claude Design reference. RotateCcw replaces UserCheck on the
  // Appraiser Queue (circular re-appraise glyph), Wrench replaces
  // Zap on Service Quick Entry, Image replaces Car on Vehicle Images,
  // Mic replaces Phone on Voice AI, LineChart replaces BarChart3/Send
  // on Performance & Reports, Sparkles replaces Paintbrush on
  // Appearance & Access, FileText replaces ListChecks/Shield on Lead
  // Form & Inspection Sheet, LogIn replaces ScanLine on Inspection
  // Check-In.
  RotateCcw, Image as ImageIcon, Mic, LineChart, Sparkles, FileText, LogIn,
  Target, Clock,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { canViewExecutiveHUD } from "@/lib/adminConstants";
import { useSiteConfig } from "@/hooks/useSiteConfig";

interface AdminSidebarProps {
  activeSection: string;
  onSectionChange: (section: string) => void;
  canManageAccess: boolean;
  submissionCount: number;
  appointmentCount: number;
  pendingRequestCount: number;
  permissionRequestCount?: number;
  pricingAccessRequestCount?: number;
  appraiserQueueCount?: number;
  allowedSections?: string[] | null;
  showRequestAccess?: boolean;
  onRequestAccess?: (sectionKey: string) => void;
  locationCount?: number;
  userRole?: string;
  isAppraiser?: boolean;
  dealershipId?: string;
  /** Enterprise beta program enrollment. Hides the enterprise-only
   *  items (API Access, vAuto, White Label, Wholesale Marketplace) by
   *  default. Flipped on per-dealer by Super Admin. */
  enterpriseBetaEnabled?: boolean;
}

type SidebarItem = {
  key: string;
  label: string;
  icon: React.ElementType;
  badge?: string;
  badgeVariant?: "destructive" | "secondary";
  /**
   * When set, clicking navigates to this path via react-router instead
   * of triggering an inline section change. Used for "My Plan" which
   * lives on a dedicated /plan route with its own context provider.
   */
  href?: string;
};

const STORAGE_KEY = "admin-sidebar-collapsed";

/**
 * Sidebar groups (top → bottom). Re-ordered per the May-2026 logic
 * audit so the day-to-day surfaces are at the top and the heavy
 * configuration sinks to the bottom.
 *
 *   - Work          — Today (daily landing card)
 *   - My            — per-user surfaces (Lead Link, Availability, Referrals)
 *   - Queues        — All Leads, Appraiser Queue, Appointments, BDC Queue (merged)
 *   - Lane Tools    — hands-on lot/service tooling (was "Floor Tools")
 *   - Grow          — revenue-driving tools: Equity Mining, Voice AI
 *   - Measure       — Performance (incl. GM HUD), Reports
 *   - Setup·Dealer  — Branding/Appearance/Comms, Capture & Inspection, Pricing, Locations
 *   - Setup·Process — Marketing, Landing & Flow, Rooftop Websites, Embed
 *   - Integrations  — enterprise-only: White Label, Integrations, API, vAuto
 *   - Account       — Staff & Permissions, Plan, Onboarding Wizard, System Settings
 *   - Platform      — super-admin cross-tenant: Tenants, Demo, SaaS Pricing, Billing
 */

const AdminSidebar = ({
  activeSection,
  onSectionChange,
  canManageAccess,
  submissionCount,
  appointmentCount,
  pendingRequestCount,
  permissionRequestCount = 0,
  pricingAccessRequestCount = 0,
  appraiserQueueCount = 0,
  allowedSections = null,
  showRequestAccess = false,
  onRequestAccess,
  locationCount = 0,
  userRole = "",
  isAppraiser = false,
  dealershipId = "default",
  enterpriseBetaEnabled = false,
}: AdminSidebarProps) => {
  const { state, isMobile, setOpenMobile } = useSidebar();
  const collapsed = isMobile ? false : state === "collapsed";
  const navigate = useNavigate();
  const { config: siteConfig } = useSiteConfig();
  const sidebarActiveColor = siteConfig.sidebar_active_color || "#0f172a";

  const handleItemClick = (item: { key: string; href?: string }) => {
    if (item.href) {
      navigate(item.href);
    } else {
      onSectionChange(item.key);
    }
    if (isMobile) {
      setOpenMobile(false);
    }
  };

  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      return stored ? JSON.parse(stored) : {};
    } catch {
      return {};
    }
  });

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(collapsedGroups));
  }, [collapsedGroups]);

  const toggleGroup = (label: string) => {
    setCollapsedGroups((prev) => ({ ...prev, [label]: !prev[label] }));
  };

  const isAllowed = (key: string) => allowedSections === null || allowedSections.includes(key);
  const isPlatformAdmin = canManageAccess && dealershipId === "default";
  const isReceptionist = userRole === "receptionist";

  // The cascade resolver in useEffectivePermissions is the sole
  // authority for what items a user sees. Group-level visibility
  // (enterprise beta, multi-rooftop, super admin) is still
  // feature-flagged here since those aren't role-based.

  // ── WORK ── Personal dashboard. Today is the landing card.
  // My Lead Link / My Referrals moved to their own MY group at the
  // bottom per the approved design.
  const workItems: SidebarItem[] = [
    { key: "today", label: "Today", icon: Home },
  ].filter((item) => isAllowed(item.key));

  // ── QUEUES ── Shared inboxes. BDC Priority Queue + Calls Today are
  // merged into one "BDC Queue" hub (tabs: Priority / Calls Today)
  // since they share an audience and a data domain — see
  // BdcQueueHub.tsx. The legacy "bdc-queue" / "bdc-calls" keys remain
  // valid section IDs that route into the same hub on the right tab.
  const queueItems: SidebarItem[] = [
    { key: "submissions", label: "All Leads", icon: Inbox, badge: submissionCount > 0 ? String(submissionCount) : undefined },
    {
      key: "appraiser-queue",
      label: "Appraiser Queue",
      icon: RotateCcw,
      badge: appraiserQueueCount > 0 ? String(appraiserQueueCount) : undefined,
      badgeVariant: "destructive" as const,
    },
    { key: "accepted-appts", label: "Appointments", icon: CalendarDays, badge: appointmentCount > 0 ? String(appointmentCount) : undefined },
    { key: "bdc-hub", label: "BDC Queue", icon: Flame },
  ].filter((item) => isAllowed(item.key));

  // ── LANE TOOLS ── Hands-on lot/service tooling. Vehicle Images was
  // here previously but moved to Setup · Dealer alongside Photo
  // Requirements — the two configure / view the same media domain.
  const floorToolsItems: SidebarItem[] = [
    { key: "inspection-checkin", label: "Inspection Check-In", icon: LogIn },
    { key: "service-quick-entry", label: "Service Quick Entry", icon: Wrench },
  ].filter((item) => isAllowed(item.key));

  // ── GROW ── Revenue-driving tools.
  // Wholesale Marketplace was here as an enterprise-beta entry but
  // pulled until the listing pipeline has a real product spec — the
  // InDevelopmentBadge it carried was just visual noise on the
  // platform-admin sidebar. Restore by un-commenting the entry below
  // and the matching key in allSectionKeys when the listing
  // ingestion + buyer matching pipeline lands.
  //   ...(enterpriseBetaEnabled || isPlatformAdmin
  //     ? [{ key: "wholesale-marketplace", label: "Wholesale", icon: Store }]
  //     : []),
  const growItems: SidebarItem[] = [
    { key: "equity-mining", label: "Equity Mining", icon: TrendingUp },
    { key: "voice-ai", label: "Voice AI", icon: Mic },
  ].filter((item) => isAllowed(item.key));

  // ── MEASURE ── Performance + Reports. "Compliance" moved into the
  // new Communications hub (TCPA / consent / audit logs all live with
  // the comms surfaces). GM HUD remains a sibling of Performance only
  // for the audience that can view it.
  const measureItems: SidebarItem[] = [
    { key: "executive", label: "Performance", icon: LineChart },
    ...(canViewExecutiveHUD(userRole)
      ? [{ key: "gm-hud", label: "GM HUD", icon: DollarSign }]
      : []),
    { key: "reports", label: "Reports", icon: BarChart3 },
  ].filter((item) => isAllowed(item.key));

  // ── SETUP · DEALER ── Identity, branding, locations, and core
  // data-capture configuration. "Communication Channels" + "Notifications"
  // + "Compliance" collapse into the new "Communications" hub
  // (CommunicationsHub.tsx); the legacy "channels" / "notifications" /
  // "compliance" keys still resolve onto the right tab.
  const setupDealerItems: SidebarItem[] = [
    { key: "appearance", label: "Appearance & Access", icon: Sparkles },
    { key: "communications", label: "Communications", icon: Phone },
    { key: "site-config", label: "Branding", icon: Palette },
    ...(locationCount > 1 ? [{ key: "locations", label: "Locations", icon: MapPin }] : []),
    { key: "offer-settings", label: "Pricing Rules", icon: Settings, badge: pricingAccessRequestCount > 0 ? String(pricingAccessRequestCount) : undefined, badgeVariant: "destructive" as const },
    { key: "form-config", label: "Lead Form", icon: FileText },
    { key: "inspection-config", label: "Inspection Sheet", icon: ListChecks },
    { key: "photo-config", label: "Photo Requirements", icon: Camera },
    { key: "depth-policies", label: "Inspection Standards", icon: Gauge },
  ].filter((item) => isAllowed(item.key));

  // ── MY ── Per-user surfaces every staff member benefits from
  // regardless of role. Sits at the bottom of the navigable groups
  // per the approved design, just above Account.
  const myItems: SidebarItem[] = [
    { key: "my-lead-link", label: "My Lead Link", icon: Link2 },
    { key: "my-availability", label: "My Availability", icon: Clock },
    { key: "my-referrals", label: "My Referrals", icon: Gift },
  ].filter((item) => isAllowed(item.key));

  // ── SETUP · PROCESS ── Customer-facing flow, marketing, embed,
  // rooftop micro-sites. Enterprise-only items (White Label,
  // Integrations, API, vAuto) moved to their own Integrations group
  // so the gate is visible and Setup · Process stays focused on
  // operational tooling that every paying tenant can access.
  const setupProcessItems: SidebarItem[] = [
    { key: "promotions", label: "Promotions", icon: Megaphone },
    { key: "referrals", label: "Referral Program", icon: Award },
    { key: "landing-flow", label: "Landing & Flow", icon: Layout },
    ...(locationCount > 1 ? [{ key: "rooftop-websites", label: "Rooftop Websites", icon: Globe }] : []),
    { key: "testimonials", label: "Testimonials", icon: MessageSquareQuote },
    { key: "embed-toolkit", label: "Website Embed", icon: Code2 },
  ].filter((item) => isAllowed(item.key));

  // ── INTEGRATIONS ── Enterprise-gated. Held separate so the gate
  // is visually obvious and the technical surfaces don't compete with
  // marketing tooling for sidebar attention.
  const integrationsItems: SidebarItem[] = (
    enterpriseBetaEnabled || isPlatformAdmin
      ? [
          { key: "white-label", label: "White Label", icon: Paintbrush },
          { key: "integrations-status", label: "Integrations", icon: Activity },
          { key: "api-access", label: "API Access", icon: Key },
          { key: "vauto-integration", label: "vAuto Integration", icon: Truck },
        ]
      : []
  ).filter((item) => isAllowed(item.key));

  // ── ACCOUNT ── Staff & Permissions, Plan, Onboarding Wizard, System
  // Settings. Cascade-gated. Plan is hidden on the platform tenant
  // since the super-admin doesn't pay for itself. "Platform Updates"
  // (changelog) was here previously; it's a read-only release feed and
  // was moved into the Platform group for super-admins (and hidden
  // from regular admins, who don't author changelog entries).
  const teamBadgeCount = pendingRequestCount + permissionRequestCount;
  const accountItems: SidebarItem[] = [
    { key: "staff", label: "Staff & Permissions", icon: Users, badge: teamBadgeCount > 0 ? String(teamBadgeCount) : undefined, badgeVariant: "destructive" as const },
    ...(!isPlatformAdmin
      ? [{ key: "my-plan", label: "Plan", icon: CreditCard, href: "/plan" }]
      : []),
    { key: "onboarding", label: "Onboarding Wizard", icon: Rocket },
    { key: "system-settings", label: "System Settings", icon: SlidersHorizontal },
    // Vehicle Images is a backend cache inspector for API-fetched stock
    // photos (vehicle_image_cache + submission-photos bucket). Not a
    // customer collection — purely a maintenance tool for clearing /
    // regenerating cached images, so it lives next to System Settings.
    { key: "image-inventory", label: "Vehicle Image Cache", icon: ImageIcon },
  ].filter((item) => isAllowed(item.key));

  // ── PLATFORM ── Super-admin only, cross-tenant operations.
  // "Pricing Model" renamed to "SaaS Pricing" so it doesn't collide
  // with dealer-facing "Pricing Rules" in Setup · Dealer.
  const platformItems: SidebarItem[] = [
    ...(isPlatformAdmin ? [{ key: "tenants", label: "Dealer Tenants", icon: Network }] : []),
    ...(isPlatformAdmin ? [{ key: "prospect-demo", label: "Prospect Demo", icon: Target }] : []),
    ...(isPlatformAdmin ? [{ key: "pricing-model", label: "SaaS Pricing", icon: Tag }] : []),
    ...(canManageAccess && (enterpriseBetaEnabled || isPlatformAdmin)
      ? [{ key: "platform-billing", label: "Platform & Billing", icon: Receipt }]
      : []),
    ...(isPlatformAdmin ? [{ key: "changelog", label: "Platform Updates", icon: ScrollText }] : []),
  ].filter((item) => isAllowed(item.key));

  const allSectionKeys = [
    "today", "submissions", "accepted-appts", "executive", "appraiser-queue",
    // BDC: legacy keys ("bdc-queue", "bdc-calls") still resolve, but the
    // sidebar uses the merged "bdc-hub" entry.
    "bdc-hub", "bdc-queue", "bdc-calls",
    "offer-settings", "form-config", "inspection-config", "photo-config",
    "depth-policies", "promotions",
    // Comms: legacy keys ("channels", "notifications", "compliance") still
    // resolve onto the right tab, but the sidebar uses "communications".
    "communications", "channels", "notifications", "compliance",
    "site-config", "appearance", "landing-flow", "locations", "rooftop-websites", "testimonials", "embed-toolkit",
    "my-lead-link", "my-availability", "my-referrals",
    "staff", "referrals", "reports", "image-inventory", "changelog",
    "onboarding", "system-settings", "pricing-model",
    "platform-billing", "integrations-status", "api-access", "vauto-integration", "white-label", "prospect-demo",
    "equity-mining", "voice-ai", "service-quick-entry", "inspection-checkin",
  ];
  const lockedSections = showRequestAccess && allowedSections !== null
    ? allSectionKeys.filter((k) => !allowedSections.includes(k))
    : [];

  const groupContainsActive = (items: { key: string }[]) => items.some((item) => item.key === activeSection);

  // Receptionist nav is intentionally minimal — check-in + today's
  // appointments only. Work keeps Today, Queues collapses to just
  // Appointments, Floor Tools to just Inspection Check-In, and the
  // personal "My" links stay accessible at the bottom.
  const groupEntries: [string, SidebarItem[]][] = isReceptionist
    ? [
        ["Work", workItems],
        ["My", myItems],
        ["Queues", queueItems.filter((i) => i.key === "accepted-appts")],
        ["Lane Tools", floorToolsItems.filter((i) => i.key === "inspection-checkin")],
      ]
    : [
        // Daily / personal context first.
        ["Work", workItems],
        ["My", myItems],
        // Active work surfaces.
        ["Queues", queueItems],
        ["Lane Tools", floorToolsItems],
        ["Grow", growItems],
        ["Measure", measureItems],
        // Configuration sinks to the bottom.
        ["Setup · Dealer", setupDealerItems],
        ["Setup · Process", setupProcessItems],
        ["Integrations", integrationsItems],
        ["Account", accountItems],
        ["Platform", platformItems],
      ];

  useEffect(() => {
    const activeGroup = groupEntries.find(([, items]) =>
      items.some((item) => item.key === activeSection)
    );
    if (activeGroup && collapsedGroups[activeGroup[0]]) {
      setCollapsedGroups((prev) => ({ ...prev, [activeGroup[0]]: false }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeSection]);

  const renderGroup = (label: string, items: SidebarItem[]) => {
    if (items.length === 0) return null;

    const isOpen = !collapsedGroups[label];
    const hasActive = groupContainsActive(items);
    const hasBadge = items.some((item) => item.badge);

    return (
      <Collapsible key={label} open={isOpen} onOpenChange={() => toggleGroup(label)}>
        <SidebarGroup className="py-0.5 px-2">
          <CollapsibleTrigger asChild>
            <SidebarGroupLabel className="h-5 px-2 text-[9.5px] uppercase tracking-widest font-bold text-sidebar-foreground/50 cursor-pointer hover:text-sidebar-foreground/70 transition-colors flex items-center justify-between select-none">
              <span className="flex items-center gap-1.5">
                {label}
                {!isOpen && hasActive && (
                  <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
                )}
                {!isOpen && hasBadge && (
                  <span className="w-1.5 h-1.5 rounded-full bg-destructive" />
                )}
              </span>
              {!collapsed && (
                <ChevronDown className={`w-3 h-3 transition-transform duration-200 ${isOpen ? "" : "-rotate-90"}`} />
              )}
            </SidebarGroupLabel>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <SidebarGroupContent>
              <SidebarMenu className="gap-0">
                {items.map((item) => {
                  const isActive = activeSection === item.key;
                  const Icon = item.icon;
                  // Inline style on the active item so the dealer's
                  // chosen sidebar_active_color from Appearance overrides
                  // shadcn's default --sidebar-accent class binding.
                  const activeStyle = isActive
                    ? { backgroundColor: sidebarActiveColor, color: "#ffffff" }
                    : undefined;
                  return (
                    <SidebarMenuItem key={item.key}>
                      <SidebarMenuButton
                        onClick={() => handleItemClick(item)}
                        isActive={isActive}
                        tooltip={collapsed ? item.label : undefined}
                        style={activeStyle}
                        className="h-7 text-[13px] transition-all duration-200 dark:hover:bg-white/8 dark:hover:shadow-[0_0_12px_rgba(255,255,255,0.06)] dark:data-[active=true]:shadow-[0_0_16px_rgba(100,160,255,0.12)]"
                      >
                        <Icon className="w-4 h-4 shrink-0" />
                        {!collapsed && (
                          <span className="flex-1 truncate">{item.label}</span>
                        )}
                        {!collapsed && item.badge && (
                          <Badge
                            variant={item.badgeVariant === "destructive" ? "destructive" : "secondary"}
                            className="ml-auto text-[10px] h-4 min-w-4 px-1 flex items-center justify-center"
                          >
                            {item.badge}
                          </Badge>
                        )}
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  );
                })}
              </SidebarMenu>
            </SidebarGroupContent>
          </CollapsibleContent>
        </SidebarGroup>
      </Collapsible>
    );
  };

  return (
    <Sidebar collapsible="icon" className="border-r border-border">
      <SidebarContent className="pt-2">
        {groupEntries.map(([label, items]) => renderGroup(label, items))}

        {lockedSections.length > 0 && !collapsed && (
          <SidebarGroup>
            <SidebarGroupLabel className="text-[10px] uppercase tracking-widest font-bold text-sidebar-foreground/50">
              Request Access
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <div className="px-2 pb-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full gap-1.5 text-xs"
                  onClick={() => onRequestAccess?.("request-access")}
                >
                  <Lock className="w-3 h-3" />
                  Request More Access
                </Button>
              </div>
            </SidebarGroupContent>
          </SidebarGroup>
        )}
      </SidebarContent>
      <SidebarFooter className="p-3 space-y-2 border-t border-border/50">
        <SidebarMenu>
          {isPlatformAdmin && (
            <SidebarMenuItem>
              <SidebarMenuButton
                onClick={() => {
                  navigate("/super-admin");
                  if (isMobile) setOpenMobile(false);
                }}
                tooltip={collapsed ? "Command Center" : undefined}
                className="transition-all duration-200 text-amber-500 dark:text-amber-400 hover:bg-amber-500/10"
              >
                <Gauge className="w-4 h-4 shrink-0" />
                {!collapsed && <span className="flex-1 truncate font-semibold">Command Center</span>}
              </SidebarMenuButton>
            </SidebarMenuItem>
          )}
        </SidebarMenu>
        {!collapsed && (
          <div className="text-center space-y-0.5">
            <p className="text-[10px] text-sidebar-foreground/50 font-medium tracking-wider uppercase">
              Autocurb.io
            </p>
            <p className="text-[9px] text-sidebar-foreground/30">
              Powered by Autocurb.ai
            </p>
          </div>
        )}
      </SidebarFooter>
    </Sidebar>
  );
};

export default AdminSidebar;
