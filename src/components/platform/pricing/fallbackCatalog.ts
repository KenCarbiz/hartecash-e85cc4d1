import type {
  PlatformBundle,
  PlatformProduct,
  PlatformProductTier,
} from "@/lib/entitlements";

/**
 * Hardcoded pricing catalog — the authoritative prices dictated
 * by the dealer on 2026-04-14. Used as a fallback when the
 * PlatformContext hasn't populated (e.g. before the DB seed
 * migration has run on the environment). Guarantees the
 * Billing & Plan picker always renders correctly.
 *
 * When the DB-seeded catalog is present and has rows, it wins.
 * This module is just a safety net so the UI never blanks out.
 *
 * Prices are per rooftop. `annual_price` stores the full 12-month
 * prepaid amount; divide by 12 for the per-month-equivalent label.
 *
 * Row ordering (sort_order, user direction):
 *   1. AutoCurb     — off-street acquisition
 *   2. AutoLabels   — stickers + FTC compliance
 *   3. AutoFrame    — AI photo booth
 *   4. AutoFilm     — video MPI
 *  (bundle: All-Apps Unlimited, featured at the bottom)
 */

export const FALLBACK_PRODUCTS: PlatformProduct[] = [
  {
    id: "autocurb",
    name: "AutoCurb",
    description:
      "Off-street vehicle acquisition — instant offers, inspections, and appraisals.",
    icon_name: "Car",
    base_url: "https://autocurb.io",
    is_active: true,
    sort_order: 1,
  },
  {
    id: "autolabels",
    name: "AutoLabels",
    description:
      "Window stickers, addendums, and FTC compliance with customer signoff.",
    icon_name: "Tag",
    base_url: "https://autolabels.io",
    is_active: true,
    sort_order: 2,
  },
  {
    id: "autoframe",
    name: "AutoFrame",
    description:
      "AI-powered vehicle photography — inventory-tiered pricing for every lot.",
    icon_name: "Camera",
    base_url: "https://autoframe.io",
    is_active: true,
    sort_order: 3,
  },
  {
    id: "autofilm",
    name: "AutoFilm",
    description:
      "Video MPI for sales and service — walkarounds, customer-facing delivery.",
    icon_name: "Video",
    base_url: "https://autofilm.io",
    is_active: true,
    sort_order: 4,
  },
];

