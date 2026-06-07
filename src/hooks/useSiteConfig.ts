import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useTenant } from "@/contexts/TenantContext";

export type LandingTemplate =
  | "classic" | "bold" | "minimal" | "elegant" | "showroom"
  | "cinema" | "portal" | "carousel" | "slab" | "diagonal"
  | "pickup" | "magazine" | "circular" | "motion" | "mosaic"
  | "clarity" | "marquee" | "velocity" | "heritage"
  | "moto" | "moto_detailed"
  | "legacy";

export const LANDING_TEMPLATES: { value: LandingTemplate; label: string; description: string }[] = [
  // ── Legacy Hartecash (the pre-audit maximalist look) ──
  { value: "legacy",   label: "Legacy Hartecash", description: "The original Hartecash long-scroll. Hero + form, then every trust signal, value prop, testimonial, and FAQ visible inline. Best for single-rooftop dealers whose conversions came from the long scroll." },
  // ── 2026 sell-flow design audit (recommended starting points) ──
  { value: "moto",          label: "Instant Offer", description: "MotoAcquire-style 8-step instant valuation flow with auto-opt-in monthly value tracker. White background, navy CTA, single tenant variable (button color). Best for dealers who want the simplest, highest-conversion mobile-first surface — and the retention loop that comes with it." },
  { value: "moto_detailed", label: "Instant Offer — Detailed", description: "Premium guided 5-step journey with desktop left rail, live valuation range, trust badges, and a calm one-task-per-screen layout. Modular engine — reorder, inject, or skip steps via dealer config. Best for dealers who want a national-brand feel and higher perceived offer quality." },
  { value: "clarity",  label: "Clarity",  description: "Apple-minimal white. Centered form is the hero. No stock photo, no FAQ above the fold. Best for premium import single-rooftops + EV dealers." },
  { value: "marquee",  label: "Marquee",  description: "Premium dark / luxury. Full-bleed near-black, brass accents, serif headline. Best for BMW / Audi / Lexus / Porsche / Mercedes." },
  { value: "velocity", label: "Velocity", description: "Carvana-style conversion-tuned. Brand-blue gradient, yellow CTA, single social-proof line. Best for mass-market multi-rooftops + domestics." },
  { value: "heritage", label: "Heritage", description: "Family-dealer storytelling. Two-column with a real dealership photo + warm palette. Best for single-rooftop family dealers + regional chains." },
  // ── Originals ──
  { value: "classic",  label: "Classic",  description: "Default split hero with instant-offer form. Choose left, center, or right hero alignment." },
  { value: "bold",     label: "Bold",     description: "Dark, premium, asymmetric. Large display type with one focused CTA — Carvana-style." },
  { value: "minimal",  label: "Minimal",  description: "White space and one giant search box with VIN / Plate / Year-Make-Model tabs." },
  { value: "elegant",  label: "Elegant",  description: "Cream + dark with serif accents and gold borders. Luxury franchise feel." },
  { value: "showroom", label: "Showroom", description: "Inventory grid behind a translucent form card. \u201CWe buy yours, browse ours.\u201D" },
  // ── OEM-style ──
  { value: "cinema",   label: "Cinema",   description: "Full-bleed cinematic hero with model strip and a corner payment widget. Dealer Inspire \u2192 Toyota / Honda look." },
  { value: "portal",   label: "Portal",   description: "OEM brand-portal split: vehicle photo left, stacked CTA cards right. Dealer.com \u2192 GM / BMW look." },
  { value: "carousel", label: "Carousel", description: "Classic 16:9 hero slider with arrow chevrons and a four-tile row underneath. CDK form factor." },
  { value: "slab",     label: "Slab",     description: "Conversion-first \u2014 the inventory search bar IS the hero. Two pill CTAs, fast LCP. DealerOn / Overfuel." },
  { value: "diagonal", label: "Diagonal", description: "Asymmetric diagonal color block slicing across a vehicle photo. Chunky rounded buttons. DealerSocket." },
  { value: "pickup",   label: "Pickup",   description: "Truck-at-dawn photography with a brand-color ribbon nav and twin Build / Search CTAs. Ford / GM truck dealer feel." },
  { value: "magazine", label: "Magazine", description: "Editorial: full-width photo, oversized left-aligned headline with a thin underline and kicker text. Stream Companies." },
  { value: "circular", label: "Circular", description: "Dealership-circular promo energy: incentive bursts, payment-per-month chips, vehicle cutout on gradient. Force Marketing." },
  { value: "motion",   label: "Motion",   description: "Animated background shapes (Lottie-style) behind a mid-weight headline. Teal / orange accents on dark navy. fusionZONE." },
  { value: "mosaic",   label: "Mosaic",   description: "No hero photo \u2014 a tile-mosaic of model categories above the fold. Performance-first light mode. Jazel." },
];

