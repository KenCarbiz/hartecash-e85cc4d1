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
  Settings, Bell, ListChecks, MessageSquareQuote, BarChart3, Send, MapPin, Car, ScrollText, Shield, Lock, Wrench, Rocket, Gauge, Network, Camera, Gift, Megaphone, ChevronDown, Link2, Code2, Paintbrush, TrendingUp, Store, Truck, Zap, Activity, ScanLine
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

interface AdminSidebarProps {
  activeSection: string;
  onSectionChange: (section: string) => void;
  canManageAccess: boolean;
  submissionCount: number;
  appointmentCount: number;
  pendingRequestCount: number;
  permissionRequestCount?: number;
  pricingAccessRequestCount?: number;
  allowedSections?: string[] | null;
  showRequestAccess?: boolean;
  onRequestAccess?: (sectionKey: string) => void;
  locationCount?: number;
  userRole?: string;
  dealershipId?: string;
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
 * Visibility rules:
 *   - Pipeline: All staff see Leads & Appointments. Performance is manager+.
 *   - Configuration: Offer Logic is manager+. Everything else is admin-only.
 *   - Storefront: Admin-only.
 *   - Team & Tools: Staff/Permissions is admin-only. Reports is manager+.
 *     My Lead Link & My Referrals are visible to everyone.
 *     Compliance (consent/comm logs) is visible to everyone.
 *     Dealer Setup, Vehicle Images, System Settings, Tenants are admin-only.
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
  allowedSections = null,
  showRequestAccess = false,
  onRequestAccess,
  locationCount = 0,
  userRole = "",
  dealershipId = "default",
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
  const isManager = userRole === "used_car_manager" || userRole === "gsm_gm" || canManageAccess;

  // ── PIPELINE ── (All staff see Leads & Appointments; Performance is manager+)
  const pipelineItems: SidebarItem[] = [
    { key: "submissions", label: "All Leads", icon: Inbox, badge: submissionCount > 0 ? String(submissionCount) : undefined },
    { key: "accepted-appts", label: "Appointments", icon: CalendarDays, badge: appointmentCount > 0 ? String(appointmentCount) : undefined },
    ...(isManager ? [{ key: "executive", label: "Performance", icon: BarChart3 }] : []),
  ].filter((item) => isAllowed(item.key));

  // ── CONFIGURATION ── (Offer Logic is manager+; rest is admin-only)
  const configItems: SidebarItem[] = [
    ...(isManager ? [{ key: "offer-settings", label: "Offer Logic", icon: SlidersHorizontal, badge: pricingAccessRequestCount > 0 ? String(pricingAccessRequestCount) : undefined, badgeVariant: "destructive" as const }] : []),
    ...(canManageAccess ? [
      { key: "form-config", label: "Lead Form", icon: ListChecks },
      { key: "inspection-config", label: "Inspection Sheet", icon: Shield },
      { key: "photo-config", label: "Photo Requirements", icon: Camera },
      { key: "depth-policies", label: "Depth Policies", icon: Gauge },
      { key: "promotions", label: "Promotions", icon: Megaphone },
      { key: "notifications", label: "Notifications", icon: Bell },
    ] : []),
  ].filter((item) => isAllowed(item.key));

  // ── STOREFRONT ── (Admin-only)
  const storefrontItems: SidebarItem[] = canManageAccess
    ? [
        { key: "site-config", label: "Branding", icon: Settings },
        ...(locationCount > 1 ? [{ key: "locations", label: "Locations", icon: MapPin }] : []),
        { key: "testimonials", label: "Testimonials", icon: MessageSquareQuote },
        { key: "embed-toolkit", label: "Website Embed", icon: Wrench },
      ].filter((item) => isAllowed(item.key))
    : [];

  // ── MY TOOLS ── (Visible to all staff — personal items)
  const myToolsItems: SidebarItem[] = [
    { key: "my-lead-link", label: "My Lead Link", icon: Link2 },
    { key: "my-referrals", label: "My Referrals", icon: Gift },
  ];

