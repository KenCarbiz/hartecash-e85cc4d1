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
  Settings, Bell, ListChecks, MessageSquareQuote, BarChart3, Send, UserCheck, MapPin, Car, ScrollText, Newspaper, Shield, Lock, Wrench, MessageCircle, Rocket, Gauge
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";

interface AdminSidebarProps {
  activeSection: string;
  onSectionChange: (section: string) => void;
  canManageAccess: boolean;
  submissionCount: number;
  appointmentCount: number;
  pendingRequestCount: number;
  permissionRequestCount?: number;
  pricingAccessRequestCount?: number;
  allowedSections?: string[] | null; // null = unrestricted (admin)
  showRequestAccess?: boolean;
  onRequestAccess?: (sectionKey: string) => void;
  locationCount?: number;
  userRole?: string;
}

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
}: AdminSidebarProps) => {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const navigate = useNavigate();

  const isAllowed = (key: string) => allowedSections === null || allowedSections.includes(key);

  // ── Pipeline (daily ops) ──
  const pipelineItems = [
    { key: "submissions", label: "Submissions", icon: Inbox, badge: submissionCount > 0 ? String(submissionCount) : undefined },
    { key: "appraisals", label: "Appraisals", icon: Car, badge: undefined },
    { key: "appointments", label: "Appointments", icon: CalendarDays, badge: appointmentCount > 0 ? String(appointmentCount) : undefined },
    { key: "executive", label: "Performance", icon: BarChart3 },
  ].filter((item) => isAllowed(item.key));

  // ── Team (people & access) — Permissions & Access Requests merged into Staff ──
  const teamBadgeCount = (canManageAccess ? pendingRequestCount + permissionRequestCount : 0);
  const teamItems = canManageAccess
    ? [
        { key: "staff", label: "Staff & Permissions", icon: Users, badge: teamBadgeCount > 0 ? String(teamBadgeCount) : undefined, badgeVariant: "destructive" as const },
      ].filter((item) => isAllowed(item.key))
    : [];

  // ── Lead Flow (acquisition engine) ──
  const leadFlowItems = (canManageAccess || userRole === "gsm_gm")
    ? [
        { key: "offer-settings", label: "Offer Builder", icon: SlidersHorizontal, badge: pricingAccessRequestCount > 0 ? String(pricingAccessRequestCount) : undefined, badgeVariant: "destructive" as const },
        ...(canManageAccess ? [{ key: "form-config", label: "Lead Form", icon: ListChecks }] : []),
        ...(canManageAccess ? [{ key: "inspection-config", label: "Inspection Sheet", icon: Shield }] : []),
        ...(canManageAccess ? [{ key: "depth-policies", label: "Depth Policies", icon: Gauge }] : []),
        ...(canManageAccess ? [{ key: "notifications", label: "Notifications", icon: Bell }] : []),
      ].filter((item) => isAllowed(item.key))
    : [];

  // ── Storefront (brand & presence) ──
  const storefrontItems = canManageAccess
    ? [
        { key: "site-config", label: "Branding", icon: Settings },
        ...(locationCount > 1 ? [{ key: "locations", label: "Locations", icon: MapPin }] : []),
        { key: "testimonials", label: "Testimonials", icon: MessageSquareQuote },
      ].filter((item) => isAllowed(item.key))
    : [];

  // ── Compliance (merged into single tabbed page) ──
  const complianceItems = [
    { key: "compliance", label: "Compliance", icon: ShieldCheck },
  ].filter((item) => isAllowed(item.key) || isAllowed("consent") || isAllowed("comm-log"));

  // ── Tools (utilities — consolidated) ──
  const toolsItems = [
    { key: "reports", label: "Reports & Export", icon: Send },
    ...(canManageAccess ? [{ key: "image-inventory", label: "Vehicle Images", icon: Car }] : []),
    ...(canManageAccess ? [{ key: "system-settings", label: "System Settings", icon: Wrench }] : []),
    { key: "onboarding", label: "Dealer Setup Guide", icon: Rocket },
  ].filter((item) => isAllowed(item.key));

  // Collect locked sections for "Request Access" display
  const allSectionKeys = ["submissions", "appraisals", "appointments", "executive", "staff", "offer-settings", "form-config", "inspection-config", "depth-policies", "notifications", "site-config", "locations", "testimonials", "compliance", "image-inventory", "reports", "system-settings"];
  const lockedSections = showRequestAccess && allowedSections !== null
    ? allSectionKeys.filter((k) => !allowedSections.includes(k))
    : [];

  const renderGroup = (label: string, items: { key: string; label: string; icon: React.ElementType; badge?: string; badgeVariant?: string }[]) => {
    if (items.length === 0) return null;
    return (
      <SidebarGroup>
        <SidebarGroupLabel className="text-[10px] uppercase tracking-widest font-bold text-sidebar-foreground/50">
          {label}
        </SidebarGroupLabel>
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
      </SidebarGroup>
    );
  };

  return (
    <Sidebar collapsible="icon" className="border-r border-border">
      <SidebarContent className="pt-2">
        {renderGroup("Pipeline", pipelineItems)}
        {renderGroup("Team", teamItems)}
        {renderGroup("Lead Flow", leadFlowItems)}
        {renderGroup("Storefront", storefrontItems)}
        {renderGroup("Compliance", complianceItems)}
        {renderGroup("Tools", toolsItems)}

        {/* Request Access section for non-admins */}
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
