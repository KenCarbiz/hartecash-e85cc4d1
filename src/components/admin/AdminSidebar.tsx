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
  Settings, Bell, ListChecks, MessageSquareQuote, BarChart3, Send, MapPin, Car, ScrollText, Shield, Lock, Wrench, Rocket, Gauge, Network, Camera, Gift, Megaphone, ChevronDown, Link2
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

const STORAGE_KEY = "admin-sidebar-collapsed";

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
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const navigate = useNavigate();

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

  const isAllowed = (key: string) => allowedSections === null || allowedSections.includes(key);
  const isPlatformAdmin = canManageAccess && dealershipId === "default";

  // ── PIPELINE ──
  const pipelineItems = [
    { key: "submissions", label: "All Leads", icon: Inbox, badge: submissionCount > 0 ? String(submissionCount) : undefined },
    { key: "accepted-appts", label: "Appointments", icon: CalendarDays, badge: appointmentCount > 0 ? String(appointmentCount) : undefined },
    { key: "executive", label: "Performance", icon: BarChart3 },
  ].filter((item) => isAllowed(item.key));

  // ── CONFIGURATION ──
  const configItems = [
    ...((canManageAccess || userRole === "gsm_gm") ? [{ key: "offer-settings", label: "Offer Logic", icon: SlidersHorizontal, badge: pricingAccessRequestCount > 0 ? String(pricingAccessRequestCount) : undefined, badgeVariant: "destructive" as const }] : []),
    ...(canManageAccess ? [{ key: "form-config", label: "Lead Form", icon: ListChecks }] : []),
    ...(canManageAccess ? [{ key: "inspection-config", label: "Inspection Sheet", icon: Shield }] : []),
    ...(canManageAccess ? [{ key: "photo-config", label: "Photo Requirements", icon: Camera }] : []),
    ...(canManageAccess ? [{ key: "depth-policies", label: "Depth Policies", icon: Gauge }] : []),
    ...(canManageAccess ? [{ key: "promotions", label: "Promotions", icon: Megaphone }] : []),
    ...(canManageAccess ? [{ key: "notifications", label: "Notifications", icon: Bell }] : []),
  ].filter((item) => isAllowed(item.key));

  // ── STOREFRONT ──
  const storefrontItems = canManageAccess
    ? [
        { key: "site-config", label: "Branding", icon: Settings },
        ...(locationCount > 1 ? [{ key: "locations", label: "Locations", icon: MapPin }] : []),
        { key: "testimonials", label: "Testimonials", icon: MessageSquareQuote },
        { key: "embed-toolkit", label: "Website Embed", icon: Wrench },
      ].filter((item) => isAllowed(item.key))
    : [];

  // ── SYSTEM ──
  const teamBadgeCount = canManageAccess ? pendingRequestCount + permissionRequestCount : 0;
  const systemItems = [
    ...(canManageAccess ? [{ key: "staff", label: "Staff & Permissions", icon: Users, badge: teamBadgeCount > 0 ? String(teamBadgeCount) : undefined, badgeVariant: "destructive" as const }] : []),
    { key: "my-lead-link", label: "My Lead Link", icon: Link2 },
    { key: "my-referrals", label: "My Referrals", icon: Gift },
    ...(canManageAccess ? [{ key: "referrals", label: "Referral Program", icon: Gift }] : []),
    { key: "compliance", label: "Compliance", icon: ShieldCheck },
    { key: "reports", label: "Reports & Export", icon: Send },
    ...(isPlatformAdmin ? [{ key: "tenants", label: "Dealer Tenants", icon: Network }] : []),
    ...(canManageAccess ? [{ key: "image-inventory", label: "Vehicle Images", icon: Car }] : []),
    ...(canManageAccess ? [{ key: "system-settings", label: "System Settings", icon: Wrench }] : []),
    { key: "onboarding", label: "Dealer Setup", icon: Rocket },
  ].filter((item) => isAllowed(item.key) || (item.key === "compliance" && (isAllowed("consent") || isAllowed("comm-log"))) || item.key === "my-referrals");

  // Locked sections for "Request Access"
  const allSectionKeys = ["submissions", "accepted-appts", "executive", "staff", "offer-settings", "form-config", "inspection-config", "depth-policies", "notifications", "site-config", "locations", "testimonials", "compliance", "image-inventory", "reports", "system-settings"];
  const lockedSections = showRequestAccess && allowedSections !== null
    ? allSectionKeys.filter((k) => !allowedSections.includes(k))
    : [];

  // Check if group contains active section
  const groupContainsActive = (items: { key: string }[]) => items.some((item) => item.key === activeSection);

  const renderGroup = (label: string, items: { key: string; label: string; icon: React.ElementType; badge?: string; badgeVariant?: string }[]) => {
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
                        onClick={() => onSectionChange(item.key)}
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
                            variant={(item as any).badgeVariant === "destructive" ? "destructive" : "secondary"}
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
        {renderGroup("Configuration", configItems)}
        {renderGroup("Storefront", storefrontItems)}
        {renderGroup("System", systemItems)}

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
      <SidebarFooter className="p-3 space-y-2">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              onClick={() => navigate("/updates")}
              tooltip={collapsed ? "Platform Updates" : undefined}
              className="transition-all duration-200 dark:hover:bg-white/8"
            >
              <ScrollText className="w-4 h-4 shrink-0" />
              {!collapsed && <span className="flex-1 truncate">Platform Updates</span>}
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
        {!collapsed && (
          <p className="text-[10px] text-sidebar-foreground/40 text-center">
            Admin Portal
          </p>
        )}
      </SidebarFooter>
    </Sidebar>
  );
};

export default AdminSidebar;