/** Allowed icon names for value_props cards. Must match the keys
 *  in VALUE_PROP_ICONS in src/components/ValueProps.tsx. */
export type ValuePropIcon =
  | "shield"
  | "shield-check"
  | "dollar"
  | "clock"
  | "truck"
  | "award"
  | "thumbs-up"
  | "users"
  | "wrench"
  | "heart"
  | "star"
  | "map-pin"
  | "banknote";

export interface ValueProp {
  title: string;
  body: string;
  icon: ValuePropIcon;
  /** When true the card is visually elevated (success-tinted border)
   *  and centered on its own row on wide screens. Use sparingly —
   *  only one card should be highlighted at a time. */
  highlight?: boolean;
}

export interface AboutMilestone {
  year: string;
  label: string;
}

export interface AboutValue {
  icon: string;
  title: string;
  text: string;
}

export interface SiteConfig {
  dealership_name: string;
  tagline: string;
  phone: string;
  email: string;
  address: string;
  /** State whose law governs the customer agreements (Terms of Service /
   *  Offer Disclosure). Defaults to Connecticut; set per tenant in
   *  onboarding / Site Configuration so non-CT dealers get a valid forum. */
  governing_law_state: string;
  /** Legal/DBA business name used on the Terms contract, if different from
   *  the marketing dealership_name. Falls back to dealership_name when empty. */
  legal_entity_name: string;
  /** State DMV dealer license number, surfaced on legal/footer pages. */
  dealer_license_number: string;
  website_url: string;
  logo_url: string;
  logo_white_url: string;
  favicon_url: string;
  primary_color: string;
  accent_color: string;
  success_color: string;
  hero_headline: string;
  hero_subtext: string;
  hero_layout: string;
  hero_bg_color: string | null;
  hero_text_color: string | null;
  landing_template: LandingTemplate;
  /**
   * Public sell-flow variant. 'detailed' renders the full multi-step
   * SellCarForm (default); 'quick' renders the one-screen
   * QuickOfferForm (plate + ZIP + mileage + 2 yes/no Q's).
   */
  landing_form_variant: "detailed" | "quick";
  /**
   * Per the May-2026 sell-flow design audit. Controls which sell-flow
   * the customer-facing landing dispatches into:
   *   simple   → 3-question wizard (mileage + condition + ownership) on
   *              one card. 3 customer-facing pages total. Default.
   *   standard → 5-question wizard (+ accidents + mechanical). Still
   *              3 pages but the condition card is denser.
   *   detailed → falls back to the existing multi-step SellCarForm.
   *              4-9+ pages depending on the dealer's Lead Form config.
   */
  landing_form_density: "simple" | "standard" | "detailed" | "dealer_configured";
  /**
   * Whether the dealer offers free at-home pickup. Drives the
   * "We pick up your car" messaging on the landing page (HowItWorks
   * step 3, default comparison wedge, value props). When false, the
   * messaging swaps to drop-off at the dealership instead. Default
   * true to preserve the historical hartecash.com behavior.
   */
  pickup_offered: boolean;
  /**
   * Three-state handoff configuration defining what the dealer offers
   * customers for vehicle handoff after the sale is accepted:
   *   pickup  — dealer only offers at-home pickup
   *   dropoff — dealer only offers in-person drop-off / inspection
   *   both    — dealer offers both options (default)
   */
  handoff_type: "pickup" | "dropoff" | "both";
  /**
   * Ghost-screen variant shown while the BB lookup is in flight.
   * Premium SaaS-grade transitions, dealer-controlled so it matches
   * the rest of the landing's aesthetic. Defaults to 'pulse-orb'
   * (the calmest / most universally premium variant).
   */
  ghost_screen: "pulse-orb" | "sweep-arc" | "stack-reveal" | "card-skeleton" | "legacy-car";
  /** Optional dealer copy override for the ghost-screen headline. */
  ghost_headline: string | null;
  /** Optional dealer copy override for the ghost-screen subhead. */
  ghost_subhead: string | null;
  /**
   * Which lookup tab opens by default on the landing input cluster.
   * Some dealer audiences are more VIN-literate (luxury, fleet,
   * out-of-state buyers) while most consumer rooftops still expect
   * plate + state. Dealer-controlled in admin.
   */
  landing_lookup_default: "plate" | "vin";
  /** How the customer-facing condition picker renders.
   *   "basic" — short hint per option (default)
   *   "kbb"   — Kelley Blue Book–style description on each card,
   *             with the qualifying criteria customers use to
   *             self-grade their vehicle (clean title, tire wear,
   *             cosmetic defects, etc.)
   *  Dealer-controlled in admin Setup · Process → Landing & Flow. */
  condition_card_style: "basic" | "kbb";
  /** Optional dealer override for the landing CTA button color (hex).
   *  Null / empty = component default (#FACC15 saturated yellow). */
  landing_cta_color: string | null;
  /** Optional dealer override for the landing CTA button text color
   *  (hex). Null / empty = component default (#0A0A0A near-black). */
  landing_cta_text_color: string | null;
  price_guarantee_days: number;
  stats_cars_purchased: string;
  stats_years_in_business: string;
  stats_rating: string;
  stats_reviews_count: string;
  /**
   * Up to 6 dealer-editable cards shown in the "Why Sell to X?"
   * section on the public landing. Each card has a title (rendered
   * bold) + body (regular weight) + icon name + optional highlight
   * flag. NULL or empty array falls back to the ValueProps component's
   * default cards.
   */
  value_props: ValueProp[] | null;
  enable_animations: boolean;
  use_animated_calculating: boolean;
  enable_dl_ocr: boolean;
  track_abandoned_leads: boolean;
  auto_route_appraiser_queue: boolean;
  ai_photo_reappraisal: boolean;
  // ── AI condition scoring (in-form, customer-facing) ──
  // When true, the sell-form shows a Photos step between Condition and
  // History where the customer uploads exterior shots. The AI scores them
  // and the offer engine picks up ai_condition_score automatically.
  ai_condition_scoring_enabled: boolean;
  ai_condition_scoring_min_required: number;
  ai_auto_bump_enabled: boolean;
  ai_auto_bump_max_pct: number;
  ai_auto_bump_max_dollars: number;
  ai_auto_bump_daily_cap: number;
  ai_auto_bump_confidence_floor: number;
  enterprise_beta_enabled: boolean;
  // White Label settings blob. powered_by_mode controls which
  // attribution appears in the customer-facing SiteFooter:
  //   'autocurb' — "Powered by AutoCurb.io" (default)
  //   'dealer'   — "Powered by {dealership_name}"
  //   'hidden'   — no attribution
  // The legacy hide_branding boolean is preserved as a fallback for
  // records that pre-date the three-way enum.
  white_label_settings: {
    hide_branding?: boolean;
    powered_by_mode?: "autocurb" | "dealer" | "hidden";
    [k: string]: unknown;
  } | null;
  // Super-admin-only override. When true, always show "Powered by
  // AutoCurb.io" regardless of the dealer's own powered_by_mode.
  force_autocurb_attribution: boolean;
  about_hero_headline: string;
  about_hero_subtext: string;
  about_story: string;
  about_milestones: AboutMilestone[];
  about_values: AboutValue[];
  assign_customer_picks: boolean;
  assign_auto_zip: boolean;
  assign_oem_brand_match: boolean;
  assign_buying_center: boolean;
  buying_center_location_id: string | null;
  service_hero_headline: string;
  service_hero_subtext: string;
  trade_hero_headline: string;
  trade_hero_subtext: string;
  trade_iframe_headline: string;
  trade_iframe_subtext: string;
  ppt_enabled: boolean;
  ppt_guarantee_amount: number;
  ppt_headline: string;
  ppt_subtext: string;
  business_hours: { days: string; hours: string }[];
  facebook_url: string;
  instagram_url: string;
  google_review_url: string;
  tiktok_url: string;
  youtube_url: string;
  photo_overlay_color: string;
  photo_allow_color_change: boolean;
  vehicle_image_angle: string;
  established_year: number | null;
  competitor_columns?: any;
  comparison_features?: any;
  // ── Admin Refresh: appearance + layout ──
  ui_scale: number;
  text_scale: number;
  main_content_scale: number;
  top_bar_style: "solid" | "gradient" | "gradient-diagonal" | "gradient-3stop";
  top_bar_bg: string;
  top_bar_bg_2: string;
  top_bar_text: string;
  top_bar_height: number;
  top_bar_shimmer: boolean;
  top_bar_shimmer_style: string;
  top_bar_shimmer_speed: number;
  file_layout: "classic" | "conversation";
  customer_file_header_layout: "a" | "b" | "c";
  customer_file_messaging: "tabs" | "unified";
  customer_file_accent: string;
  customer_file_accent_2: string;
  // Background color of the currently-active sidebar item in the admin
  // shell. Stored as a hex string so AppearanceSettings can offer a
  // straight color picker without HSL conversion. Default is near-black.
  sidebar_active_color: string;
  // ── Demo mode (BB sandbox kill-switch) ──
  // When true, bb-lookup serves a synthetic vehicle and every public
  // offer (Quick + full SellCarForm) gets clamped to demo_offer_amount.
  // Used while Black Book credentials are renegotiated. Default false:
  // turning it off restores the prior live pipeline byte-for-byte.
  demo_mode: boolean;
  demo_offer_amount: number;
  /** Per-tenant TCPA disclosure text shown under lead-gen forms.
   *  Server-defaulted via migration 20260502070000. */
  tcpa_disclosure: string;
  /** Bumped when the disclosure copy changes — lets the cadence
   *  engine detect "old consent" and gate re-engagement. */
  tcpa_disclosure_version: number;
  /** Master kill switch for the inventory-aware embed's time-decay
   *  escalation. When false, the floating widget reshapes copy
   *  based on customer state but never pulses, never toasts, and
   *  never auto-opens. Useful for luxury / high-end dealers who
   *  consider Day 7 auto-open too aggressive for their brand. */
  embed_escalation_enabled: boolean;
  /** Caps escalation at a tier:
   *    0 → no escalation (equivalent to disabled)
   *    1 → pulse only (Day 2–4)
   *    2 → pulse + soft toast (Day 5–6)
   *    3 → pulse + toast + Day 7 auto-open (full machine) */
  embed_escalation_max_tier: 0 | 1 | 2 | 3;
  /** Per-tenant overrides for the homepage Value Tracker OEM→flagship
   *  vehicle map. Keys are lowercase brand substrings (matched against
   *  tenant.display_name); values are partial FlagshipEntry objects.
   *  Empty object = use built-in defaults. Managed in Branding →
   *  Tracker Vehicles. */
  tracker_oem_flagships: Record<string, {
    year?: string;
    make?: string;
    model?: string;
    style?: string;
    specs?: string;
  }>;
  /** Per-tenant Value Tracker vehicle override mode.
   *    "oem"     — auto-pick by dealership name via tracker_oem_flagships
   *    "popular" — show a single popular fallback vehicle (Toyota RAV4)
   *    "custom"  — show the explicit vehicle defined below */
  tracker_vehicle_mode: "oem" | "popular" | "custom";
  tracker_vehicle_year: number | null;
  tracker_vehicle_make: string | null;
  tracker_vehicle_model: string | null;
  tracker_vehicle_style: string | null;
  tracker_vehicle_specs: string | null;
  /**
   * Customer acquisition journey template. Independent of
   * landing_template — when 'moto_detailed', the MotoDetailed
   * journey engine is rendered with the preset + offer-timing
   * below. Defaults to 'moto' (original ultra-minimal flow).
   */
  customer_journey_template: "moto" | "moto_detailed";
  /** Preset id passed to the JourneyEngine when journey = moto_detailed. */
  moto_detailed_preset:
    | "moto"
    | "moto_detailed"
    | "instant_offer"
    | "high_qualification"
    | "luxury_experience";
  /** Offer timing for the MotoDetailed flow. */
  moto_detailed_offer_display_mode: "before_contact_info" | "after_contact_info";
  /** Optional dealer-authored JourneyConfig overrides (reorders / injected steps). */
  moto_detailed_custom_config: Record<string, unknown> | null;
  /**
   * Which payout methods the dealer offers customers in the
   * Payment Center. Default reflects how most dealerships actually
   * pay sellers: paper check at handoff, everything else off. The
   * customer-facing UI renders ONLY enabled methods.
   */
  enabled_payout_methods: {
    paper_check: boolean;
    ach: boolean;
    eft: boolean;
    instant_debit: boolean;
    wire_transfer: boolean;
  };
}


