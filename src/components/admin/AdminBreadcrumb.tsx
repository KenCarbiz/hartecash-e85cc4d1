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
  "inspection-config": "Configuration",
  "photo-config": "Configuration",
  "depth-policies": "Configuration",
  promotions: "Configuration",
  notifications: "Configuration",
  "site-config": "Storefront",
  locations: "Storefront",
  testimonials: "Storefront",
  "embed-toolkit": "Storefront",
  "my-lead-link": "My Tools",
  "my-referrals": "My Tools",
  staff: "Team & Admin",
  referrals: "Team & Admin",
  compliance: "Team & Admin",
  reports: "Team & Admin",
  "image-inventory": "Team & Admin",
  onboarding: "Team & Admin",
  "onboarding-script": "Team & Admin",
  "system-settings": "Team & Admin",
  tenants: "Team & Admin",
};

const SECTION_LABELS: Record<string, string> = {
  submissions: "All Leads",
  "offer-pending": "Offer Pending",
  "offer-accepted": "Offer Accepted",
  "accepted-appts": "Appointments",
  executive: "Performance",
  "offer-settings": "Offer Logic",
  "form-config": "Lead Form",
  "inspection-config": "Inspection Sheet",
  "photo-config": "Photo Requirements",
  "depth-policies": "Depth Policies",
  promotions: "Promotions",
  notifications: "Notifications",
  "site-config": "Branding",
  locations: "Locations",
  testimonials: "Testimonials",
  "embed-toolkit": "Website Embed",
  "my-lead-link": "My Lead Link",
  "my-referrals": "My Referrals",
  staff: "Staff & Permissions",
  referrals: "Referral Program",
  compliance: "Compliance",
  reports: "Reports & Export",
  "image-inventory": "Vehicle Images",
  onboarding: "Dealer Setup",
  "onboarding-script": "Onboarding Script",
  "system-settings": "System Settings",
  tenants: "Dealer Tenants",
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
