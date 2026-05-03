import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";

// Group + label maps follow the post-audit sidebar structure (May 2026).
// Legacy section keys (executive, gm-hud, channels, notifications,
// compliance, site-config, appearance, landing-flow, form-config,
// inspection-config, photo-config, depth-policies, promotions,
// referrals, testimonials, bdc-queue, bdc-calls, white-label, etc.) all
// keep working — they resolve to the right hub on the right tab via
// AdminSectionRenderer, and the breadcrumb shows the hub label so the
// user sees a consistent location even when arriving via a deep link.

const SECTION_GROUPS: Record<string, string> = {
  // Queues
  submissions: "Queues",
  "offer-pending": "Queues",
  "offer-accepted": "Queues",
  "accepted-appts": "Queues",
  "appraiser-queue": "Queues",
  "bdc-hub": "Queues",
  "bdc-queue": "Queues",
  "bdc-calls": "Queues",

  // Lane Tools (was "Floor Tools")
  "inspection-checkin": "Lane Tools",
  "service-quick-entry": "Lane Tools",

  // Grow
  "equity-mining": "Grow",
  "voice-ai": "Grow",
  "wholesale-marketplace": "Grow",

  // Measure
  performance: "Measure",
  executive: "Measure",
  "gm-hud": "Measure",
  reports: "Measure",

  // Setup · Dealer
  "offer-settings": "Setup · Dealer",
  branding: "Setup · Dealer",
  "site-config": "Setup · Dealer",
  appearance: "Setup · Dealer",
  "landing-flow": "Setup · Dealer",
  communications: "Setup · Dealer",
  channels: "Setup · Dealer",
  notifications: "Setup · Dealer",
  compliance: "Setup · Dealer",
  "capture-inspection": "Setup · Dealer",
  "form-config": "Setup · Dealer",
  "inspection-config": "Setup · Dealer",
  "photo-config": "Setup · Dealer",
  "depth-policies": "Setup · Dealer",
  locations: "Setup · Dealer",

  // Setup · Process
  marketing: "Setup · Process",
  promotions: "Setup · Process",
  referrals: "Setup · Process",
  testimonials: "Setup · Process",
  "rooftop-websites": "Setup · Process",
  "embed-toolkit": "Setup · Process",

  // Integrations (enterprise)
  integrations: "Integrations",
  "integrations-status": "Integrations",
  "api-access": "Integrations",
  "vauto-integration": "Integrations",
  "white-label": "Integrations",

  // My
  "my-lead-link": "My",
  "my-availability": "My",
  "my-referrals": "My",

  // Account
  staff: "Account",
  onboarding: "Account",
  "onboarding-script": "Account",
  "system-settings": "Account",
  "image-inventory": "Account",
  "data-egress": "Account",

  // Platform
  tenants: "Platform",
  groups: "Platform",
  "prospect-demo": "Platform",
  "pricing-model": "Platform",
  "platform-billing": "Platform",
  changelog: "Platform",
};

const SECTION_LABELS: Record<string, string> = {
  // Queues
  submissions: "All Leads",
  "offer-pending": "Offer Pending",
  "offer-accepted": "Offer Accepted",
  "accepted-appts": "Appointments",
  "appraiser-queue": "Appraiser Queue",
  "bdc-hub": "BDC Queue",
  "bdc-queue": "BDC Queue · Priority",
  "bdc-calls": "BDC Queue · Calls Today",

  // Lane Tools
  "inspection-checkin": "Inspection Check-In",
  "service-quick-entry": "Service Quick Entry",

  // Grow
  "equity-mining": "Equity Mining",
  "voice-ai": "Voice AI",
  "wholesale-marketplace": "Wholesale",

  // Measure
  performance: "Performance",
  executive: "Performance · KPI",
  "gm-hud": "Performance · GM HUD",
  reports: "Reports & Export",

  // Setup · Dealer
  "offer-settings": "Pricing Rules",
  branding: "Branding",
  "site-config": "Branding · Identity",
  appearance: "Branding · Appearance",
  "landing-flow": "Branding · Landing",
  communications: "Communications",
  channels: "Communications · Channels",
  notifications: "Communications · Notifications",
  compliance: "Communications · Compliance",
  "capture-inspection": "Capture & Inspection",
  "form-config": "Capture & Inspection · Lead Form",
  "inspection-config": "Capture & Inspection · Inspection Sheet",
  "photo-config": "Capture & Inspection · Photos",
  "depth-policies": "Capture & Inspection · Standards",
  locations: "Locations",

  // Setup · Process
  marketing: "Marketing",
  promotions: "Marketing · Promotions",
  referrals: "Marketing · Referrals",
  testimonials: "Marketing · Testimonials",
  "rooftop-websites": "Rooftop Websites",
  "embed-toolkit": "Website Embed",

  // Integrations
  integrations: "Integrations",
  "integrations-status": "Integrations · Status",
  "api-access": "Integrations · API Access",
  "vauto-integration": "Integrations · vAuto",
  "white-label": "Integrations · White Label",

  // My
  "my-lead-link": "My Lead Link",
  "my-availability": "My Availability",
  "my-referrals": "My Referrals",

  // Account
  staff: "Staff & Permissions",
  onboarding: "Onboarding Wizard",
  "onboarding-script": "Onboarding Script",
  "system-settings": "System Settings",
  "image-inventory": "Vehicle Image Cache",
  "data-egress": "Export My Data",

  // Platform
  tenants: "Dealer Tenants",
  groups: "Group Management",
  "prospect-demo": "Prospect Demo",
  "pricing-model": "SaaS Pricing",
  "platform-billing": "Platform & Billing",
  changelog: "Platform Updates",
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
