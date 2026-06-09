/**
 * Admin V2 navigation model.
 *
 * Mirrors the section keys + grouping of the classic AdminSidebar
 * (src/components/admin/AdminSidebar.tsx) so V2 retains every left-bar
 * link and routes into the exact same AdminSectionRenderer sections.
 * The shape is data-only here; AdminSidebarV2 renders it with the sleek
 * V2 chrome. Keep the keys in sync with AdminSidebar's `allSectionKeys`.
 */
import {
  Home, Inbox, RotateCcw, CalendarDays, PhoneCall, LogIn, Wrench,
  TrendingUp, Mic, LineChart, BarChart3, Palette, Phone, FileText,
  MapPin, Settings, Clock, Megaphone, Globe, Code2,
  PanelRightOpen, Activity, Users, CreditCard, Rocket, SlidersHorizontal,
  Image as ImageIcon, Send, Network, ScrollText, Target, Tag, Receipt,
  LayoutDashboard, Briefcase, Gauge,
} from "lucide-react";

export type NavItem = {
  key: string;
  label: string;
  icon: React.ElementType;
  /** Numeric badge (count). Rendered when > 0. */
  badge?: number;
  badgeTone?: "purple" | "red";
  /** When set, navigate via react-router instead of an inline section change. */
  href?: string;
};

export type NavGroup = { label: string; items: NavItem[] };

export type NavFlags = {
  allowedSections: string[] | null;
  isPlatformAdmin: boolean;
  isReceptionist: boolean;
  enterpriseBetaEnabled: boolean;
  locationCount: number;
  submissionCount: number;
  appointmentCount: number;
  appraiserQueueCount: number;
  /** pending access + permission requests, combined onto Staff. */
  teamBadgeCount: number;
  pricingAccessRequestCount: number;
};

/** V2-only pseudo-sections (rendered by the page, not AdminSectionRenderer). */
export const COMMAND_CENTER_KEY = "command-center";
export const ANALYTICS_KEY = "analytics-v2";

export const commandCenterItem: NavItem = {
  key: COMMAND_CENTER_KEY,
  label: "Command Center",
  icon: LayoutDashboard,
};

export const analyticsItem: NavItem = {
  key: ANALYTICS_KEY,
  label: "Analytics",
  icon: BarChart3,
};

/** Pinned items shown above the grouped nav. */
export const pinnedItems: NavItem[] = [commandCenterItem, analyticsItem];

