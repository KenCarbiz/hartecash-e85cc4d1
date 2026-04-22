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
  Settings, Bell, ListChecks, MessageSquareQuote, BarChart3, Send, MapPin, Car, ScrollText, Shield, Lock, Wrench, Rocket, Gauge, Network, Camera, Gift, Megaphone, ChevronDown, Link2, Code2, Paintbrush, TrendingUp, Store, Truck, Zap, Activity, ScanLine, CreditCard, Phone, DollarSign, Layout, Globe, Palette, UserCheck, Award, Flame, Home
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { isManagerRole, canViewExecutiveHUD } from "@/lib/adminConstants";

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
 * Sidebar groups (top → bottom):
 *   - Work     — daily tasks: Today, All Leads, Appraiser Queue, Appointments + ops tools
 *   - Grow     — revenue-driving tools: Equity Mining, Voice AI, Wholesale
 *   - Measure  — analytics & reporting: Performance, GM HUD, Reports, Compliance
 *   - Setup    — dealer configuration: Offer Logic, Branding, Locations, etc.
 *   - Account  — Staff & Permissions, Plan, Dealer Setup, System Settings
 *   - Platform — super-admin cross-tenant tools
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
  const isManager = isManagerRole(userRole) || canManageAccess;

  const isAcquisitionStaff =
    isManager ||
    userRole === "sales_bdc" ||
    userRole === "sales" ||
    userRole === "internet_manager" ||
    canManageAccess;
  const isCheckInStaff =
    isAcquisitionStaff || userRole === "inspector" || userRole === "receptionist";
  const canSeeAppraiserQueue = isManager || isAppraiser;
  const isReceptionist = userRole === "receptionist";

  // ── WORK ── Daily tasks: Today (dashboard), leads, queues, appointments + ops
  const workItems: SidebarItem[] = [
    { key: "today", label: "Today", icon: Home },
    { key: "submissions", label: "All Leads", icon: Inbox, badge: submissionCount > 0 ? String(submissionCount) : undefined },
    ...(canSeeAppraiserQueue
      ? [{
          key: "appraiser-queue",
          label: "Appraiser Queue",
          icon: UserCheck,
          badge: appraiserQueueCount > 0 ? String(appraiserQueueCount) : undefined,
          badgeVariant: "destructive" as const,
        }]
      : []),
    { key: "accepted-appts", label: "Appointments", icon: CalendarDays, badge: appointmentCount > 0 ? String(appointmentCount) : undefined },
    ...((userRole === "sales_bdc" ||
         userRole === "sales" ||
         userRole === "internet_manager" ||
         isManager ||
         canManageAccess)
      ? [{ key: "bdc-queue", label: "BDC Priority Queue", icon: Flame }]
      : []),
    ...(isCheckInStaff
      ? [{ key: "inspection-checkin", label: "Inspection Check-In", icon: ScanLine }]
      : []),
    ...(isAcquisitionStaff
      ? [{ key: "service-quick-entry", label: "Service Quick Entry", icon: Zap }]
      : []),
    ...(canManageAccess ? [{ key: "image-inventory", label: "Vehicle Images", icon: Car }] : []),
    { key: "my-lead-link", label: "My Lead Link", icon: Link2 },
    { key: "my-referrals", label: "My Referrals", icon: Award },
  ].filter((item) => isAllowed(item.key));

  // ── GROW ── Revenue-driving tools (manager+)
  const growItems: SidebarItem[] = [
    ...(isManager
      ? [{ key: "equity-mining", label: "Equity Mining", icon: TrendingUp }]
      : []),
    ...(isManager
      ? [{ key: "voice-ai", label: "Voice AI", icon: Phone }]
      : []),
    ...(isManager && (enterpriseBetaEnabled || isPlatformAdmin)
      ? [{ key: "wholesale-marketplace", label: "Wholesale", icon: Store }]
      : []),
  ].filter((item) => isAllowed(item.key));

  // ── MEASURE ── Performance, HUD, reports, compliance
  const measureItems: SidebarItem[] = [
    ...(isManager ? [{ key: "executive", label: "Performance", icon: BarChart3 }] : []),
    ...(canViewExecutiveHUD(userRole)
      ? [{ key: "gm-hud", label: "GM HUD", icon: DollarSign }]
      : []),
    ...(isManager ? [{ key: "reports", label: "Reports", icon: Send }] : []),
    { key: "compliance", label: "Compliance", icon: ShieldCheck },
  ].filter((item) => isAllowed(item.key));

  // ── SETUP ── Dealer configuration (Offer Logic mgr+; rest admin-only)
  const setupItems: SidebarItem[] = [
    ...(isManager ? [{ key: "offer-settings", label: "Offer Logic", icon: SlidersHorizontal, badge: pricingAccessRequestCount > 0 ? String(pricingAccessRequestCount) : undefined, badgeVariant: "destructive" as const }] : []),
    ...(canManageAccess ? [{ key: "site-config", label: "Branding", icon: Palette }] : []),
    ...(canManageAccess && locationCount > 1 ? [{ key: "locations", label: "Locations", icon: MapPin }] : []),
    ...(canManageAccess ? [
      { key: "form-config", label: "Lead Form", icon: ListChecks },
      { key: "inspection-config", label: "Inspection Sheet", icon: Shield },
      { key: "photo-config", label: "Photo Requirements", icon: Camera },
      { key: "depth-policies", label: "Inspection Standards", icon: Gauge },
      { key: "promotions", label: "Promotions", icon: Megaphone },
      { key: "referrals", label: "Referral Program", icon: Gift },
      { key: "notifications", label: "Notifications", icon: Bell },
      { key: "landing-flow", label: "Landing & Flow", icon: Layout },
      ...(locationCount > 1 ? [{ key: "rooftop-websites", label: "Rooftop Websites", icon: Globe }] : []),
      { key: "testimonials", label: "Testimonials", icon: MessageSquareQuote },
      { key: "embed-toolkit", label: "Website Embed", icon: Code2 },
    ] : []),
    ...(canManageAccess && (enterpriseBetaEnabled || isPlatformAdmin)
      ? [
          { key: "white-label", label: "White Label", icon: Paintbrush },
          { key: "integrations-status", label: "Integrations", icon: Activity },
          { key: "api-access", label: "API Access", icon: Code2 },
          { key: "vauto-integration", label: "vAuto Integration", icon: Truck },
        ]
      : []),
  ].filter((item) => isAllowed(item.key));

  // ── ACCOUNT ── Staff & Permissions, Plan, Dealer Setup, System Settings
  const teamBadgeCount = canManageAccess ? pendingRequestCount + permissionRequestCount : 0;
  const accountItems: SidebarItem[] = [
    ...(canManageAccess ? [{ key: "staff", label: "Staff & Permissions", icon: Users, badge: teamBadgeCount > 0 ? String(teamBadgeCount) : undefined, badgeVariant: "destructive" as const }] : []),
    ...(canManageAccess && !isPlatformAdmin
      ? [{ key: "my-plan", label: "Plan", icon: CreditCard, href: "/plan" }]
      : []),
    ...(canManageAccess ? [{ key: "onboarding", label: "Dealer Setup", icon: Rocket }] : []),
    ...(canManageAccess ? [{ key: "system-settings", label: "System Settings", icon: Wrench }] : []),
    ...(canManageAccess ? [{ key: "changelog", label: "Platform Updates", icon: ScrollText }] : []),
  ].filter((item) => isAllowed(item.key));

  // ── PLATFORM ── Super-admin only, cross-tenant operations
  const platformItems: SidebarItem[] = [
    ...(isPlatformAdmin ? [{ key: "tenants", label: "Dealer Tenants", icon: Network }] : []),
    ...(isPlatformAdmin ? [{ key: "pricing-model", label: "Pricing Model", icon: DollarSign }] : []),
    ...(canManageAccess && (enterpriseBetaEnabled || isPlatformAdmin)
      ? [{ key: "platform-billing", label: "Platform & Billing", icon: CreditCard }]
      : []),
  ].filter((item) => isAllowed(item.key));

  const allSectionKeys = [
    "today", "submissions", "accepted-appts", "executive", "appraiser-queue",
    "offer-settings", "form-config", "inspection-config", "photo-config",
    "depth-policies", "promotions", "notifications",
    "site-config", "landing-flow", "locations", "rooftop-websites", "testimonials", "embed-toolkit",
    "my-lead-link", "my-referrals",
    "staff", "referrals", "compliance", "reports", "image-inventory", "changelog",
    "onboarding", "system-settings", "pricing-model",
    "platform-billing", "integrations-status", "api-access", "vauto-integration", "white-label",
    "equity-mining", "voice-ai", "wholesale-marketplace", "service-quick-entry", "inspection-checkin",
  ];
  const lockedSections = showRequestAccess && allowedSections !== null
    ? allSectionKeys.filter((k) => !allowedSections.includes(k))
    : [];

  const groupContainsActive = (items: { key: string }[]) => items.some((item) => item.key === activeSection);

  // Receptionist nav is intentionally minimal — check-in + today's appointments only
  const groupEntries: [string, SidebarItem[]][] = isReceptionist
    ? [
        ["Work", workItems.filter((i) => i.key === "today" || i.key === "accepted-appts" || i.key === "inspection-checkin" || i.key === "my-lead-link" || i.key === "my-referrals")],
      ]
    : [
        ["Work", workItems],
        ["Grow", growItems],
        ["Measure", measureItems],
        ["Setup", setupItems],
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
        <SidebarGroup>
          <CollapsibleTrigger asChild>
            <SidebarGroupLabel className="text-[10px] uppercase tracking-widest font-bold text-sidebar-foreground/50 cursor-pointer hover:text-sidebar-foreground/70 transition-colors flex items-center justify-between pr-2 select-none">
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
              <SidebarMenu>
                {items.map((item) => {
                  const isActive = activeSection === item.key;
                  const Icon = item.icon;
                  return (
                    <SidebarMenuItem key={item.key}>
                      <SidebarMenuButton
                        onClick={() => handleItemClick(item)}
                        isActive={isActive}
                        tooltip={collapsed ? item.label : undefined}
                        className="transition-all duration-200 dark:hover:bg-white/8 dark:hover:shadow-[0_0_12px_rgba(255,255,255,0.06)] dark:data-[active=true]:shadow-[0_0_16px_rgba(100,160,255,0.12)]"
                      >
                        <Icon className="w-4 h-4 shrink-0" />
                        {!collapsed && (
                          <span className="flex-1 truncate">{item.label}</span>
                        )}
                        {!collapsed && item.badge && (
                          <Badge
                            variant={item.badgeVariant === "destructive" ? "destructive" : "secondary"}
                            className="ml-auto text-[10px] h-5 min-w-5 flex items-center justify-center"
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