const DEFAULTS: SiteConfig = {
  dealership_name: "Our Dealership",
  tagline: "Sell Your Car The Easy Way",
  phone: "",
  email: "",
  address: "",
  governing_law_state: "Connecticut",
  legal_entity_name: "",
  dealer_license_number: "",
  website_url: "",
  logo_url: "",
  logo_white_url: "",
  favicon_url: "",
  primary_color: "213 80% 20%",
  accent_color: "0 80% 50%",
  success_color: "142 71% 45%",
  hero_headline: "Sell Your Car The Easy Way",
  // Wedge against the new incumbent reality — Carvana's 7-day window
  // and CarMax's required store visit, both true as of 2026. Kept
  // under ~70 chars so the line-clamp-2 in Hero/HeroOffset never
  // truncates the default. Dealer admins can still override.
  hero_subtext: "Real cash offer in 60 seconds. No store visit. No 7-day wait.",
  hero_layout: "offset_right",
  hero_bg_color: null,
  hero_text_color: null,
  landing_template: "classic",
  landing_form_variant: "detailed",
  landing_form_density: "simple",
  pickup_offered: true,
  handoff_type: "both",
  condition_card_style: "basic",
  ghost_screen: "legacy-car",
  ghost_headline: null,
  ghost_subhead: null,
  landing_lookup_default: "vin",
  landing_cta_color: null,
  landing_cta_text_color: null,
  price_guarantee_days: 8,
  stats_cars_purchased: "14,721+",
  stats_years_in_business: "78 yrs",
  stats_rating: "4.9",
  stats_reviews_count: "2,400+",
  value_props: null,
  enable_animations: false,
  use_animated_calculating: false,
  enable_dl_ocr: false,
  track_abandoned_leads: true,
  auto_route_appraiser_queue: false,
  ai_photo_reappraisal: false,
  ai_condition_scoring_enabled: true,
  ai_condition_scoring_min_required: 4,
  ai_auto_bump_enabled: false,
  ai_auto_bump_max_pct: 15,
  ai_auto_bump_max_dollars: 2000,
  ai_auto_bump_daily_cap: 10000,
  ai_auto_bump_confidence_floor: 70,
  enterprise_beta_enabled: false,
  white_label_settings: null,
  force_autocurb_attribution: false,
  about_hero_headline: "Our Story",
  about_hero_subtext: "We're passionate about helping drivers get the most value for their vehicles — no haggling, no stress.",
  about_story: "",
  about_milestones: [],
  about_values: [],
  assign_customer_picks: false,
  assign_auto_zip: true,
  assign_oem_brand_match: false,
  assign_buying_center: false,
  buying_center_location_id: null,
  service_hero_headline: "There's Never Been a Better Time to Upgrade or Sell",
  service_hero_subtext: "You're already coming in for service. Let us show you what your car is worth — it takes less than 2 minutes.",
  trade_hero_headline: "Submit Your Trade-In Info",
  trade_hero_subtext: "Already shopping with us? Send us your trade details from home — we'll have your value ready.",
  trade_iframe_headline: "What's Your Trade Worth?",
  trade_iframe_subtext: "Get your trade-in value in under 2 minutes — includes your tax savings.",
  ppt_enabled: false,
  ppt_guarantee_amount: 3000,
  ppt_headline: "",
  ppt_subtext: "",
  business_hours: [
    { days: "Mon–Thu", hours: "9 AM – 7 PM" },
    { days: "Fri–Sat", hours: "9 AM – 6 PM" },
    { days: "Sun", hours: "Closed" },
  ],
  facebook_url: "",
  instagram_url: "",
  google_review_url: "",
  tiktok_url: "",
  youtube_url: "",
  photo_overlay_color: "#00FF88",
  photo_allow_color_change: true,
  vehicle_image_angle: "three_quarter",
  established_year: null,
  // ── Admin Refresh: appearance + layout ──
  ui_scale: 100,
  text_scale: 100,
  main_content_scale: 100,
  top_bar_style: "solid",
  top_bar_bg: "#00407f",
  top_bar_bg_2: "#005bb5",
  top_bar_text: "#ffffff",
  top_bar_height: 64,
  top_bar_shimmer: true,
  top_bar_shimmer_style: "sheen",
  top_bar_shimmer_speed: 3.2,
  file_layout: "classic",
  customer_file_header_layout: "b",
  customer_file_messaging: "tabs",
  customer_file_accent: "#003b80",
  customer_file_accent_2: "#005bb5",
  sidebar_active_color: "#0f172a",
  demo_mode: false,
  demo_offer_amount: 23599,
  tcpa_disclosure: "",
  tcpa_disclosure_version: 1,
  embed_escalation_enabled: true,
  embed_escalation_max_tier: 3,
  tracker_oem_flagships: {},
  tracker_vehicle_mode: "oem",
  tracker_vehicle_year: null,
  tracker_vehicle_make: null,
  tracker_vehicle_model: null,
  tracker_vehicle_style: null,
  tracker_vehicle_specs: null,
  customer_journey_template: "moto",
  moto_detailed_preset: "moto_detailed",
  moto_detailed_offer_display_mode: "after_contact_info",
  moto_detailed_custom_config: null,
  enabled_payout_methods: {
    paper_check: true,
    ach: false,
    eft: false,
    instant_debit: false,
    wire_transfer: false,
  },
};


