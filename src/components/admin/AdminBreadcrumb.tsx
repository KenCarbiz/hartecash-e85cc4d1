import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";

const SECTION_GROUPS: Record<string, string> = {
  submissions: "Queues",
  "offer-pending": "Queues",
  "offer-accepted": "Queues",
  "accepted-appts": "Queues",
  "appraiser-queue": "Queues",
  "bdc-queue": "Queues",
  executive: "Measure",
  "gm-hud": "Measure",
  reports: "Measure",
  "inspection-checkin": "Floor Tools",
  "service-quick-entry": "Floor Tools",
  "image-inventory": "Floor Tools",
  "equity-mining": "Grow",
  "voice-ai": "Grow",
  "wholesale-marketplace": "Grow",
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
  staff: "Account",
  referrals: "Setup · Process",
  compliance: "Measure",
  onboarding: "Account",
  "onboarding-script": "Account",
  "system-settings": "Account",
  tenants: "Platform",
  "prospect-demo": "Platform",
};

const SECTION_LABELS: Record<string, string> = {
  submissions: "All Leads",
  "offer-pending": "Offer Pending",
  "offer-accepted": "Offer Accepted",
  "accepted-appts": "Appointments",
  "appraiser-queue": "Appraiser Queue",
  "bdc-queue": "BDC Priority Queue",
  executive: "Performance",
  "gm-hud": "GM HUD",
  "inspection-checkin": "Inspection Check-In",
  "service-quick-entry": "Service Quick Entry",
  "equity-mining": "Equity Mining",
  "voice-ai": "Voice AI",
  "wholesale-marketplace": "Wholesale",
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
  "prospect-demo": "Prospect Demo",
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
