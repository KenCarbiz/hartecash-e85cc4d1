import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Sparkles, Globe, Loader2, ArrowRight, CheckCircle, XCircle, MapPin,
  Building2, Palette, Phone, Mail, Star, Clock, Users, FileText, Image,
  Facebook, AlertTriangle
} from "lucide-react";

interface DealerWebsiteAutofillCardProps {
  dealershipId: string;
  onAutofillComplete?: () => void;
  onOpenQuestionnaire?: () => void;
  onNavigate?: (section: string) => void;
}

interface ScrapedLocation {
  name?: string;
  address?: string;
  city_state_zip?: string;
  brands?: string;
  phone?: string;
  email?: string;
}

interface ScrapedBusinessHour {
  department?: string;
  days?: string;
  hours?: string;
}

interface ScrapedStaffMember {
  name?: string;
  title?: string;
  email?: string;
  phone?: string;
}

interface ScrapedDealerInfo {
  dealership_name?: string;
  tagline?: string;
  phone?: string;
  email?: string;
  address?: string;
  website?: string;
  google_review?: string;
  facebook?: string;
  instagram?: string;
  tiktok?: string;
  youtube?: string;
  primary_color?: string;
  accent_color?: string;
  success_color?: string;
  logo_url?: string;
  architecture?: "Single Store" | "Multi-Location" | "Dealer Group";
  num_locations?: string;
  hero_headline?: string;
  hero_subtext?: string;
  about_story?: string;
  about_hero_headline?: string;
  about_mission?: string;
  about_values_list?: string[];
  oem_brands?: string[];
  staff_emails?: string[];
  staff_phones?: string[];
  locations?: ScrapedLocation[];
  business_hours?: ScrapedBusinessHour[];
  staff_members?: ScrapedStaffMember[];
  dealer_group_name?: string;
  dms_provider?: string;
  stats_years_in_business?: string;
  stats_rating?: string;
  stats_reviews_count?: string;
  stats_cars_purchased?: string;
  established_year?: string;
  meta_description?: string;
  favicon_url?: string;
  certifications?: string[];
}

type OnboardingAnswers = Record<string, string>;

interface PreviewCategory {
  label: string;
  icon: React.ElementType;
  items: { label: string; value: string; isNew: boolean }[];
  section?: string;
}

interface MissingItem {
  label: string;
  icon: React.ElementType;
  section: string;
}

const DEFAULT_PRIMARY_COLOR = "213 80% 20%";
const DEFAULT_ACCENT_COLOR = "0 80% 50%";

const ARCHITECTURE_MAP: Record<string, string> = {
  "Single Store": "single_store",
  "Multi-Location": "multi_location",
  "Dealer Group": "dealer_group",
};

const isFilledText = (value: unknown): value is string => typeof value === "string" && value.trim().length > 0;

const normalizeUrl = (value: string) => {
  const trimmed = value.trim();
  if (!trimmed) return "";
  return /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
};