/**
 * Fields on dealership_locations that can override the corporate site_config.
 * Only non-null values from the location row will replace the corporate value.
 */
const LOCATION_OVERRIDE_KEYS: (keyof SiteConfig)[] = [
  "dealership_name",
  "tagline",
  "phone",
  "email",
  "address",
  "website_url",
  "logo_url",
  "logo_white_url",
  "favicon_url",
  "primary_color",
  "accent_color",
  "success_color",
  "hero_headline",
  "hero_subtext",
  "hero_layout",
  "landing_template",
  "landing_form_variant",
  "landing_form_density",
  "pickup_offered",
  "handoff_type",
  "condition_card_style",
  "ghost_screen",
  "ghost_headline",
  "ghost_subhead",
  "landing_lookup_default",
  "landing_cta_color",
  "landing_cta_text_color",
  "service_hero_headline",
  "service_hero_subtext",
  "trade_hero_headline",
  "trade_hero_subtext",
  "trade_iframe_headline",
  "trade_iframe_subtext",
  "ppt_enabled",
  "ppt_guarantee_amount",
  "ppt_headline",
  "ppt_subtext",
  "business_hours",
  "facebook_url",
  "instagram_url",
  "google_review_url",
  "tiktok_url",
  "youtube_url",
  "stats_cars_purchased",
  "stats_years_in_business",
  "stats_rating",
  "stats_reviews_count",
  "value_props",
  "price_guarantee_days",
  "established_year",
  // Customer-file / Tweaks branding (per location)
  "file_layout",
  "customer_file_header_layout",
  "customer_file_accent",
  "customer_file_accent_2",
  "customer_file_messaging",
  // Top-bar / shell branding (per location)
  "top_bar_style",
  "top_bar_bg",
  "top_bar_bg_2",
  "top_bar_text",
  "top_bar_height",
  "top_bar_shimmer",
  "top_bar_shimmer_style",
  "top_bar_shimmer_speed",
  // UI / text / content scale (per location)
  "ui_scale",
  "text_scale",
  "main_content_scale",
  "sidebar_active_color",
];