  // ── TEAM & ADMIN ── (Mixed access levels)
  const teamBadgeCount = canManageAccess ? pendingRequestCount + permissionRequestCount : 0;
  const teamItems: SidebarItem[] = [
    ...(canManageAccess ? [{ key: "staff", label: "Staff & Permissions", icon: Users, badge: teamBadgeCount > 0 ? String(teamBadgeCount) : undefined, badgeVariant: "destructive" as const }] : []),
    ...(canManageAccess ? [{ key: "referrals", label: "Referral Program", icon: Gift }] : []),
    { key: "compliance", label: "Compliance", icon: ShieldCheck },
    ...(isManager ? [{ key: "reports", label: "Reports & Export", icon: Send }] : []),
    ...(canManageAccess ? [{ key: "image-inventory", label: "Vehicle Images", icon: Car }] : []),
    ...(canManageAccess ? [{ key: "onboarding", label: "Dealer Setup", icon: Rocket }] : []),
    ...(canManageAccess ? [{ key: "system-settings", label: "System Settings", icon: Wrench }] : []),
    ...(isPlatformAdmin ? [{ key: "tenants", label: "Dealer Tenants", icon: Network }] : []),
  ].filter((item) => isAllowed(item.key));

  // ── ENTERPRISE ── (Admin-only — API & White Label features)
  const enterpriseItems: SidebarItem[] = canManageAccess
    ? [
        { key: "integrations-status", label: "Integrations Status", icon: Activity },
        { key: "api-access", label: "API Access", icon: Code2 },
        { key: "vauto-integration", label: "vAuto Integration", icon: Truck },
        { key: "white-label", label: "White Label", icon: Paintbrush },
      ].filter((item) => isAllowed(item.key))
    : [];

  // ── ACQUISITION ── (Manager+ — equity mining & wholesale.
  //    Service Quick Entry is visible to all staff roles including sales_bdc.
  //    Inspection Check-In is also visible to inspector role.)
  const isAcquisitionStaff =
    isManager || userRole === "sales_bdc" || canManageAccess;
  const isCheckInStaff =
    isAcquisitionStaff || userRole === "inspector";
  const acquisitionItems: SidebarItem[] = [
    ...(isCheckInStaff
      ? [{ key: "inspection-checkin", label: "Inspection Check-In", icon: ScanLine }]
      : []),
    ...(isAcquisitionStaff
      ? [{ key: "service-quick-entry", label: "Service Quick Entry", icon: Zap }]
      : []),
    ...(isManager
      ? [
          { key: "equity-mining", label: "Equity Mining", icon: TrendingUp },
          { key: "wholesale-marketplace", label: "Wholesale Exit", icon: Store },
        ]
      : []),
  ].filter((item) => isAllowed(item.key));

  // Locked sections for "Request Access"
  const allSectionKeys = [
    "submissions", "accepted-appts", "executive",
    "offer-settings", "form-config", "inspection-config", "photo-config",
    "depth-policies", "promotions", "notifications",
    "site-config", "locations", "testimonials", "embed-toolkit",
    "my-lead-link", "my-referrals",
    "staff", "referrals", "compliance", "reports", "image-inventory",
    "onboarding", "system-settings",
    "integrations-status", "api-access", "vauto-integration", "white-label",
    "equity-mining", "wholesale-marketplace", "service-quick-entry", "inspection-checkin",
  ];
  const lockedSections = showRequestAccess && allowedSections !== null
    ? allSectionKeys.filter((k) => !allowedSections.includes(k))
    : [];

  // Check if group contains active section
  const groupContainsActive = (items: { key: string }[]) => items.some((item) => item.key === activeSection);

  // Auto-expand the group containing the active section
  const groupEntries: [string, SidebarItem[]][] = [
    ["Pipeline", pipelineItems],
    ["Acquisition", acquisitionItems],
    ["Configuration", configItems],
    ["Storefront", storefrontItems],
    ["My Tools", myToolsItems],
    ["Team & Admin", teamItems],
    ["Enterprise", enterpriseItems],
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
        {renderGroup("Team & Admin", teamItems)}
        {renderGroup("Enterprise", enterpriseItems)}

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
          <SidebarMenuItem>
            <SidebarMenuButton
              onClick={() => {
                navigate("/updates");
                if (isMobile) setOpenMobile(false);
              }}
              tooltip={collapsed ? "Platform Updates" : undefined}
              className="transition-all duration-200 dark:hover:bg-white/8"
            >
              <ScrollText className="w-4 h-4 shrink-0" />
              {!collapsed && <span className="flex-1 truncate">Platform Updates</span>}
            </SidebarMenuButton>
          </SidebarMenuItem>
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
              HarteCash
            </p>
            <p className="text-[9px] text-sidebar-foreground/30">
              Enterprise Platform
            </p>
          </div>
        )}
      </SidebarFooter>
    </Sidebar>
  );
};

export default AdminSidebar;
