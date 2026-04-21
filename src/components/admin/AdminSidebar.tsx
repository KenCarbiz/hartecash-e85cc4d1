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
  Settings, Bell, ListChecks, MessageSquareQuote, BarChart3, Send, MapPin, Car, ScrollText, Shield, Lock, Wrench, Rocket, Gauge, Network, Camera, Gift, Megaphone, ChevronDown, Link2, Code2, Paintbrush, TrendingUp, Store, Truck, Zap, Activity, ScanLine, CreditCard, Phone, DollarSign, Layout, Globe, Palette, UserCheck, Award
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { isManagerRole } from "@/lib/adminConstants";

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
  /** Enterprise beta program enrollment. Hides the Enterprise
   *  sidebar group (API Access, vAuto, White Label, Wholesale
   *  Marketplace) by default. Flipped on per-dealer by Super Admin. */
  enterpriseBetaEnabled?: boolean;
}

type SidebarItem = {
  key: string;
  label: string;
  icon: React.ElementType;
  badge?: string;
  badgeVariant?: "destructive" | "secondary";
};

const STORAGE_KEY = "admin-sidebar-collapsed";

/**
 * Role hierarchy (least → most access):
 *   sales_bdc → used_car_manager → gsm_gm → admin
 *
 * Sidebar groups (top → bottom):
 *   - Pipeline       — Leads, Appointments, Appraiser Queue, Performance
 *   - Acquisition    — Daily operational tools (manager+ for most)
 *   - Configuration  — Offer Logic (mgr+) + admin-only Lead Form, Promotions, etc.
 *   - Storefront     — Admin-only customer-facing site config
 *   - My Tools       — Personal items (everyone): Lead Link, My Referrals
 *   - Insights       — Reports (mgr+) and Compliance (everyone)
 *   - Admin          — Dealer Setup, Staff & Permissions, System Settings (admin)
 *   - Integrations   — Enterprise connectors (gated on enterprise beta)
 *   - Platform       — Cross-tenant ops (platform admin only)
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
  // On mobile the sidebar renders inside a Sheet drawer, so it should
  // always show the expanded (full-label) layout regardless of the
  // desktop collapsed/expanded state.
  const collapsed = isMobile ? false : state === "collapsed";
  const navigate = useNavigate();

  const handleItemClick = (key: string) => {
    onSectionChange(key);
    if (isMobile) {
      setOpenMobile(false);
    }
  };

  // Persisted collapsed groups
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

  // Permission helpers
  const isAllowed = (key: string) => allowedSections === null || allowedSections.includes(key);
  const isPlatformAdmin = canManageAccess && dealershipId === "default";
  const isManager = isManagerRole(userRole) || canManageAccess;

  // Permission helpers for acquisition / pipeline items
  const isAcquisitionStaff =
    isManager ||
    userRole === "sales_bdc" ||
    userRole === "sales" ||
    userRole === "internet_manager" ||
    canManageAccess;
  const isCheckInStaff =
    isAcquisitionStaff || userRole === "inspector" || userRole === "receptionist";
  const canSeeAppraiserQueue = isManager || isAppraiser;
  // Receptionist is locked to Appointments + Check-In. Nothing else in
  // the sidebar should render for them — they're a front-desk role,
  // not an ops role.
  const isReceptionist = userRole === "receptionist";

  // ── PIPELINE ── (All staff see Leads & Appointments; Performance & Appraiser Queue are manager+)
  const pipelineItems: SidebarItem[] = [
    { key: "submissions", label: "All Leads", icon: Inbox, badge: submissionCount > 0 ? String(submissionCount) : undefined },
    { key: "accepted-appts", label: "Appointments", icon: CalendarDays, badge: appointmentCount > 0 ? String(appointmentCount) : undefined },
    ...(canSeeAppraiserQueue
      ? [{
          key: "appraiser-queue",
          label: "Appraiser Queue",
          icon: UserCheck,
          badge: appraiserQueueCount > 0 ? String(appraiserQueueCount) : undefined,
          badgeVariant: "destructive" as const,
        }]
      : []),
    ...(isManager ? [{ key: "executive", label: "Performance", icon: BarChart3 }] : []),
  ].filter((item) => isAllowed(item.key));

  // ── ACQUISITION ── (Manager+ — daily operational tools)
  const acquisitionItems: SidebarItem[] = [
    ...(isCheckInStaff
      ? [{ key: "inspection-checkin", label: "Inspection Check-In", icon: ScanLine }]
      : []),
    ...(isAcquisitionStaff
      ? [{ key: "service-quick-entry", label: "Service Quick Entry", icon: Zap }]
      : []),
    ...(isManager
      ? [{ key: "equity-mining", label: "Equity Mining", icon: TrendingUp }]
      : []),
    ...(isManager
      ? [{ key: "voice-ai", label: "Voice AI", icon: Phone }]
      : []),
    ...(canManageAccess ? [{ key: "image-inventory", label: "Vehicle Images", icon: Car }] : []),
    ...(isManager && (enterpriseBetaEnabled || isPlatformAdmin)
      ? [{ key: "wholesale-marketplace", label: "Wholesale Marketplace", icon: Store }]
      : []),
  ].filter((item) => isAllowed(item.key));

  // ── CONFIGURATION ── (Offer Logic is manager+; rest is admin-only)
  // Promotions and Referral Program live together — both are marketing programs.
  const configItems: SidebarItem[] = [
    ...(isManager ? [{ key: "offer-settings", label: "Offer Logic", icon: SlidersHorizontal, badge: pricingAccessRequestCount > 0 ? String(pricingAccessRequestCount) : undefined, badgeVariant: "destructive" as const }] : []),
    ...(canManageAccess ? [
      { key: "form-config", label: "Lead Form", icon: ListChecks },
      { key: "inspection-config", label: "Inspection Sheet", icon: Shield },
      { key: "photo-config", label: "Photo Requirements", icon: Camera },
      { key: "depth-policies", label: "Inspection Standards", icon: Gauge },
      { key: "promotions", label: "Promotions", icon: Megaphone },
      { key: "referrals", label: "Referral Program", icon: Gift },
      { key: "notifications", label: "Notifications", icon: Bell },
    ] : []),
  ].filter((item) => isAllowed(item.key));

  // ── STOREFRONT ── (Admin-only — customer-facing content)
  const storefrontItems: SidebarItem[] = canManageAccess
    ? [
        { key: "site-config", label: "Branding", icon: Palette },
        { key: "landing-flow", label: "Landing & Flow", icon: Layout },
        ...(locationCount > 1 ? [{ key: "locations", label: "Locations", icon: MapPin }] : []),
        ...(locationCount > 1 ? [{ key: "rooftop-websites", label: "Rooftop Websites", icon: Globe }] : []),
        { key: "testimonials", label: "Testimonials", icon: MessageSquareQuote },
        { key: "embed-toolkit", label: "Website Embed", icon: Code2 },
        ...(enterpriseBetaEnabled || isPlatformAdmin
          ? [{ key: "white-label", label: "White Label", icon: Paintbrush }]
          : []),
      ].filter((item) => isAllowed(item.key))
    : [];

  // ── MY TOOLS ── (Visible to all staff — personal items)
  // My Referrals uses Award (not Gift) so it doesn't collide visually with the
  // admin Referral Program entry in Configuration.
  const myToolsItems: SidebarItem[] = [
    { key: "my-lead-link", label: "My Lead Link", icon: Link2 },
    { key: "my-referrals", label: "My Referrals", icon: Award },
  ];

  // ── INSIGHTS ── (Reports + Compliance — oversight tooling)
  const insightsItems: SidebarItem[] = [
    ...(isManager ? [{ key: "reports", label: "Reports & Export", icon: Send }] : []),
    { key: "compliance", label: "Compliance", icon: ShieldCheck },
  ].filter((item) => isAllowed(item.key));

  // ── ADMIN ── (Dealer-level setup — staff, account, system)
  const teamBadgeCount = canManageAccess ? pendingRequestCount + permissionRequestCount : 0;
  const adminItems: SidebarItem[] = [
    ...(canManageAccess ? [{ key: "onboarding", label: "Dealer Setup", icon: Rocket }] : []),
    ...(canManageAccess ? [{ key: "staff", label: "Staff & Permissions", icon: Users, badge: teamBadgeCount > 0 ? String(teamBadgeCount) : undefined, badgeVariant: "destructive" as const }] : []),
    ...(canManageAccess ? [{ key: "system-settings", label: "System Settings", icon: Wrench }] : []),
    // Edits the entries shown on the public /updates page (footer link).
    // Lives here, not under System Settings, because it's content management.
    ...(canManageAccess ? [{ key: "changelog", label: "Platform Updates", icon: ScrollText }] : []),
  ].filter((item) => isAllowed(item.key));

  // ── INTEGRATIONS ── (Enterprise — third-party connectors)
  const integrationsItems: SidebarItem[] = [
    ...(canManageAccess && (enterpriseBetaEnabled || isPlatformAdmin)
      ? [{ key: "integrations-status", label: "Integrations", icon: Activity }]
      : []),
    ...(canManageAccess && (enterpriseBetaEnabled || isPlatformAdmin)
      ? [{ key: "api-access", label: "API Access", icon: Code2 }]
      : []),
    ...(canManageAccess && (enterpriseBetaEnabled || isPlatformAdmin)
      ? [{ key: "vauto-integration", label: "vAuto Integration", icon: Truck }]
      : []),
  ].filter((item) => isAllowed(item.key));

  // ── PLATFORM ── (Platform admin only — cross-tenant operations)
  const platformItems: SidebarItem[] = [
    ...(isPlatformAdmin ? [{ key: "tenants", label: "Dealer Tenants", icon: Network }] : []),
    ...(isPlatformAdmin ? [{ key: "pricing-model", label: "Pricing Model", icon: DollarSign }] : []),
    ...(canManageAccess && (enterpriseBetaEnabled || isPlatformAdmin)
      ? [{ key: "platform-billing", label: "Platform & Billing", icon: CreditCard }]
      : []),
  ].filter((item) => isAllowed(item.key));

  // Locked sections for "Request Access"
  const allSectionKeys = [
    "submissions", "accepted-appts", "executive", "appraiser-queue",
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

  // Check if group contains active section
  const groupContainsActive = (items: { key: string }[]) => items.some((item) => item.key === activeSection);

  // Auto-expand the group containing the active section
  const groupEntries: [string, SidebarItem[]][] = isReceptionist
    ? [
        // Receptionist nav is intentionally tiny — they check customers
        // in and see today's appointments. Nothing else is relevant to
        // their job and extra items just add visual noise at the front
        // desk.
        ["Pipeline", pipelineItems.filter((i) => i.key === "accepted-appts")],
        ["Acquisition", acquisitionItems.filter((i) => i.key === "inspection-checkin")],
        ["My Tools", myToolsItems],
      ]
    : [
        ["Pipeline", pipelineItems],
        ["Acquisition", acquisitionItems],
        ["Configuration", configItems],
        ["Storefront", storefrontItems],
        ["My Tools", myToolsItems],
        ["Insights", insightsItems],
        ["Admin", adminItems],
        ["Integrations", integrationsItems],
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
                        onClick={() => handleItemClick(item.key)}
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
        {renderGroup("Pipeline", pipelineItems)}
        {renderGroup("Acquisition", acquisitionItems)}
        {renderGroup("Configuration", configItems)}
        {renderGroup("Storefront", storefrontItems)}
        {renderGroup("My Tools", myToolsItems)}
        {renderGroup("Insights", insightsItems)}
        {renderGroup("Admin", adminItems)}
        {renderGroup("Integrations", integrationsItems)}
        {renderGroup("Platform", platformItems)}

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
          {/* Platform Updates lives at Admin → Platform Updates (the editor
              there links out to the public /updates page). The duplicate
              footer entry was removed to keep one source of truth. */}
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
