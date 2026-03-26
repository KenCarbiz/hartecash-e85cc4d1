import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

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
}

const DEFAULTS: SiteConfig = {
  dealership_name: "Harte Auto Group",
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
  about_hero_headline: "Four Generations. One Promise.",
  about_hero_subtext: "Since 1951, the Harte family has been helping Connecticut drivers — not just sell and buy cars, but feel good about the experience.",
  about_story: "",
  about_milestones: [],
  about_values: [],
  assign_customer_picks: false,
  assign_auto_zip: true,
  assign_oem_brand_match: false,
  assign_buying_center: false,
  buying_center_location_id: null,
};

let cachedConfig: SiteConfig | null = null;

export function useSiteConfig() {
  const [config, setConfig] = useState<SiteConfig>(cachedConfig || DEFAULTS);
  const [loading, setLoading] = useState(!cachedConfig);

  useEffect(() => {
    if (cachedConfig) return;
    
    supabase
      .from("site_config")
      .select("*")
      .eq("dealership_id", "default")
      .maybeSingle()
      .then(({ data }) => {
        if (data) {
          const merged = { ...DEFAULTS, ...data } as unknown as SiteConfig;
          cachedConfig = merged;
          setConfig(merged);
        }
        setLoading(false);
      });
  }, []);

  return { config, loading };
}
