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
  Settings, Bell, ListChecks, MessageSquareQuote, BarChart3, Send, MapPin, Car, ScrollText, Shield, Lock, Wrench, Rocket, Gauge, Network, Camera, Gift, Megaphone, ChevronDown, Link2, Code2, Paintbrush, TrendingUp, Store, Truck, Zap, Activity, ScanLine, CreditCard, Phone, PhoneCall, DollarSign, Layout, Globe, Palette, UserCheck, Award, Home, Tag, Receipt, Key,
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
  Target, Clock, PanelRightOpen,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
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
  /** Server-driven super-admin flag from useIsPlatformAdmin(). When
   *  passed, replaces the legacy `dealershipId === "default"` magic-
   *  string derivation for hiding/showing platform-admin-only items.
   *  Pass undefined to fall back to the legacy behaviour during the
   *  transitional release. */
  isPlatformAdminFromServer?: boolean;
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
  isPlatformAdminFromServer,
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
  // Prefer the server-driven flag when supplied. Falls back to the
  // legacy magic-string derivation during the transitional release —
  // remove the fallback once all call sites pass isPlatformAdminFromServer.
  const isPlatformAdmin =
    isPlatformAdminFromServer !== undefined
      ? isPlatformAdminFromServer
      : canManageAccess && dealershipId === "default";
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
    { key: "bdc-hub", label: "BDC Queue", icon: PhoneCall },
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

  // ── MEASURE ── Performance hub (KPI + GM HUD as role-aware tabs)
  // and Reports. "Compliance" moved into the Communications hub (TCPA
  // / consent / audit logs all live with the comms surfaces).
  const measureItems: SidebarItem[] = [
    { key: "performance", label: "Performance", icon: LineChart },
    { key: "reports", label: "Reports", icon: BarChart3 },
  ].filter((item) => isAllowed(item.key));

  // ── SETUP · DEALER ── Major consolidation pass:
  //   - Branding hub      = Identity + Appearance + Landing (was 3 entries)
  //   - Communications    = Channels + Notifications + Compliance (was 3)
  //   - Capture & Inspect = Lead Form + Sheet + Photos + Standards (was 4)
  // Legacy keys keep resolving so existing role-permission grants and
  // bookmarks stay valid.
  const setupDealerItems: SidebarItem[] = [
    { key: "branding", label: "Branding", icon: Palette },
    { key: "communications", label: "Communications", icon: Phone },
    { key: "capture-inspection", label: "Capture & Inspection", icon: FileText },
    ...(locationCount > 1 ? [{ key: "locations", label: "Locations", icon: MapPin }] : []),
    { key: "offer-settings", label: "Pricing Rules", icon: Settings, badge: pricingAccessRequestCount > 0 ? String(pricingAccessRequestCount) : undefined, badgeVariant: "destructive" as const },
  ].filter((item) => isAllowed(item.key));

  // ── MY ── Per-user surfaces every staff member benefits from
  // regardless of role. Sits at the bottom of the navigable groups
  // per the approved design, just above Account.
  const myItems: SidebarItem[] = [
    { key: "my-lead-link", label: "My Lead Link", icon: Link2 },
    { key: "my-availability", label: "My Availability", icon: Clock },
    { key: "my-referrals", label: "My Referrals", icon: Gift },
  ].filter((item) => isAllowed(item.key));

  // ── SETUP · PROCESS ── Distribution surfaces. "Marketing" hub
  // (Promotions + Referrals + Testimonials) replaces those three
  // separate entries. "Landing & Flow" merged into the Branding hub.
  const setupProcessItems: SidebarItem[] = [
    { key: "marketing", label: "Marketing", icon: Megaphone },
    ...(locationCount > 1 ? [{ key: "rooftop-websites", label: "Rooftop Websites", icon: Globe }] : []),
    { key: "embed-toolkit", label: "Website Embed", icon: Code2 },
    { key: "trade-widget", label: "Trade Widget", icon: PanelRightOpen },
  ].filter((item) => isAllowed(item.key));

  // ── INTEGRATIONS ── Enterprise-gated. Status + API + vAuto +
  // White Label collapse into the IntegrationsHub on tabs. Legacy
  // keys still resolve onto the right tab.
  const integrationsItems: SidebarItem[] = (
    enterpriseBetaEnabled || isPlatformAdmin
      ? [
          { key: "integrations", label: "Integrations", icon: Activity },
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
    { key: "data-egress", label: "Export My Data", icon: Send },
  ].filter((item) => isAllowed(item.key));

  // ── PLATFORM ── Super-admin only, cross-tenant operations.
  // "Pricing Model" renamed to "SaaS Pricing" so it doesn't collide
  // with dealer-facing "Pricing Rules" in Setup · Dealer.
  const platformItems: SidebarItem[] = [
    ...(isPlatformAdmin ? [{ key: "tenants", label: "Dealer Tenants", icon: Network }] : []),
    ...(isPlatformAdmin ? [{ key: "groups", label: "Group Management", icon: Network }] : []),
    ...(isPlatformAdmin ? [{ key: "stripe-webhooks", label: "Stripe Webhooks", icon: Activity }] : []),
    ...(isPlatformAdmin ? [{ key: "audit-log", label: "Audit Log", icon: ScrollText }] : []),
    ...(isPlatformAdmin ? [{ key: "prospect-demo", label: "Prospect Demo", icon: Target }] : []),
    ...(isPlatformAdmin ? [{ key: "pricing-model", label: "SaaS Pricing", icon: Tag }] : []),
    ...(canManageAccess && (enterpriseBetaEnabled || isPlatformAdmin)
      ? [{ key: "platform-billing", label: "Platform & Billing", icon: Receipt }]
      : []),
    ...(isPlatformAdmin ? [{ key: "changelog", label: "Platform Updates", icon: ScrollText }] : []),
  ].filter((item) => isAllowed(item.key));

  const allSectionKeys = [
    "today", "submissions", "accepted-appts", "appraiser-queue",
    // Performance: legacy keys all resolve to the hub on the right tab.
    "performance", "executive", "gm-hud", "bdc-health", "manager-dispatch",
    // BDC: legacy "bdc-queue" / "bdc-calls" still resolve.
    "bdc-hub", "bdc-queue", "bdc-calls",
    // Comms: legacy "channels" / "notifications" / "compliance" still resolve.
    "communications", "channels", "notifications", "compliance",
    // Branding: legacy "site-config" / "appearance" / "landing-flow" still resolve.
    "branding", "site-config", "appearance", "landing-flow",
    // Capture & Inspection: legacy keys still resolve.
    "capture-inspection", "form-config", "inspection-config", "photo-config", "document-config", "depth-policies",
    // Marketing: legacy "promotions" / "referrals" / "testimonials" still resolve.
    "marketing", "promotions", "referrals", "testimonials",
    "offer-settings",
    "locations", "rooftop-websites", "embed-toolkit", "trade-widget",
    "my-lead-link", "my-availability", "my-referrals",
    "staff", "reports", "image-inventory", "data-egress", "changelog",
    "onboarding", "system-settings", "pricing-model",
    // Integrations: legacy keys still resolve.
    "integrations", "platform-billing", "integrations-status", "api-access", "vauto-integration", "white-label",
    "prospect-demo", "groups", "stripe-webhooks", "audit-log",
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
  // Group labels are dealer-language now (item 19 of the audit). The
  // previous taxonomy ("Setup·Dealer", "Lane Tools", "Grow",
  // "Measure") read as IA jargon — most dealers don't think of their
  // store in those buckets. Mapping:
  //   Work          → Daily Work
  //   My            → My Day
  //   Queues        → Sales Floor          (where the actual leads live)
  //   Lane Tools    → On the Lot            (lane = car-dealer term, but "On the Lot" reads more clearly)
  //   Grow          → Customer Outreach
  //   Measure       → Performance
  //   Setup · Dealer → Store Settings
  //   Setup · Process → Marketing Setup
  //   Integrations  → Integrations
  //   Account       → Account & Plan
  //   Platform      → Platform Admin
  const groupEntries: [string, SidebarItem[]][] = isReceptionist
    ? [
        ["Daily Work", workItems],
        ["My Day", myItems],
        ["Sales Floor", queueItems.filter((i) => i.key === "accepted-appts")],
        ["On the Lot", floorToolsItems.filter((i) => i.key === "inspection-checkin")],
      ]
    : [
        // Daily / personal context first.
        ["Daily Work", workItems],
        ["My Day", myItems],
        // Active work surfaces.
        ["Sales Floor", queueItems],
        ["On the Lot", floorToolsItems],
        ["Customer Outreach", growItems],
        ["Performance", measureItems],
        // Configuration sinks to the bottom.
        ["Store Settings", setupDealerItems],
        ["Marketing Setup", setupProcessItems],
        ["Integrations", integrationsItems],
        ["Account & Plan", accountItems],
        ["Platform Admin", platformItems],
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
                            className="ml-auto text-micro h-4 min-w-4 px-1 flex items-center justify-center"
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
            <SidebarGroupLabel className="text-micro uppercase tracking-widest font-bold text-sidebar-foreground/50">
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
                className="transition-all duration-200 text-warning dark:text-amber-400 hover:bg-warning/10"
              >
                <Gauge className="w-4 h-4 shrink-0" />
                {!collapsed && <span className="flex-1 truncate font-semibold">Command Center</span>}
              </SidebarMenuButton>
            </SidebarMenuItem>
          )}
        </SidebarMenu>
        {!collapsed && (
          <div className="text-center space-y-0.5">
            <p className="text-micro text-sidebar-foreground/50 font-medium tracking-wider uppercase">
              Autocurb.io
            </p>
            <p className="text-[9px] text-sidebar-foreground/30">
              Powered by AutoCurb.io
            </p>
          </div>
        )}
      </SidebarFooter>
    </Sidebar>
  );
};

export default AdminSidebar;