export function buildNavGroups(flags: NavFlags): NavGroup[] {
  const {
    allowedSections, isPlatformAdmin, isReceptionist, enterpriseBetaEnabled,
    locationCount, submissionCount, appointmentCount, appraiserQueueCount,
    teamBadgeCount, pricingAccessRequestCount,
  } = flags;

  const allow = (key: string) => allowedSections === null || allowedSections.includes(key);
  const f = (items: NavItem[]) => items.filter((i) => allow(i.key));

  const work = f([{ key: "today", label: "Today", icon: Home }]);

  // "My Business" consolidates the former My Lead Link + Referral Center
  // into one hub. It's a V2-only surface rendered by the page (not the
  // shared section renderer), so it's shown unconditionally — every staff
  // member gets a personal business page regardless of section grants.
  const myDay: NavItem[] = [
    { key: "my-business", label: "My Business", icon: Briefcase },
    ...f([{ key: "my-availability", label: "Availability Center", icon: Clock }]),
  ];

  const salesFloor = f([
    { key: "submissions", label: "All Leads", icon: Inbox, badge: submissionCount },
    { key: "appraiser-queue", label: "Appraiser Queue", icon: RotateCcw, badge: appraiserQueueCount, badgeTone: "red" },
    { key: "accepted-appts", label: "Appointments", icon: CalendarDays, badge: appointmentCount },
    { key: "bdc-hub", label: "BDC Queue", icon: PhoneCall },
  ]);

  // Lane Tools — a "Lane Dashboard" workspace landing plus the two
  // separate acquisition workflows. The dashboard is a V2-only surface
  // (rendered by the page), shown unconditionally like the other hubs.
  const onTheLot: NavItem[] = [
    { key: "lane-dashboard", label: "Lane Dashboard", icon: Gauge },
    ...f([
      { key: "inspection-checkin", label: "Vehicle Check-In", icon: LogIn },
      { key: "service-quick-entry", label: "Service Drive Capture", icon: Wrench },
    ]),
  ];

  const outreach = f([
    { key: "equity-mining", label: "Equity Mining", icon: TrendingUp },
    { key: "voice-ai", label: "Voice AI", icon: Mic },
  ]);

  const performance = f([
    { key: "performance", label: "Performance", icon: LineChart },
    { key: "reports", label: "Reports", icon: BarChart3 },
  ]);

  const storeSettings = f([
    { key: "branding", label: "Branding", icon: Palette },
    { key: "communications", label: "Communications", icon: Phone },
    { key: "capture-inspection", label: "Capture & Inspection", icon: FileText },
    ...(locationCount > 1 ? [{ key: "locations", label: "Locations", icon: MapPin } as NavItem] : []),
    { key: "offer-settings", label: "Pricing Rules", icon: Settings, badge: pricingAccessRequestCount, badgeTone: "red" },
  ]);

  const marketingSetup = f([
    { key: "marketing", label: "Marketing", icon: Megaphone },
    ...(locationCount > 1 ? [{ key: "rooftop-websites", label: "Rooftop Websites", icon: Globe } as NavItem] : []),
    { key: "embed-toolkit", label: "Website Embed", icon: Code2 },
    { key: "trade-widget", label: "Trade Widget", icon: PanelRightOpen },
  ]);

  const integrations = f(
    enterpriseBetaEnabled || isPlatformAdmin
      ? [{ key: "integrations", label: "Integrations", icon: Activity }]
      : [],
  );

  const account = f([
    { key: "staff", label: "Staff & Permissions", icon: Users, badge: teamBadgeCount, badgeTone: "red" },
    ...(!isPlatformAdmin ? [{ key: "my-plan", label: "Plan", icon: CreditCard, href: "/plan" } as NavItem] : []),
    { key: "onboarding", label: "Onboarding Wizard", icon: Rocket },
    { key: "system-settings", label: "System Settings", icon: SlidersHorizontal },
    { key: "image-inventory", label: "Vehicle Image Cache", icon: ImageIcon },
    { key: "data-egress", label: "Export My Data", icon: Send },
  ]);

  const platform = isPlatformAdmin
    ? f([
        { key: "tenants", label: "Dealer Tenants", icon: Network },
        { key: "groups", label: "Group Management", icon: Network },
        { key: "stripe-webhooks", label: "Stripe Webhooks", icon: Activity },
        { key: "audit-log", label: "Audit Log", icon: ScrollText },
        { key: "prospect-demo", label: "Prospect Demo", icon: Target },
        { key: "pricing-model", label: "SaaS Pricing", icon: Tag },
        { key: "platform-billing", label: "Platform & Billing", icon: Receipt },
        { key: "changelog", label: "Platform Updates", icon: ScrollText },
      ])
    : [];

  // Receptionist nav is intentionally minimal — matches V1 behaviour.
  const groups: NavGroup[] = isReceptionist
    ? [
        { label: "Daily Work", items: work },
        { label: "My Day", items: myDay },
        { label: "Sales Floor", items: salesFloor.filter((i) => i.key === "accepted-appts") },
        { label: "Lane Tools", items: onTheLot.filter((i) => i.key === "inspection-checkin" || i.key === "lane-dashboard") },
      ]
    : [
        { label: "Daily Work", items: work },
        { label: "My Day", items: myDay },
        { label: "Sales Floor", items: salesFloor },
        { label: "Lane Tools", items: onTheLot },
        { label: "Customer Outreach", items: outreach },
        { label: "Performance", items: performance },
        { label: "Store Settings", items: storeSettings },
        { label: "Marketing Setup", items: marketingSetup },
        { label: "Integrations", items: integrations },
        { label: "Account & Plan", items: account },
        { label: "Platform Admin", items: platform },
      ];

  return groups.filter((g) => g.items.length > 0);
}