const normalizeBrandColor = (value?: string | null) => {
  if (!isFilledText(value)) return null;
  const trimmed = value.trim();
  if (/^\d{1,3}\s+\d{1,3}%\s+\d{1,3}%$/.test(trimmed)) return trimmed;

  let hex = trimmed.replace(/^#/, "");
  if (hex.length === 3) hex = hex.split("").map((c) => c + c).join("");
  if (!/^[0-9a-fA-F]{6}$/.test(hex)) return null;

  const r = parseInt(hex.slice(0, 2), 16) / 255;
  const g = parseInt(hex.slice(2, 4), 16) / 255;
  const b = parseInt(hex.slice(4, 6), 16) / 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  const lightness = (max + min) / 2;
  const delta = max - min;
  let hue = 0, saturation = 0;
  if (delta !== 0) {
    saturation = delta / (1 - Math.abs(2 * lightness - 1));
    switch (max) {
      case r: hue = 60 * (((g - b) / delta) % 6); break;
      case g: hue = 60 * ((b - r) / delta + 2); break;
      default: hue = 60 * ((r - g) / delta + 4); break;
    }
  }
  if (hue < 0) hue += 360;
  return `${Math.round(hue)} ${Math.round(saturation * 100)}% ${Math.round(lightness * 100)}%`;
};

const buildAnswerMap = (data: ScrapedDealerInfo, url: string): OnboardingAnswers => {
  const fieldMap: OnboardingAnswers = {};
  const setField = (key: string, value?: string) => {
    if (isFilledText(value)) fieldMap[key] = value.trim();
  };

  setField("dealership_name", data.dealership_name);
  setField("tagline", data.tagline);
  setField("phone", data.phone);
  setField("email", data.email);
  setField("address", data.address);
  setField("website", data.website || url);
  setField("google_review", data.google_review);
  setField("facebook", data.facebook);
  setField("instagram", data.instagram);
  setField("tiktok", data.tiktok);
  setField("youtube", data.youtube);
  setField("architecture", data.architecture);
  setField("num_locations", data.num_locations);
  setField("primary_color", data.primary_color);
  setField("accent_color", data.accent_color);
  setField("success_color", data.success_color);
  setField("hero_headline", data.hero_headline);
  setField("hero_subtext", data.hero_subtext);
  setField("about_story", data.about_story);
  setField("about_hero_headline", data.about_hero_headline);
  setField("about_mission", data.about_mission);
  setField("established_year", data.established_year);
  setField("favicon_url", data.favicon_url);
  setField("meta_description", data.meta_description);
  if (Array.isArray(data.oem_brands) && data.oem_brands.length > 0) {
    fieldMap.oem_brands = data.oem_brands.join(", ");
  }
  if (Array.isArray(data.certifications) && data.certifications.length > 0) {
    fieldMap.certifications = data.certifications.join(", ");
  }
  if (Array.isArray(data.about_values_list) && data.about_values_list.length > 0) {
    fieldMap.about_values = data.about_values_list.join(", ");
  }

  if (Array.isArray(data.staff_emails) && data.staff_emails.length > 0) {
    fieldMap.staff_emails = data.staff_emails.join("\n");
  }
  if (Array.isArray(data.staff_phones) && data.staff_phones.length > 0) {
    fieldMap.staff_sms = data.staff_phones.join("\n");
  }
  if (Array.isArray(data.locations)) {
    data.locations.slice(0, 5).forEach((location, index) => {
      const item = index + 1;
      setField(`loc${item}_name`, location.name);
      setField(`loc${item}_address`, location.address);
      setField(`loc${item}_csz`, location.city_state_zip);
      setField(`loc${item}_brands`, location.brands);
    });
  }
  if (Array.isArray(data.staff_members) && data.staff_members.length > 0) {
    const adminEmails: string[] = [], gsmEmails: string[] = [], ucmEmails: string[] = [], bdcEmails: string[] = [];
    data.staff_members.forEach((member) => {
      if (!isFilledText(member.email)) return;
      const title = (member.title || "").toLowerCase();
      if (title.includes("general manager") || title.includes("gm") || title.includes("gsm")) gsmEmails.push(member.email!);
      else if (title.includes("used car") || title.includes("pre-owned") || title.includes("ucm")) ucmEmails.push(member.email!);
      else if (title.includes("bdc") || title.includes("internet") || title.includes("sales")) bdcEmails.push(member.email!);
      else if (title.includes("owner") || title.includes("dealer principal") || title.includes("admin")) adminEmails.push(member.email!);
      else bdcEmails.push(member.email!);
    });
    if (adminEmails.length) fieldMap.admin_users = adminEmails.join("\n");
    if (gsmEmails.length) fieldMap.gsm_users = gsmEmails.join("\n");
    if (ucmEmails.length) fieldMap.ucm_users = ucmEmails.join("\n");
    if (bdcEmails.length) fieldMap.bdc_users = bdcEmails.join("\n");
  }
  if (Array.isArray(data.business_hours)) {
    const summary = data.business_hours
      .filter((item) => isFilledText(item?.days) && isFilledText(item?.hours))
      .map((item) => {
        const prefix = isFilledText(item.department) ? `${item.department} — ` : "";
        return `${prefix}${item.days!.trim()}: ${item.hours!.trim()}`;
      })
      .join("\n");
    if (summary) fieldMap.business_hours_summary = summary;
  }
  setField("special_instructions", data.dealer_group_name ? `Part of ${data.dealer_group_name}` : undefined);
  return fieldMap;
};

export default function DealerWebsiteAutofillCard({
  dealershipId,
  onAutofillComplete,
  onOpenQuestionnaire,
  onNavigate,
}: DealerWebsiteAutofillCardProps) {
  const { toast } = useToast();
  const [scrapeUrl, setScrapeUrl] = useState("");
  const [scraping, setScraping] = useState(false);
  const [saving, setSaving] = useState(false);

  // Preview state
  const [previewData, setPreviewData] = useState<{
    scraped: ScrapedDealerInfo;
    categories: PreviewCategory[];
    missing: MissingItem[];
    totalFound: number;
    totalNew: number;
  } | null>(null);

  useEffect(() => {
    const loadWebsite = async () => {
      const { data } = await supabase
        .from("site_config")
        .select("website_url")
        .eq("dealership_id", dealershipId)
        .maybeSingle();
      if (isFilledText(data?.website_url)) setScrapeUrl(data.website_url);
      else setScrapeUrl("");
    };
    void loadWebsite();
  }, [dealershipId]);

  const handleScrape = async () => {
    if (!scrapeUrl.trim()) {
      toast({ title: "Website required", description: "Enter the dealer website first.", variant: "destructive" });
      return;
    }
    setScraping(true);
    const normalizedUrl = normalizeUrl(scrapeUrl);

    try {
      const { data, error } = await supabase.functions.invoke("scrape-dealer-site", {
        body: { url: normalizedUrl },
      });
      if (error) throw error;
      if (!data?.success || !data?.data) throw new Error(data?.error || "Failed to extract dealer information");

      const scraped = data.data as ScrapedDealerInfo;

      // Fetch current config to determine what's new vs existing
      const [configRes] = await Promise.all([
        supabase.from("site_config")
          .select("dealership_name, tagline, phone, email, address, website_url, google_review_url, facebook_url, instagram_url, tiktok_url, youtube_url, primary_color, accent_color, success_color, logo_url, logo_white_url, favicon_url, business_hours, hero_headline, hero_subtext, about_hero_headline, about_story, stats_years_in_business, stats_rating, stats_reviews_count, stats_cars_purchased, established_year")
          .eq("dealership_id", dealershipId)
          .maybeSingle(),
      ]);

      const cfg = configRes.data;

      // Build preview categories
      const categories: PreviewCategory[] = [];

      // Identity
      const identityItems: PreviewCategory["items"] = [];
      const addItem = (label: string, value?: string, currentValue?: unknown) => {
        if (isFilledText(value)) {
          identityItems.push({ label, value: value.trim(), isNew: !isFilledText(currentValue) });
        }
      };
      addItem("Dealership Name", scraped.dealership_name, cfg?.dealership_name);
      addItem("Tagline", scraped.tagline, cfg?.tagline);
      addItem("Phone", scraped.phone, cfg?.phone);
      addItem("Email", scraped.email, cfg?.email);
      addItem("Address", scraped.address, cfg?.address);
      addItem("Website", scraped.website || normalizedUrl, cfg?.website_url);
      if (identityItems.length > 0) {
        categories.push({ label: "Identity & Contact", icon: Building2, items: identityItems, section: "site-config" });
      }

      // Branding
      const brandingItems: PreviewCategory["items"] = [];
      if (isFilledText(scraped.primary_color)) brandingItems.push({ label: "Primary Color", value: scraped.primary_color, isNew: !isFilledText(cfg?.primary_color) || cfg?.primary_color === DEFAULT_PRIMARY_COLOR });
      if (isFilledText(scraped.accent_color)) brandingItems.push({ label: "Accent Color", value: scraped.accent_color, isNew: !isFilledText(cfg?.accent_color) || cfg?.accent_color === DEFAULT_ACCENT_COLOR });
      if (isFilledText(scraped.success_color)) brandingItems.push({ label: "CTA Color", value: scraped.success_color, isNew: !isFilledText(cfg?.success_color) });
      if (isFilledText(scraped.logo_url)) brandingItems.push({ label: "Logo URL", value: scraped.logo_url, isNew: !isFilledText(cfg?.logo_url) });
      if (brandingItems.length > 0) {
        categories.push({ label: "Branding & Colors", icon: Palette, items: brandingItems, section: "site-config" });
      }

      // Hero
      const heroItems: PreviewCategory["items"] = [];
      if (isFilledText(scraped.hero_headline)) heroItems.push({ label: "Headline", value: scraped.hero_headline, isNew: !isFilledText(cfg?.hero_headline) });
      if (isFilledText(scraped.hero_subtext)) heroItems.push({ label: "Subtext", value: scraped.hero_subtext, isNew: !isFilledText(cfg?.hero_subtext) });
      if (heroItems.length > 0) {
        categories.push({ label: "Hero Content", icon: FileText, items: heroItems, section: "site-config" });
      }

      // About Us
      const aboutItems: PreviewCategory["items"] = [];
      if (isFilledText(scraped.about_story)) aboutItems.push({ label: "About Story", value: scraped.about_story.slice(0, 200) + (scraped.about_story.length > 200 ? "…" : ""), isNew: !isFilledText((cfg as any)?.about_story) });
      if (isFilledText(scraped.about_hero_headline)) aboutItems.push({ label: "About Headline", value: scraped.about_hero_headline, isNew: !isFilledText((cfg as any)?.about_hero_headline) });
      if (isFilledText(scraped.about_mission)) aboutItems.push({ label: "Mission", value: scraped.about_mission, isNew: true });
      if (Array.isArray(scraped.about_values_list) && scraped.about_values_list.length > 0) aboutItems.push({ label: "Values", value: scraped.about_values_list.join(", "), isNew: true });
      if (Array.isArray(scraped.certifications) && scraped.certifications.length > 0) aboutItems.push({ label: "Certifications", value: scraped.certifications.join(", "), isNew: true });
      if (aboutItems.length > 0) {
        categories.push({ label: "About Us", icon: FileText, items: aboutItems, section: "site-config" });
      }

      // Social & Reviews
      const socialItems: PreviewCategory["items"] = [];
      if (isFilledText(scraped.google_review)) socialItems.push({ label: "Google Reviews", value: scraped.google_review, isNew: !isFilledText(cfg?.google_review_url) });
      if (isFilledText(scraped.facebook)) socialItems.push({ label: "Facebook", value: scraped.facebook, isNew: !isFilledText(cfg?.facebook_url) });
      if (isFilledText(scraped.instagram)) socialItems.push({ label: "Instagram", value: scraped.instagram, isNew: !isFilledText(cfg?.instagram_url) });
      if (isFilledText(scraped.tiktok)) socialItems.push({ label: "TikTok", value: scraped.tiktok, isNew: !isFilledText(cfg?.tiktok_url) });
      if (isFilledText(scraped.youtube)) socialItems.push({ label: "YouTube", value: scraped.youtube, isNew: !isFilledText(cfg?.youtube_url) });
      if (socialItems.length > 0) {
        categories.push({ label: "Social & Reviews", icon: Facebook, items: socialItems, section: "site-config" });
      }

      // Stats
      const statsItems: PreviewCategory["items"] = [];
      if (isFilledText(scraped.established_year)) statsItems.push({ label: "Established", value: scraped.established_year, isNew: !(cfg as any)?.established_year });
      if (isFilledText(scraped.stats_rating)) statsItems.push({ label: "Rating", value: scraped.stats_rating, isNew: !isFilledText(cfg?.stats_rating) });
      if (isFilledText(scraped.stats_reviews_count)) statsItems.push({ label: "Reviews", value: scraped.stats_reviews_count, isNew: !isFilledText(cfg?.stats_reviews_count) });
      if (isFilledText(scraped.stats_years_in_business)) statsItems.push({ label: "Years in Business", value: scraped.stats_years_in_business, isNew: !isFilledText(cfg?.stats_years_in_business) });
      if (isFilledText(scraped.stats_cars_purchased)) statsItems.push({ label: "Cars Purchased", value: scraped.stats_cars_purchased, isNew: !isFilledText(cfg?.stats_cars_purchased) });
      if (statsItems.length > 0) {
        categories.push({ label: "Stats & Reputation", icon: Star, items: statsItems, section: "site-config" });
      }

      // Locations
      if (Array.isArray(scraped.locations) && scraped.locations.length > 0) {
        const locItems = scraped.locations.slice(0, 5).map((loc, i) => ({
          label: loc.name || `Location ${i + 1}`,
          value: [loc.address, loc.city_state_zip, loc.brands].filter(Boolean).join(" · "),
          isNew: true,
        }));
        categories.push({ label: `Locations (${locItems.length})`, icon: MapPin, items: locItems, section: "locations" });
      }

      // Business Hours
      if (Array.isArray(scraped.business_hours) && scraped.business_hours.length > 0) {
        const hourItems = scraped.business_hours
          .filter(h => isFilledText(h?.days) && isFilledText(h?.hours))
          .map(h => ({
            label: h.department || "Hours",
            value: `${h.days}: ${h.hours}`,
            isNew: !Array.isArray(cfg?.business_hours) || (cfg.business_hours as unknown[]).length === 0,
          }));
        if (hourItems.length > 0) {
          categories.push({ label: "Business Hours", icon: Clock, items: hourItems, section: "site-config" });
        }
      }

      // Staff
      if (Array.isArray(scraped.staff_members) && scraped.staff_members.length > 0) {
        const staffItems = scraped.staff_members.slice(0, 10).map(s => ({
          label: s.name || "Staff",
          value: [s.title, s.email].filter(Boolean).join(" · "),
          isNew: true,
        }));
        categories.push({ label: `Staff (${staffItems.length})`, icon: Users, items: staffItems, section: "staff" });
      }

      const totalFound = categories.reduce((sum, c) => sum + c.items.length, 0);
      const totalNew = categories.reduce((sum, c) => sum + c.items.filter(i => i.isNew).length, 0);

      // Build missing items
      const missing: MissingItem[] = [];
      if (!isFilledText(scraped.dealership_name) && !isFilledText(cfg?.dealership_name)) missing.push({ label: "Dealership name", icon: Building2, section: "site-config" });
      if (!isFilledText(scraped.logo_url) && !isFilledText(cfg?.logo_url)) missing.push({ label: "Logo upload", icon: Image, section: "site-config" });
      if (!isFilledText(scraped.phone) && !isFilledText(cfg?.phone)) missing.push({ label: "Phone number", icon: Phone, section: "site-config" });
      if (!isFilledText(scraped.email) && !isFilledText(cfg?.email)) missing.push({ label: "Email address", icon: Mail, section: "site-config" });
      if ((!Array.isArray(scraped.locations) || scraped.locations.length === 0)) missing.push({ label: "Locations", icon: MapPin, section: "locations" });
      if ((!Array.isArray(scraped.staff_emails) || scraped.staff_emails.length === 0) && (!Array.isArray(scraped.staff_members) || scraped.staff_members.length === 0)) missing.push({ label: "Notification recipients", icon: Users, section: "notifications" });

      setPreviewData({ scraped, categories, missing, totalFound, totalNew });
    } catch (error) {
      console.error("Dealer website scrape failed", error);
      toast({ title: "Scrape failed", description: error instanceof Error ? error.message : "Could not scan this dealer website.", variant: "destructive" });
    } finally {
      setScraping(false);
    }
  };

  const handleConfirmSave = async () => {
    if (!previewData) return;
    setSaving(true);
    const scraped = previewData.scraped;
    const normalizedUrl = normalizeUrl(scrapeUrl);

    try {
      const [configRes, accountRes, existingLocsRes] = await Promise.all([
        supabase.from("site_config")
          .select("dealership_name, tagline, phone, email, address, website_url, google_review_url, facebook_url, instagram_url, tiktok_url, youtube_url, primary_color, accent_color, success_color, logo_url, favicon_url, business_hours, hero_headline, hero_subtext, about_hero_headline, about_story, stats_years_in_business, stats_rating, stats_reviews_count, stats_cars_purchased, established_year")
          .eq("dealership_id", dealershipId).maybeSingle(),
        supabase.from("dealer_accounts")
          .select("id, architecture, bdc_model, onboarding_answers")
          .eq("dealership_id", dealershipId).maybeSingle(),
        supabase.from("dealership_locations")
          .select("id, name").eq("dealership_id", dealershipId),
      ]);

      const currentConfig = configRes.data;
      const currentAccount = accountRes.data as { id?: string; architecture?: string; bdc_model?: string; onboarding_answers?: OnboardingAnswers | null } | null;
      const existingLocNames = new Set((existingLocsRes.data || []).map(l => l.name.toLowerCase()));

      // Build onboarding answers
      const mergedAnswers: OnboardingAnswers = currentAccount?.onboarding_answers && typeof currentAccount.onboarding_answers === "object"
        ? { ...(currentAccount.onboarding_answers as OnboardingAnswers) } : {};
      const nextAnswers = buildAnswerMap(scraped, normalizedUrl);
      let answerFillCount = 0;
      Object.entries(nextAnswers).forEach(([key, value]) => {
        if (isFilledText(value) && !isFilledText(mergedAnswers[key])) {
          mergedAnswers[key] = value;
          answerFillCount += 1;
        }
      });

      // Build site_config updates
      const configUpdates: Record<string, unknown> = {};
      let configFillCount = 0;
      const maybeSet = (key: string, currentValue: unknown, nextValue?: string) => {
        if (isFilledText(nextValue) && !isFilledText(currentValue)) {
          configUpdates[key] = nextValue.trim();
          configFillCount += 1;
        }
      };
      maybeSet("dealership_name", currentConfig?.dealership_name, scraped.dealership_name);
      maybeSet("tagline", currentConfig?.tagline, scraped.tagline);
      maybeSet("phone", currentConfig?.phone, scraped.phone);
      maybeSet("email", currentConfig?.email, scraped.email);
      maybeSet("address", currentConfig?.address, scraped.address);
      maybeSet("website_url", currentConfig?.website_url, scraped.website || normalizedUrl);
      maybeSet("google_review_url", currentConfig?.google_review_url, scraped.google_review);
      maybeSet("facebook_url", currentConfig?.facebook_url, scraped.facebook);
      maybeSet("instagram_url", currentConfig?.instagram_url, scraped.instagram);
      maybeSet("tiktok_url", currentConfig?.tiktok_url, scraped.tiktok);
      maybeSet("youtube_url", currentConfig?.youtube_url, scraped.youtube);
      maybeSet("logo_url", currentConfig?.logo_url, scraped.logo_url);
      maybeSet("hero_headline", currentConfig?.hero_headline, scraped.hero_headline);
      maybeSet("hero_subtext", currentConfig?.hero_subtext, scraped.hero_subtext);
      maybeSet("about_hero_headline", (currentConfig as any)?.about_hero_headline, scraped.about_hero_headline);
      maybeSet("about_story", (currentConfig as any)?.about_story, scraped.about_story);
      maybeSet("stats_years_in_business", currentConfig?.stats_years_in_business, scraped.stats_years_in_business);
      maybeSet("stats_rating", currentConfig?.stats_rating, scraped.stats_rating);
      maybeSet("stats_reviews_count", currentConfig?.stats_reviews_count, scraped.stats_reviews_count);
      maybeSet("stats_cars_purchased", currentConfig?.stats_cars_purchased, scraped.stats_cars_purchased);
      maybeSet("favicon_url", (currentConfig as any)?.favicon_url, scraped.favicon_url);

      // Established year
      const estYear = scraped.established_year ? parseInt(scraped.established_year) : null;
      if (estYear && estYear >= 1800 && estYear <= new Date().getFullYear() && !(currentConfig as any)?.established_year) {
        configUpdates.established_year = estYear;
        // Also auto-compute years in business string
        if (!isFilledText(currentConfig?.stats_years_in_business)) {
          configUpdates.stats_years_in_business = `${new Date().getFullYear() - estYear} yrs`;
        }
        configFillCount += 1;
      }

      const primaryColor = normalizeBrandColor(scraped.primary_color);
      if (primaryColor && (!isFilledText(currentConfig?.primary_color) || currentConfig?.primary_color === DEFAULT_PRIMARY_COLOR)) {
        configUpdates.primary_color = primaryColor;
        configFillCount += 1;
      }
      const accentColor = normalizeBrandColor(scraped.accent_color);
      if (accentColor && (!isFilledText(currentConfig?.accent_color) || currentConfig?.accent_color === DEFAULT_ACCENT_COLOR)) {
        configUpdates.accent_color = accentColor;
        configFillCount += 1;
      }
      const successColor = normalizeBrandColor(scraped.success_color);
      if (successColor && !isFilledText(currentConfig?.success_color)) {
        configUpdates.success_color = successColor;
        configFillCount += 1;
      }

      const businessHours = Array.isArray(scraped.business_hours)
        ? scraped.business_hours.filter(i => isFilledText(i?.days) && isFilledText(i?.hours)).map(i => ({ days: i.days!.trim(), hours: i.hours!.trim() }))
        : [];
      if (businessHours.length > 0 && (!Array.isArray(currentConfig?.business_hours) || (currentConfig.business_hours as unknown[]).length === 0)) {
        configUpdates.business_hours = businessHours;
        configFillCount += 1;
      }

      // Account updates
      const accountUpdates: Record<string, unknown> = {};
      if (answerFillCount > 0) accountUpdates.onboarding_answers = mergedAnswers;
      const detectedArch = scraped.architecture ? ARCHITECTURE_MAP[scraped.architecture] : undefined;
      if (detectedArch && (!currentAccount?.architecture || (currentAccount.architecture === "single_store" && currentAccount.bdc_model === "single_bdc"))) {
        accountUpdates.architecture = detectedArch;
      }

      // Auto-create locations
      let locationsCreated = 0;
      if (Array.isArray(scraped.locations) && scraped.locations.length > 0) {
        const newLocs = scraped.locations.filter(loc => {
          if (!isFilledText(loc.name)) return false;
          return !existingLocNames.has(loc.name!.toLowerCase());
        });

        if (newLocs.length > 0) {
          const locsToInsert = newLocs.map((loc, i) => {
            const csz = loc.city_state_zip || "";
            const cszParts = csz.split(",").map(p => p.trim());
            const city = cszParts[0] || loc.name || "Unknown";
            const stateZip = cszParts[1]?.trim() || "";
            const state = stateZip.replace(/\d+/g, "").trim() || "CT";
            const brands = loc.brands ? loc.brands.split(",").map(b => b.trim()).filter(Boolean) : [];

            return {
              dealership_id: dealershipId,
              name: loc.name!.trim(),
              address: loc.address || "",
              city,
              state: state.substring(0, 2).toUpperCase() || "CT",
              oem_brands: brands,
              all_brands: brands.length === 0,
              sort_order: (existingLocsRes.data?.length || 0) + i,
              is_active: true,
            };
          });

          const { error: locError } = await supabase.from("dealership_locations").insert(locsToInsert);
          if (locError) {
            console.error("Failed to create locations:", locError);
          } else {
            locationsCreated = locsToInsert.length;
          }
        }
      }

      // Execute mutations
      const mutations: any[] = [];
      if (Object.keys(configUpdates).length > 0) {
        mutations.push(supabase.from("site_config").update(configUpdates).eq("dealership_id", dealershipId));
      }
      if (Object.keys(accountUpdates).length > 0) {
        if (currentAccount?.id) {
          mutations.push(supabase.from("dealer_accounts").update(accountUpdates).eq("id", currentAccount.id));
        } else {
          mutations.push(supabase.from("dealer_accounts").insert({ dealership_id: dealershipId, ...accountUpdates } as never));
        }
      }

      // Auto-populate notification recipients from scraped staff emails
      const allStaffEmails = new Set<string>();
      if (Array.isArray(scraped.staff_emails)) scraped.staff_emails.forEach(e => allStaffEmails.add(e.trim()));
      if (Array.isArray(scraped.staff_members)) scraped.staff_members.forEach(m => { if (isFilledText(m.email)) allStaffEmails.add(m.email!.trim()); });
      if (isFilledText(scraped.email)) allStaffEmails.add(scraped.email.trim());

      if (allStaffEmails.size > 0) {
        const { data: notifData } = await supabase.from("notification_settings")
          .select("id, email_recipients")
          .eq("dealership_id", dealershipId).maybeSingle();
        if (notifData && (!Array.isArray(notifData.email_recipients) || notifData.email_recipients.length === 0)) {
          mutations.push(supabase.from("notification_settings").update({
            email_recipients: Array.from(allStaffEmails),
          }).eq("id", notifData.id));
        }
      }

      const results = await Promise.all(mutations);
      const failedResult = results.find(r => r.error);
      if (failedResult?.error) throw failedResult.error;

      const totalFilled = answerFillCount + configFillCount + (accountUpdates.architecture ? 1 : 0) + locationsCreated;

      toast({
        title: totalFilled > 0 ? "Tenant auto-filled" : "Scan complete",
        description: totalFilled > 0
          ? `Saved ${totalFilled} fields${locationsCreated > 0 ? ` and created ${locationsCreated} location${locationsCreated > 1 ? "s" : ""}` : ""} for ${scraped.dealership_name || dealershipId}.`
          : "All fields were already populated.",
      });

      onAutofillComplete?.();
    } catch (error) {
      console.error("Auto-fill save failed", error);
      toast({ title: "Save failed", description: error instanceof Error ? error.message : "Could not save scraped data.", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  // Preview UI
  if (previewData) {
    return (
      <Card className="border-primary/30 bg-gradient-to-r from-primary/5 to-accent/5">
        <CardContent className="space-y-4 py-5">
          {/* Summary header */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 shrink-0">
                <Sparkles className="h-5 w-5 text-primary" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-card-foreground">
                  Scan Results — {previewData.scraped.dealership_name || "Unknown"}
                </h3>
                <p className="text-xs text-muted-foreground">
                  Found <span className="font-semibold text-primary">{previewData.totalFound}</span> fields
                  {previewData.totalNew > 0 && <> · <span className="font-semibold text-emerald-600">{previewData.totalNew} new</span></>}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={() => setPreviewData(null)}>
                Cancel
              </Button>
              <Button size="sm" onClick={() => void handleConfirmSave()} disabled={saving} className="gap-2">
                {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle className="h-3.5 w-3.5" />}
                {saving ? "Saving…" : "Confirm & Save"}
              </Button>
            </div>
          </div>

          {/* Category cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {previewData.categories.map((category) => {
              const CatIcon = category.icon;
              const newCount = category.items.filter(i => i.isNew).length;
              return (
                <div key={category.label} className="border rounded-lg p-3 bg-background/50">
                  <div className="flex items-center gap-2 mb-2">
                    <CatIcon className="h-4 w-4 text-primary" />
                    <span className="text-xs font-semibold text-card-foreground">{category.label}</span>
                    {newCount > 0 && <Badge variant="secondary" className="text-[10px] px-1.5 py-0 bg-emerald-100 text-emerald-700 border-emerald-200">{newCount} new</Badge>}
                  </div>
                  <div className="space-y-1">
                    {category.items.map((item, idx) => (
                      <div key={idx} className="flex items-start gap-2 text-xs">
                        {item.isNew ? (
                          <CheckCircle className="h-3 w-3 shrink-0 text-emerald-500 mt-0.5" />
                        ) : (
                          <span className="h-3 w-3 shrink-0 flex items-center justify-center mt-0.5 text-muted-foreground/50">—</span>
                        )}
                        <span className="text-muted-foreground shrink-0">{item.label}:</span>
                        <span className="text-card-foreground truncate flex-1" title={item.value}>{item.value}</span>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Missing items — guided next steps */}
          {previewData.missing.length > 0 && (
            <div className="border border-amber-200 bg-amber-50/50 rounded-lg p-3 dark:border-amber-800 dark:bg-amber-950/20">
              <div className="flex items-center gap-2 mb-2">
                <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                <span className="text-xs font-semibold text-amber-800 dark:text-amber-400">Still needs attention</span>
              </div>
              <div className="flex flex-wrap gap-2">
                {previewData.missing.map((item) => {
                  const MIcon = item.icon;
                  return (
                    <button
                      key={item.label}
                      onClick={() => {
                        void handleConfirmSave().then(() => onNavigate?.(item.section));
                      }}
                      className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md border border-amber-300 bg-background text-xs hover:bg-amber-100/50 transition-colors dark:border-amber-700 dark:hover:bg-amber-900/30"
                    >
                      <MIcon className="h-3 w-3 text-amber-600 dark:text-amber-400" />
                      <span className="text-card-foreground">{item.label}</span>
                      <XCircle className="h-3 w-3 text-amber-400" />
                    </button>
                  );
                })}
              </div>
              <p className="text-[10px] text-muted-foreground mt-2">Click any item to save results and navigate there.</p>
            </div>
          )}
        </CardContent>
      </Card>
    );
  }

  // Default scrape input UI
  return (
    <Card className="border-primary/30 bg-gradient-to-r from-primary/5 to-accent/5">
      <CardContent className="space-y-4 py-5">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 shrink-0">
              <Sparkles className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-card-foreground">AI Website Auto-Fill</h3>
              <p className="text-xs text-muted-foreground">
                Scrape the dealer's website to auto-populate branding, contact info, locations, and more.
              </p>
            </div>
          </div>
          {onOpenQuestionnaire && (
            <Button variant="outline" size="sm" onClick={onOpenQuestionnaire} className="gap-2 shrink-0">
              Open full questionnaire
              <ArrowRight className="h-3.5 w-3.5" />
            </Button>
          )}
        </div>
        <div className="flex flex-col gap-2 sm:flex-row">
          <div className="relative flex-1">
            <Globe className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={scrapeUrl}
              onChange={(e) => setScrapeUrl(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && void handleScrape()}
              placeholder="e.g. citycdjr.com"
              className="h-10 pl-9"
            />
          </div>
          <Button onClick={() => void handleScrape()} disabled={scraping} className="gap-2 sm:min-w-40">
            {scraping ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
            {scraping ? "Scanning…" : "Scrape & Preview"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
