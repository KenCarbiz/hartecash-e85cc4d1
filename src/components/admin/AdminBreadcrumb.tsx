import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";

const SECTION_GROUPS: Record<string, string> = {
  submissions: "Pipeline",
  "offer-pending": "Pipeline",
  "offer-accepted": "Pipeline",
  "accepted-appts": "Pipeline",
  executive: "Pipeline",
  "offer-settings": "Configuration",
  "form-config": "Configuration",
  notifications: "Configuration",
  "inspection-config": "Configuration",
  "photo-config": "Configuration",
  "depth-policies": "Configuration",
  "site-config": "Storefront",
  locations: "Storefront",
  testimonials: "Storefront",
  staff: "System",
  compliance: "System",
  reports: "System",
  tenants: "System",
  "image-inventory": "System",
  "system-settings": "System",
  onboarding: "System",
  "onboarding-script": "System",
};

const SECTION_LABELS: Record<string, string> = {
  submissions: "All Leads",
  "offer-pending": "Offer Pending",
  "offer-accepted": "Offer Accepted",
  "accepted-appts": "Appointments",
  executive: "Performance",
  "offer-settings": "Offer Logic",
  "form-config": "Lead Form",
  notifications: "Notifications",
  "inspection-config": "Inspection Sheet",
  "photo-config": "Photo Requirements",
  "depth-policies": "Depth Policies",
  "site-config": "Branding",
  locations: "Locations",
  testimonials: "Testimonials",
  staff: "Staff & Permissions",
  compliance: "Compliance",
  reports: "Reports & Export",
  tenants: "Dealer Tenants",
  "image-inventory": "Vehicle Images",
  "system-settings": "System Settings",
  onboarding: "Dealer Setup",
  "onboarding-script": "Onboarding Script",
};

interface AdminBreadcrumbProps {
  activeSection: string;
  onNavigate: (section: string) => void;
}

const AdminBreadcrumbNav = ({ activeSection, onNavigate }: AdminBreadcrumbProps) => {
  const group = SECTION_GROUPS[activeSection] || "Dashboard";
  const label = SECTION_LABELS[activeSection] || activeSection;

  return (
    <Breadcrumb>
      <BreadcrumbList>
        <BreadcrumbItem>
          <BreadcrumbLink
            className="cursor-pointer text-xs"
            onClick={() => onNavigate("submissions")}
          >
            Dashboard
          </BreadcrumbLink>
        </BreadcrumbItem>
        <BreadcrumbSeparator />
        <BreadcrumbItem>
          <span className="text-xs text-muted-foreground">{group}</span>
        </BreadcrumbItem>
        <BreadcrumbSeparator />
        <BreadcrumbItem>
          <BreadcrumbPage className="text-xs">{label}</BreadcrumbPage>
        </BreadcrumbItem>
      </BreadcrumbList>
    </Breadcrumb>
  );
};

export default AdminBreadcrumbNav;