export const FALLBACK_TIERS: PlatformProductTier[] = [
  // AutoCurb — one tier, Monthly vs Annual-Prepaid pair in the UI
  {
    id: "autocurb_standard",
    product_id: "autocurb",
    name: "AutoCurb",
    description:
      "Full acquisition stack — unlimited submissions, instant cash offers, inspection workflow.",
    monthly_price: 1995,
    annual_price: 20388, // $1,699/mo × 12 = $20,388 prepaid
    features: [
      "Unlimited customer submissions",
      "Instant cash offers",
      "VIN & plate decoding",
      "Inspection workflow",
      "Mobile appraisal",
      "Dealer dashboard",
      "Advanced reporting",
      "API access",
      "Multi-user roles",
      "Priority support",
    ],
    inventory_limit: null,
    included_with_product_ids: [],
    is_introductory: false,
    is_active: true,
    sort_order: 0,
  },

  // AutoLabels Basic — free with AutoCurb OR with AutoLabels Premium
  {
    id: "autolabels_base",
    product_id: "autolabels",
    name: "Basic",
    description:
      "Unlimited window stickers and addendums for new and used vehicles.",
    monthly_price: 399,
    annual_price: 3990,
    features: [
      "Unlimited new-car addendums",
      "Unlimited used-car addendums",
      "FTC Used Car Buyers Guide",
      "Standard templates",
      "Print + digital formats",
    ],
    inventory_limit: null,
    // Free with AutoCurb (any tier) OR AutoLabels Premium (same product_id matches).
    included_with_product_ids: ["autocurb", "autolabels"],
    is_introductory: false,
    is_active: true,
    sort_order: 0,
  },

  // AutoLabels Premium
  {
    id: "autolabels_pro",
    product_id: "autolabels",
    name: "Premium",
    description:
      "End-to-end FTC compliance with accessory tracking, customer disclosure, and signoffs. Compliant in all 50 states.",
    monthly_price: 899,
    annual_price: 8990,
    features: [
      "Everything in Standard",
      "FTC CARS Rule compliance",
      "Per-vehicle accessory tracking (installed + optional)",
      "Customer disclosure + e-signature",
      "Dealer signoff + retained audit trail",
      "Compliant in all 50 states",
      "Deal-jacket export",
      "Priority support",
    ],
    inventory_limit: null,
    included_with_product_ids: [],
    is_introductory: false,
    is_active: true,
    sort_order: 1,
  },

  // AutoFilm — one tier, Monthly vs Annual-Prepaid pair in the UI.
  // $899/mo × 12 = $10,788 annual prepaid.
  {
    id: "autofilm_full",
    product_id: "autofilm",
    name: "AutoFilm",
    description:
      "Sales walkaround videos and service MPI — one subscription covers both departments.",
    monthly_price: 999,
    annual_price: 10788,
    features: [
      "Sales walkaround videos",
      "Service MPI videos",
      "Customer-facing video delivery",
      "SMS + email distribution",
      "AI transcription",
      "Performance analytics",
      "Priority support",
    ],
    inventory_limit: null,
    included_with_product_ids: [],
    is_introductory: false,
    is_active: true,
    sort_order: 0,
  },

  // AutoFrame — inventory-tiered. Captions are short + evocative so
  // the 3-column row reads like a Michelin menu, not a spec sheet.
  {
    id: "autoframe_70",
    product_id: "autoframe",
    name: "75 Vehicles",
    description: "Perfect for smaller lots",
    monthly_price: 399,
    annual_price: 3990,
    features: [
      "AI background removal",
      "Consistent studio lighting",
      "Up to 75 active vehicles",
      "Standard turnaround",
      "Email support",
    ],
    inventory_limit: 75,
    included_with_product_ids: [],
    is_introductory: false,
    is_active: true,
    sort_order: 0,
  },
  {
    id: "autoframe_120",
    product_id: "autoframe",
    name: "125 Vehicles",
    description: "Growing inventories",
    monthly_price: 599,
    annual_price: 5990,
    features: [
      "Everything in 75-unit",
      "Up to 125 active units",
      "Priority turnaround",
      "Chat + email support",
    ],
    inventory_limit: 125,
    included_with_product_ids: [],
    is_introductory: false,
    is_active: true,
    sort_order: 1,
  },
  {
    id: "autoframe_unlimited",
    product_id: "autoframe",
    name: "Unlimited",
    description: "High-volume lots & groups",
    monthly_price: 799,
    annual_price: 7990,
    features: [
      "Everything in 125-unit",
      "Unlimited active units",
      "Rush turnaround SLA",
      "Dedicated account manager",
    ],
    inventory_limit: null,
    included_with_product_ids: [],
    is_introductory: false,
    is_active: true,
    sort_order: 2,
  },
];

export const FALLBACK_BUNDLES: PlatformBundle[] = [
  {
    id: "all_apps_unlimited",
    name: "All-Apps Unlimited",
    description:
      "Every app at its top tier, unlimited usage, with white-glove onboarding, a dedicated Customer Success Manager, priority 24/7 support, and quarterly business reviews. Per rooftop.",
    monthly_price: 3999,
    // $3,499/mo × 12 = $41,988 annual prepaid
    annual_price: 41988,
    product_ids: ["autocurb", "autolabels", "autofilm", "autoframe"],
    is_featured: true,
    is_enterprise: false,
    sort_order: 0,
  },
  {
    id: "enterprise_group",
    name: "Enterprise (Dealer Groups)",
    description:
      "For dealer groups operating multiple rooftops. Everything in All-Apps Unlimited plus cross-rooftop reporting, SSO, named CSM, dedicated onboarding engineers, and negotiated group pricing.",
    monthly_price: 0,
    annual_price: 0,
    product_ids: ["autocurb", "autolabels", "autofilm", "autoframe"],
    is_featured: false,
    is_enterprise: true,
    sort_order: 1,
  },
];