async function fetchSiteConfig(
  dealershipId: string,
  locationId: string | null,
): Promise<SiteConfig> {
  // Fetch corporate config and location data in parallel
  const corpPromise = supabase
    .from("site_config")
    .select("*")
    .eq("dealership_id", dealershipId)
    .maybeSingle();

  const locPromise = locationId
    ? supabase
        .from("dealership_locations")
        .select("*")
        .eq("id", locationId)
        .maybeSingle()
    : Promise.resolve({ data: null });

  const [{ data: corpData }, { data: locData }] = await Promise.all([corpPromise, locPromise]);

  const corporate: SiteConfig = { ...DEFAULTS, ...(corpData || {}) } as unknown as SiteConfig;

  if (!locationId || !locData) return corporate;

  // 3. Merge: location values override corporate where non-null
  const merged = { ...corporate };
  for (const key of LOCATION_OVERRIDE_KEYS) {
    const locVal = (locData as any)[key];
    if (locVal !== null && locVal !== undefined && locVal !== "") {
      (merged as any)[key] = locVal;
    }
  }

  // About content: use location-specific if not inheriting corporate
  if (!(locData as any).use_corporate_about) {
    const aboutKeys: (keyof SiteConfig)[] = ["about_story", "about_hero_headline", "about_hero_subtext"];
    for (const key of aboutKeys) {
      const val = (locData as any)[key];
      if (val) (merged as any)[key] = val;
    }
  }

  // Compute years in business from established_year
  if (merged.established_year) {
    merged.stats_years_in_business = `${new Date().getFullYear() - merged.established_year} yrs`;
  }

  return merged;
}

