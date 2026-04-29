/**
 * Built-in default per-role per-section visibility. Mirrors the
 * hardcoded gates inside AdminSidebar.tsx so the matrix UI starts
 * from the right baseline. Tenant admins can override per row
 * via the tenant_role_section_permissions table.
 *
 * Sections any authenticated staff member sees are listed under
 * `user` (and inherited by every more-privileged role). The
 * DEFAULT_ROLES array drives column order in the matrix.
 */

export const DEFAULT_ROLES = [
  "admin",
  "gsm_gm",
  "gm",
  "used_car_manager",
  "new_car_manager",
  "internet_manager",
  "sales_bdc",
  "sales",
  "receptionist",
  "user",
] as const;
export type RoleKey = (typeof DEFAULT_ROLES)[number];

export const SECTION_GROUPS: Array<{ label: string; sections: Array<{ key: string; label: string }> }> = [
  {
    label: "Work",
    sections: [
      { key: "today", label: "Today" },
      { key: "submissions", label: "All Leads" },
      { key: "appraiser-queue", label: "Appraiser Queue" },
      { key: "accepted-appts", label: "Appointments" },
      { key: "bdc-queue", label: "BDC Priority Queue" },
      { key: "my-lead-link", label: "My Lead Link" },
      { key: "my-referrals", label: "My Referrals" },
      { key: "my-availability", label: "My Availability" },
    ],
  },
  {
    label: "Floor Tools",
    sections: [
      { key: "inspection-checkin", label: "Inspection Check-In" },
      { key: "service-quick-entry", label: "Service Quick Entry" },
      { key: "image-inventory", label: "Vehicle Images" },
    ],
  },
  {
    label: "Grow",
    sections: [
      { key: "equity-mining", label: "Equity Mining" },
      { key: "voice-ai", label: "Voice AI" },
      { key: "wholesale-marketplace", label: "Wholesale" },
    ],
  },
  {
    label: "Measure",
    sections: [
      { key: "executive", label: "Performance" },
      { key: "gm-hud", label: "GM HUD" },
      { key: "reports", label: "Reports" },
      { key: "compliance", label: "Compliance" },
    ],
  },
  {
    label: "Setup · Dealer",
    sections: [
      { key: "appearance", label: "Appearance & Access" },
      { key: "channels", label: "Channels" },
      { key: "site-config", label: "Branding" },
      { key: "locations", label: "Locations" },
      { key: "offer-settings", label: "Offer Logic" },
      { key: "form-config", label: "Lead Form" },
      { key: "inspection-config", label: "Inspection Sheet" },
      { key: "photo-config", label: "Photo Requirements" },
      { key: "depth-policies", label: "Inspection Standards" },
    ],
  },
  {
    label: "Setup · Process",
    sections: [
      { key: "promotions", label: "Promotions" },
      { key: "referrals", label: "Referral Program" },
      { key: "notifications", label: "Notifications" },
      { key: "landing-flow", label: "Landing & Flow" },
      { key: "rooftop-websites", label: "Rooftop Websites" },
      { key: "testimonials", label: "Testimonials" },
      { key: "embed-toolkit", label: "Website Embed" },
    ],
  },
  {
    label: "Account",
    sections: [
      { key: "staff", label: "Staff & Permissions" },
      { key: "onboarding", label: "Dealer Setup" },
      { key: "system-settings", label: "System Settings" },
      { key: "changelog", label: "Platform Updates" },
    ],
  },
];

export const ALL_SECTIONS: Array<{ key: string; label: string; group: string }> =
  SECTION_GROUPS.flatMap((g) =>
    g.sections.map((s) => ({ ...s, group: g.label })),
  );

/**
 * Default-allowed map. Returns true if the role sees the section by
 * default (when no override row exists).
 *
 * The current AdminSidebar logic boils down to four tiers:
 *   - admin sees everything
 *   - manager-tier (gsm_gm, gm, used_car_manager, new_car_manager,
 *     internet_manager) sees most "manage and measure" items
 *   - sales-tier (sales_bdc, sales) sees daily-work items
 *   - receptionist sees check-in only
 *   - user (catch-all) sees personal items only
 */
const ADMIN_SET = new Set(ALL_SECTIONS.map((s) => s.key));

const MANAGER_SET = new Set([
  "today", "submissions", "appraiser-queue", "accepted-appts", "bdc-queue",
  "my-lead-link", "my-referrals", "my-availability",
  "inspection-checkin", "service-quick-entry", "image-inventory",
  "equity-mining", "voice-ai",
  "executive", "gm-hud", "reports", "compliance",
  "offer-settings", "channels",
  "promotions", "referrals", "notifications", "testimonials",
]);

const SALES_SET = new Set([
  "today", "submissions", "accepted-appts", "bdc-queue",
  "my-lead-link", "my-referrals", "my-availability",
  "inspection-checkin",
]);

const RECEPTIONIST_SET = new Set([
  "today", "accepted-appts", "inspection-checkin",
  "my-lead-link", "my-referrals", "my-availability",
]);

const USER_SET = new Set([
  "today",
  "my-lead-link", "my-referrals", "my-availability",
]);

const ROLE_DEFAULT_SETS: Record<RoleKey, Set<string>> = {
  admin: ADMIN_SET,
  gsm_gm: MANAGER_SET,
  gm: MANAGER_SET,
  used_car_manager: MANAGER_SET,
  new_car_manager: MANAGER_SET,
  internet_manager: MANAGER_SET,
  sales_bdc: SALES_SET,
  sales: SALES_SET,
  receptionist: RECEPTIONIST_SET,
  user: USER_SET,
};

export function defaultAllowedForRole(role: string, sectionKey: string): boolean {
  const set = ROLE_DEFAULT_SETS[role as RoleKey];
  if (!set) return false;
  return set.has(sectionKey);
}
