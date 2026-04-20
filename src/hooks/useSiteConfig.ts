import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useTenant } from "@/contexts/TenantContext";

export type LandingTemplate = "classic" | "video" | "inventory" | "trust" | "editorial";

export const LANDING_TEMPLATES: { value: LandingTemplate; label: string; description: string }[] = [
  { value: "classic", label: "Classic", description: "Split hero with instant-offer form. Balanced and form-forward." },
  { value: "video", label: "Video Hero", description: "Full-bleed cinematic background with a single focused CTA." },
  { value: "inventory", label: "Inventory-Forward", description: "Plate / VIN / make-model search leads; trust blocks follow." },
  { value: "trust", label: "Trust-Wall", description: "Minimal hero, huge review wall, community and local focus." },
  { value: "editorial", label: "Editorial", description: "Long-scroll narrative that walks through each step of the flow." },
];

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
  landing_template: LandingTemplate;
  price_guarantee_days: number;
  stats_cars_purchased: string;
  stats_years_in_business: string;
  stats_rating: string;
  stats_reviews_count: string;
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
  //   'autocurb' — "Powered by Autocurb.ai" (default)
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
  // Autocurb.ai" regardless of the dealer's own powered_by_mode.
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
}

const DEFAULTS: SiteConfig = {
  dealership_name: "Our Dealership",
  tagline: "Sell Your Car The Easy Way",
  phone: "",
  email: "",
  address: "",
  website_url: "",
  logo_url: "",
  logo_white_url: "",
  favicon_url: "",
  primary_color: "213 80% 20%",
  accent_color: "0 80% 50%",
  success_color: "142 71% 45%",
  hero_headline: "Sell Your Car The Easy Way",
  hero_subtext: "Get a top-dollar cash offer in 2 minutes. No haggling, no stress.",
  hero_layout: "offset_right",
  landing_template: "classic",
  price_guarantee_days: 8,
  stats_cars_purchased: "14,721+",
  stats_years_in_business: "78 yrs",
  stats_rating: "4.9",
  stats_reviews_count: "2,400+",
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
  "price_guarantee_days",
  "established_year",
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

export function useSiteConfig() {
  const { tenant } = useTenant();
  const dealershipId = tenant.dealership_id;
  const locationId = tenant.location_id;

  const { data, isLoading } = useQuery({
    queryKey: ["site_config", dealershipId, locationId],
    queryFn: () => fetchSiteConfig(dealershipId, locationId),
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  });

  return { config: data ?? DEFAULTS, loading: isLoading };
}