// localStorage key for the whole site_config blob, namespaced by
// tenant so a browser that swaps dealerships doesn't paint Tenant A's
// name/logo/colors to Tenant B's user. Read synchronously as
// React Query's initialData so EVERY useSiteConfig consumer gets the
// dealer's last-known values on first paint — fixes flash for:
//   * dealership_name (header, tab title)
//   * tagline
//   * logo_url / logo_white_url / favicon_url
//   * hero_headline / hero_subtext
//   * primary_color / accent_color / success_color
//   * landing_template (the original symptom that motivated this cache)
// All in one place instead of N component-level caches.
//
// History: PR #257 cached landing_template; PR #258 cached theme
// colors. This consolidates by caching the whole blob — both prior
// caches now compose naturally with this baseline. Cache write fires
// from the React Query success callback so we only persist values
// that actually came from the database (never the DEFAULTS).
const LS_SITE_CONFIG_KEY = "autocurb:last_site_config";

function tenantCacheKey(dealershipId: string, locationId: string | null | undefined): string {
  return `${LS_SITE_CONFIG_KEY}:${dealershipId}:${locationId ?? "_"}`;
}

function readCachedSiteConfig(
  dealershipId: string,
  locationId: string | null | undefined,
): SiteConfig | undefined {
  try {
    if (typeof window === "undefined") return undefined;
    const raw = localStorage.getItem(tenantCacheKey(dealershipId, locationId));
    if (!raw) return undefined;
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === "object" && "dealership_name" in parsed) {
      return parsed as SiteConfig;
    }
  } catch (e) {
    console.debug("useSiteConfig: cache read failed:", e);
  }
  return undefined;
}

