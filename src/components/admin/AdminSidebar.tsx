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
  Settings, Bell, ListChecks, MessageSquareQuote, BarChart3, Send, UserCheck, MapPin, Car, ScrollText, Newspaper
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useNavigate } from "react-router-dom";

interface AdminSidebarProps {
  activeSection: string;
  onSectionChange: (section: string) => void;
  canManageAccess: boolean;
  submissionCount: number;
  appointmentCount: number;
  pendingRequestCount: number;
}

const AdminSidebar = ({
  activeSection,
  onSectionChange,
  canManageAccess,
  submissionCount,
  appointmentCount,
  pendingRequestCount,
}: AdminSidebarProps) => {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";

  const mainItems = [
    { key: "submissions", label: "Submissions", icon: Inbox, badge: submissionCount > 0 ? String(submissionCount) : undefined },
    { key: "appointments", label: "Appointments", icon: CalendarDays, badge: appointmentCount > 0 ? String(appointmentCount) : undefined },
  ];

  const teamItems = canManageAccess
    ? [
        { key: "staff", label: "Staff", icon: Users },
        { key: "requests", label: "Access Requests", icon: UserCheck, badge: pendingRequestCount > 0 ? String(pendingRequestCount) : undefined, badgeVariant: "destructive" as const },
      ]
    : [];

  const complianceItems = [
    { key: "consent", label: "Consent Log", icon: ShieldCheck },
    { key: "follow-ups", label: "Follow-Ups", icon: Send },
    { key: "notification-log", label: "Notification Log", icon: ScrollText },
  ];

  const configItems = canManageAccess
    ? [
        { key: "offer-settings", label: "Offer Settings", icon: SlidersHorizontal },
        { key: "site-config", label: "Site Config", icon: Settings },
        { key: "notifications", label: "Notifications", icon: Bell },
        { key: "form-config", label: "Form Config", icon: ListChecks },
        { key: "testimonials", label: "Testimonials", icon: MessageSquareQuote },
        { key: "comparison", label: "Comparison", icon: BarChart3 },
        { key: "locations", label: "Locations", icon: MapPin },
        { key: "image-inventory", label: "Image Cache", icon: Car },
      ]
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
        {renderGroup("Pipeline", mainItems)}
        {renderGroup("Team", teamItems)}
        {renderGroup("Compliance", complianceItems)}
        {renderGroup("Configuration", configItems)}
      </SidebarContent>
      <SidebarFooter className="p-3">
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
