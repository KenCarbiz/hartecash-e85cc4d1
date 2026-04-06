import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useTenant } from "@/contexts/TenantContext";

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
  price_guarantee_days: number;
  stats_cars_purchased: string;
  stats_years_in_business: string;
  stats_rating: string;
  stats_reviews_count: string;
  enable_animations: boolean;
  use_animated_calculating: boolean;
  enable_dl_ocr: boolean;
  track_abandoned_leads: boolean;
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
  price_guarantee_days: 8,
  stats_cars_purchased: "14,721+",
  stats_years_in_business: "78 yrs",
  stats_rating: "4.9",
  stats_reviews_count: "2,400+",
  enable_animations: false,
  use_animated_calculating: false,
  enable_dl_ocr: false,
  track_abandoned_leads: true,
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

let cachedConfig: Record<string, SiteConfig> = {};

export function useSiteConfig() {
  const { tenant } = useTenant();
  const dealershipId = tenant.dealership_id;
  const [config, setConfig] = useState<SiteConfig>(cachedConfig[dealershipId] || DEFAULTS);
  const [loading, setLoading] = useState(!cachedConfig[dealershipId]);

  useEffect(() => {
    if (cachedConfig[dealershipId]) {
      setConfig(cachedConfig[dealershipId]);
      setLoading(false);
      return;
    }
    
    supabase
      .from("site_config")
      .select("*")
      .eq("dealership_id", dealershipId)
      .maybeSingle()
      .then(({ data }) => {
        if (data) {
          const merged = { ...DEFAULTS, ...data } as unknown as SiteConfig;
          cachedConfig[dealershipId] = merged;
          setConfig(merged);
        }
        setLoading(false);
      });
  }, [dealershipId]);

  return { config, loading };
}
