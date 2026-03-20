import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

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
  price_guarantee_days: number;
  stats_cars_purchased: string;
  stats_years_in_business: string;
  stats_rating: string;
  stats_reviews_count: string;
  enable_animations: boolean;
  use_animated_calculating: boolean;
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
  price_guarantee_days: 8,
  stats_cars_purchased: "14,721+",
  stats_years_in_business: "78 yrs",
  stats_rating: "4.9",
  stats_reviews_count: "2,400+",
  enable_animations: false,
  use_animated_calculating: false,
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
          const merged = { ...DEFAULTS, ...data } as SiteConfig;
          cachedConfig = merged;
          setConfig(merged);
        }
        setLoading(false);
      });
  }, []);

  return { config, loading };
}
