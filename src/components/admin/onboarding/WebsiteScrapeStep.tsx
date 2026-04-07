import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Sparkles, Loader2, CheckCircle2, AlertTriangle, Upload, Image as ImageIcon,
} from "lucide-react";
import { toast } from "sonner";
import type { WizardState } from "./types";

interface Props {
  state: WizardState;
  onChange: (partial: Partial<WizardState>) => void;
}

function ScrapedField({ label, value }: { label: string; value: string }) {
  if (!value) return null;
  return (
    <div className="flex justify-between text-xs py-1">
      <span className="text-muted-foreground font-medium">{label}</span>
      <span className="text-card-foreground text-right max-w-[60%] truncate">{value}</span>
    </div>
  );
}

const WebsiteScrapeStep = ({ state, onChange }: Props) => {
  const [scraping, setScraping] = useState(false);
  const [error, setError] = useState("");

  const handleScrape = async () => {
    if (!state.websiteUrl.trim()) return;
    setScraping(true);
    setError("");

    try {
      const { data, error: fnErr } = await supabase.functions.invoke("scrape-dealer-site", {
        body: { url: state.websiteUrl },
      });
      if (fnErr) throw fnErr;
      if (data?.success && data?.data) {
        onChange({ scrapedData: data.data });
        toast.success(`Extracted data from ${data.pages_scraped || "multiple"} pages`);
      } else {
        setError(data?.error || "No data extracted");
      }
    } catch (e: any) {
      setError(e.message || "Scrape failed");
    } finally {
      setScraping(false);
    }
  };

  const sd = state.scrapedData;

  return (
    <div className="space-y-6">
      {/* AI Scanner card */}
      <div className="bg-gradient-to-br from-primary/5 to-primary/0 border border-primary/10 rounded-xl p-5">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
            <Sparkles className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-card-foreground">AI Website Scanner</h3>
            <p className="text-xs text-muted-foreground mt-1">
              Enter the corporate website URL. We'll scan homepage, about, hours, and staff pages to extract branding, contact info, hours, OEM brands, and logos.
            </p>
          </div>
        </div>
      </div>

      <div className="flex gap-2">
        <Input
          value={state.websiteUrl}
          onChange={(e) => onChange({ websiteUrl: e.target.value })}
          placeholder="https://www.smithmotors.com"
          disabled={scraping}
          className="flex-1"
        />
        <Button onClick={handleScrape} disabled={scraping || !state.websiteUrl.trim()} className="gap-1.5">
          {scraping ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
          {scraping ? "Scanning…" : "Scan"}
        </Button>
      </div>

      {error && (
        <div className="bg-destructive/10 border border-destructive/20 rounded-xl p-3 flex items-start gap-2">
          <AlertTriangle className="w-4 h-4 text-destructive mt-0.5" />
          <p className="text-xs text-destructive">{error}</p>
        </div>
      )}

      {sd && (
        <div className="bg-muted/30 border border-border rounded-xl p-4 space-y-4">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-500" />
            <span className="text-sm font-bold text-card-foreground">Data Extracted</span>
          </div>

          <div className="divide-y divide-border">
            <ScrapedField label="Name" value={sd.dealership_name} />
            <ScrapedField label="Tagline" value={sd.tagline} />
            <ScrapedField label="Phone" value={sd.phone} />
            <ScrapedField label="Email" value={sd.email} />
            <ScrapedField label="Address" value={sd.address} />
            <ScrapedField label="Est." value={sd.established_year} />
            <ScrapedField label="Rating" value={sd.stats_rating ? `${sd.stats_rating} ★ (${sd.stats_reviews_count || ""}+ reviews)` : ""} />
            <ScrapedField label="OEM Brands" value={sd.oem_brands?.join(", ") || ""} />
            <ScrapedField label="Locations" value={sd.locations?.length > 0 ? `${sd.locations.length} found` : ""} />
            <ScrapedField label="Hours" value={sd.business_hours?.length > 0 ? `${sd.business_hours.length} entries` : ""} />
            <ScrapedField label="Staff Emails" value={sd.staff_emails?.length > 0 ? `${sd.staff_emails.length} found` : ""} />
            <ScrapedField label="Staff Phones" value={sd.staff_phones?.length > 0 ? `${sd.staff_phones.length} found` : ""} />
            <ScrapedField label="Colors" value={[sd.primary_color, sd.accent_color, sd.success_color].filter(Boolean).join(", ") || ""} />
            <ScrapedField label="Social" value={[sd.facebook && "FB", sd.instagram && "IG", sd.youtube && "YT", sd.tiktok && "TT", sd.google_review && "Google"].filter(Boolean).join(", ") || ""} />
            <ScrapedField label="Service Hero" value={sd.service_hero_headline || ""} />
            <ScrapedField label="Trade Hero" value={sd.trade_hero_headline || ""} />
            <ScrapedField label="Testimonials" value={sd.testimonials?.length > 0 ? `${sd.testimonials.length} found` : ""} />
            <ScrapedField label="Certifications" value={sd.certifications?.length > 0 ? sd.certifications.join(", ") : ""} />
          </div>

          {sd.about_story && (
            <div>
              <p className="text-[10px] font-semibold text-muted-foreground uppercase mb-1">About Story</p>
              <p className="text-xs text-muted-foreground line-clamp-3">{sd.about_story}</p>
            </div>
          )}

          {sd.community_involvement && (
            <div>
              <p className="text-[10px] font-semibold text-muted-foreground uppercase mb-1">Community</p>
              <p className="text-xs text-muted-foreground line-clamp-2">{sd.community_involvement}</p>
            </div>
          )}
        </div>
      )}

      {/* Logo collection */}
      <div className="space-y-3">
        <h4 className="text-sm font-bold">Corporate Logos</h4>
        <p className="text-xs text-muted-foreground">
          Provide light and dark versions. The scanner may have auto-detected these.
        </p>
        <div className="grid grid-cols-2 gap-3">
          <LogoUploadSlot
            label="Light Mode Logo"
            value={state.corporateLogoUrl}
            onChange={(url) => onChange({ corporateLogoUrl: url })}
          />
          <LogoUploadSlot
            label="Dark Mode Logo"
            value={state.corporateLogoDarkUrl}
            onChange={(url) => onChange({ corporateLogoDarkUrl: url })}
          />
        </div>
      </div>
    </div>
  );
};

function LogoUploadSlot({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (url: string) => void;
}) {
  return (
    <div className="border border-dashed border-border rounded-lg p-3 space-y-2">
      <Label className="text-xs font-medium">{label}</Label>
      {value ? (
        <div className="relative group">
          <img
            src={value}
            alt={label}
            className="h-12 object-contain mx-auto"
            onError={(e) => {
              (e.target as HTMLImageElement).style.display = "none";
            }}
          />
          <button
            type="button"
            onClick={() => onChange("")}
            className="absolute top-0 right-0 text-[10px] text-destructive opacity-0 group-hover:opacity-100 transition-opacity"
          >
            Remove
          </button>
        </div>
      ) : (
        <div className="flex items-center justify-center h-12 text-muted-foreground">
          <ImageIcon className="w-5 h-5" />
        </div>
      )}
      <Input
        placeholder="Logo URL or paste link"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="text-xs h-7"
      />
    </div>
  );
}

export default WebsiteScrapeStep;
