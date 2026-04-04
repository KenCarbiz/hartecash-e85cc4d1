import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Sparkles, Globe, Loader2, ArrowRight } from "lucide-react";

interface DealerWebsiteAutofillCardProps {
  dealershipId: string;
  onAutofillComplete?: () => void;
  onOpenQuestionnaire?: () => void;
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
}

type OnboardingAnswers = Record<string, string>;

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
  if (/^\d{1,3}\s+\d{1,3}%\s+\d{1,3}%$/.test(trimmed)) {
    return trimmed;
  }

  let hex = trimmed.replace(/^#/, "");
  if (hex.length === 3) {
    hex = hex.split("").map((char) => char + char).join("");
  }

  if (!/^[0-9a-fA-F]{6}$/.test(hex)) {
    return null;
  }

  const r = parseInt(hex.slice(0, 2), 16) / 255;
  const g = parseInt(hex.slice(2, 4), 16) / 255;
  const b = parseInt(hex.slice(4, 6), 16) / 255;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const lightness = (max + min) / 2;
  const delta = max - min;

  let hue = 0;
  let saturation = 0;

  if (delta !== 0) {
    saturation = delta / (1 - Math.abs(2 * lightness - 1));

    switch (max) {
      case r:
        hue = 60 * (((g - b) / delta) % 6);
        break;
      case g:
        hue = 60 * ((b - r) / delta + 2);
        break;
      default:
        hue = 60 * ((r - g) / delta + 4);
        break;
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

  // Section 1: Identity
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

  // Section 2: Architecture
  setField("architecture", data.architecture);
  setField("num_locations", data.num_locations);

  // Section 3: Branding
  setField("primary_color", data.primary_color);
  setField("accent_color", data.accent_color);
  setField("success_color", data.success_color);

  // Section 4: Hero
  setField("hero_headline", data.hero_headline);
  setField("hero_subtext", data.hero_subtext);

  // Section 11: Notifications — staff emails & phones
  if (Array.isArray(data.staff_emails) && data.staff_emails.length > 0) {
    fieldMap.staff_emails = data.staff_emails.join("\n");
  }
  if (Array.isArray(data.staff_phones) && data.staff_phones.length > 0) {
    fieldMap.staff_sms = data.staff_phones.join("\n");
  }

  // Section 13: Locations
  if (Array.isArray(data.locations)) {
    data.locations.slice(0, 5).forEach((location, index) => {
      const item = index + 1;
      setField(`loc${item}_name`, location.name);
      setField(`loc${item}_address`, location.address);
      setField(`loc${item}_csz`, location.city_state_zip);
      setField(`loc${item}_brands`, location.brands);
    });
  }

  // Section 15: Staff members
  if (Array.isArray(data.staff_members) && data.staff_members.length > 0) {
    const adminEmails: string[] = [];
    const gsmEmails: string[] = [];
    const ucmEmails: string[] = [];
    const bdcEmails: string[] = [];

    data.staff_members.forEach((member) => {
      if (!isFilledText(member.email)) return;
      const title = (member.title || "").toLowerCase();
      if (title.includes("general manager") || title.includes("gm") || title.includes("gsm")) {
        gsmEmails.push(member.email!);
      } else if (title.includes("used car") || title.includes("pre-owned") || title.includes("ucm")) {
        ucmEmails.push(member.email!);
      } else if (title.includes("bdc") || title.includes("internet") || title.includes("sales")) {
        bdcEmails.push(member.email!);
      } else if (title.includes("owner") || title.includes("dealer principal") || title.includes("admin")) {
        adminEmails.push(member.email!);
      } else {
        bdcEmails.push(member.email!);
      }
    });

    if (adminEmails.length) fieldMap.admin_users = adminEmails.join("\n");
    if (gsmEmails.length) fieldMap.gsm_users = gsmEmails.join("\n");
    if (ucmEmails.length) fieldMap.ucm_users = ucmEmails.join("\n");
    if (bdcEmails.length) fieldMap.bdc_users = bdcEmails.join("\n");
  }

  // Business hours
  if (Array.isArray(data.business_hours)) {
    const summary = data.business_hours
      .filter((item) => isFilledText(item?.days) && isFilledText(item?.hours))
      .map((item) => {
        const prefix = isFilledText(item.department) ? `${item.department} — ` : "";
        return `${prefix}${item.days!.trim()}: ${item.hours!.trim()}`;
      })
      .join("\n");

    if (summary) {
      fieldMap.business_hours_summary = summary;
    }
  }

  // Additional misc
  setField("special_instructions", data.dealer_group_name ? `Part of ${data.dealer_group_name}` : undefined);

  return fieldMap;
};

export default function DealerWebsiteAutofillCard({
  dealershipId,
  onAutofillComplete,
  onOpenQuestionnaire,
}: DealerWebsiteAutofillCardProps) {
  const { toast } = useToast();
  const [scrapeUrl, setScrapeUrl] = useState("");
  const [scraping, setScraping] = useState(false);

  useEffect(() => {
    const loadWebsite = async () => {
      const { data } = await supabase
        .from("site_config")
        .select("website_url")
        .eq("dealership_id", dealershipId)
        .maybeSingle();

      if (isFilledText(data?.website_url)) {
        setScrapeUrl(data.website_url);
      } else {
        setScrapeUrl("");
      }
    };

    void loadWebsite();
  }, [dealershipId]);

  const handleScrape = async () => {
    if (!scrapeUrl.trim()) {
      toast({
        title: "Website required",
        description: "Enter the dealer website first.",
        variant: "destructive",
      });
      return;
    }

    setScraping(true);
    const normalizedUrl = normalizeUrl(scrapeUrl);

    try {
      const { data, error } = await supabase.functions.invoke("scrape-dealer-site", {
        body: { url: normalizedUrl },
      });

      if (error) throw error;
      if (!data?.success || !data?.data) {
        throw new Error(data?.error || "Failed to extract dealer information");
      }

      const scraped = data.data as ScrapedDealerInfo;
      const [configRes, accountRes] = await Promise.all([
        supabase
          .from("site_config")
          .select("dealership_name, tagline, phone, email, address, website_url, google_review_url, facebook_url, instagram_url, tiktok_url, youtube_url, primary_color, accent_color, logo_url, business_hours")
          .eq("dealership_id", dealershipId)
          .maybeSingle(),
        supabase
          .from("dealer_accounts")
          .select("id, architecture, bdc_model, onboarding_answers")
          .eq("dealership_id", dealershipId)
          .maybeSingle(),
      ]);

      if (configRes.error) throw configRes.error;
      if (accountRes.error) throw accountRes.error;

      const currentConfig = configRes.data;
      const currentAccount = accountRes.data as {
        id?: string;
        architecture?: string;
        bdc_model?: string;
        onboarding_answers?: OnboardingAnswers | null;
      } | null;

      const mergedAnswers: OnboardingAnswers =
        currentAccount?.onboarding_answers && typeof currentAccount.onboarding_answers === "object"
          ? { ...(currentAccount.onboarding_answers as OnboardingAnswers) }
          : {};

      const nextAnswers = buildAnswerMap(scraped, normalizedUrl);
      let answerFillCount = 0;
      Object.entries(nextAnswers).forEach(([key, value]) => {
        if (isFilledText(value) && !isFilledText(mergedAnswers[key])) {
          mergedAnswers[key] = value;
          answerFillCount += 1;
        }
      });

      const configUpdates: Record<string, unknown> = {};
      let configFillCount = 0;
      const maybeSetConfigText = (key: string, currentValue: unknown, nextValue?: string) => {
        if (isFilledText(nextValue) && !isFilledText(currentValue)) {
          configUpdates[key] = nextValue.trim();
          configFillCount += 1;
        }
      };

      maybeSetConfigText("dealership_name", currentConfig?.dealership_name, scraped.dealership_name);
      maybeSetConfigText("tagline", currentConfig?.tagline, scraped.tagline);
      maybeSetConfigText("phone", currentConfig?.phone, scraped.phone);
      maybeSetConfigText("email", currentConfig?.email, scraped.email);
      maybeSetConfigText("address", currentConfig?.address, scraped.address);
      maybeSetConfigText("website_url", currentConfig?.website_url, scraped.website || normalizedUrl);
      maybeSetConfigText("google_review_url", currentConfig?.google_review_url, scraped.google_review);
      maybeSetConfigText("facebook_url", currentConfig?.facebook_url, scraped.facebook);
      maybeSetConfigText("instagram_url", currentConfig?.instagram_url, scraped.instagram);
      maybeSetConfigText("tiktok_url", currentConfig?.tiktok_url, scraped.tiktok);
      maybeSetConfigText("youtube_url", currentConfig?.youtube_url, scraped.youtube);
      maybeSetConfigText("logo_url", currentConfig?.logo_url, scraped.logo_url);

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

      const businessHours = Array.isArray(scraped.business_hours)
        ? scraped.business_hours
            .filter((item) => isFilledText(item?.days) && isFilledText(item?.hours))
            .map((item) => ({ days: item.days!.trim(), hours: item.hours!.trim() }))
        : [];

      if (
        businessHours.length > 0 &&
        (!Array.isArray(currentConfig?.business_hours) || currentConfig.business_hours.length === 0)
      ) {
        configUpdates.business_hours = businessHours;
        configFillCount += 1;
      }

      const accountUpdates: Record<string, unknown> = {};
      if (answerFillCount > 0) {
        accountUpdates.onboarding_answers = mergedAnswers;
      }

      const detectedArchitecture = scraped.architecture ? ARCHITECTURE_MAP[scraped.architecture] : undefined;
      if (
        detectedArchitecture &&
        (!currentAccount?.architecture ||
          (currentAccount.architecture === "single_store" && currentAccount.bdc_model === "single_bdc"))
      ) {
        accountUpdates.architecture = detectedArchitecture;
      }

      const mutations = [];
      if (Object.keys(configUpdates).length > 0) {
        mutations.push(
          supabase
            .from("site_config")
            .update(configUpdates)
            .eq("dealership_id", dealershipId)
        );
      }

      if (Object.keys(accountUpdates).length > 0) {
        if (currentAccount?.id) {
          mutations.push(
            supabase
              .from("dealer_accounts")
              .update(accountUpdates)
              .eq("id", currentAccount.id)
          );
        } else {
          mutations.push(
            supabase
              .from("dealer_accounts")
              .insert({ dealership_id: dealershipId, ...accountUpdates } as never)
          );
        }
      }

      const results = await Promise.all(mutations);
      const failedResult = results.find((result) => result.error);
      if (failedResult?.error) throw failedResult.error;

      const totalFilled = answerFillCount + configFillCount + (accountUpdates.architecture ? 1 : 0);
      onAutofillComplete?.();

      toast({
        title: totalFilled > 0 ? "Tenant auto-filled" : "Scan complete",
        description:
          totalFilled > 0
            ? `Saved ${totalFilled} AI-detected fields for ${scraped.dealership_name || dealershipId}.`
            : "We found data, but this tenant already had those fields filled.",
      });
    } catch (error) {
      console.error("Dealer website auto-fill failed", error);
      toast({
        title: "Auto-fill failed",
        description: error instanceof Error ? error.message : "Could not scan this dealer website.",
        variant: "destructive",
      });
    } finally {
      setScraping(false);
    }
  };

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
                This fills the current tenant’s onboarding data from their website before you continue the setup.
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
              onChange={(event) => setScrapeUrl(event.target.value)}
              onKeyDown={(event) => event.key === "Enter" && void handleScrape()}
              placeholder="e.g. citycdjr.com"
              className="h-10 pl-9"
            />
          </div>
          <Button onClick={() => void handleScrape()} disabled={scraping} className="gap-2 sm:min-w-40">
            {scraping ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
            {scraping ? "Scanning…" : "Scrape tenant site"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
