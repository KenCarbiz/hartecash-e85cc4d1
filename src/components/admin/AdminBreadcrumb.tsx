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
  staff: "Team",
  "offer-settings": "Lead Flow",
  "form-config": "Lead Flow",
  notifications: "Lead Flow",
  "inspection-config": "Standards",
  "photo-config": "Standards",
  "depth-policies": "Standards",
  "site-config": "Storefront",
  locations: "Storefront",
  testimonials: "Storefront",
  compliance: "Compliance",
  reports: "Tools",
  tenants: "Tools",
  "image-inventory": "Tools",
  "system-settings": "Tools",
  onboarding: "Tools",
  "onboarding-script": "Tools",
};

const SECTION_LABELS: Record<string, string> = {
  submissions: "All Leads",
  "offer-pending": "Offer Pending",
  "offer-accepted": "Offer Accepted",
  "accepted-appts": "Accepted / Appts",
  executive: "Performance",
  staff: "Staff & Permissions",
  "offer-settings": "Offer Logic",
  "form-config": "Lead Form",
  notifications: "Notifications",
  "inspection-config": "Inspection Sheet",
  "photo-config": "Photo Requirements",
  "depth-policies": "Depth Policies",
  "site-config": "Branding",
  locations: "Locations",
  testimonials: "Testimonials",
  compliance: "Compliance",
  reports: "Reports & Export",
  tenants: "Dealer Tenants",
  "image-inventory": "Vehicle Images",
  "system-settings": "System Settings",
  onboarding: "Dealer Setup Guide",
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