function writeCachedSiteConfig(
  dealershipId: string,
  locationId: string | null | undefined,
  data: SiteConfig,
): void {
  try {
    if (typeof window === "undefined") return;
    localStorage.setItem(tenantCacheKey(dealershipId, locationId), JSON.stringify(data));
  } catch (e) {
    console.debug("useSiteConfig: cache write failed:", e);
  }
}

export function useSiteConfig() {
  const { tenant } = useTenant();
  const dealershipId = tenant.dealership_id;
  const locationId = tenant.location_id;

  const { data, isLoading } = useQuery({
    queryKey: ["site_config", dealershipId, locationId],
    queryFn: async () => {
      const fresh = await fetchSiteConfig(dealershipId, locationId);
      writeCachedSiteConfig(dealershipId, locationId, fresh);
      return fresh;
    },
    // Synchronous read at query-mount time. When present, the query
    // starts with cached data and React Query marks it as fresh until
    // staleTime expires — so a repeat visitor paints with the dealer's
    // last-known config IMMEDIATELY and the background revalidation
    // happens silently after staleTime. Cache is per-tenant so swapping
    // dealerships in the same browser doesn't show stale branding.
    initialData: () => readCachedSiteConfig(dealershipId, locationId),
    // When initialData hits, treat the data as already-stale-enough to
    // refetch on next access (gives us live updates) but use the cached
    // version for the immediate paint.
    initialDataUpdatedAt: () => 0,
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  });

  return { config: data ?? DEFAULTS, loading: isLoading };
}
