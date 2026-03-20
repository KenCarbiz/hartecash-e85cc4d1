import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Save, Loader2, ChevronDown, Building2, Palette, Type, BarChart3, Upload } from "lucide-react";

interface SiteConfig {
  id: string;
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
}

const DEFAULT_CONFIG: SiteConfig = {
  id: "",
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
};

interface SectionProps {
  icon: React.ElementType;
  title: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
}

const Section = ({ icon: Icon, title, children, defaultOpen = false }: SectionProps) => {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <CollapsibleTrigger asChild>
        <button className="w-full flex items-center justify-between px-4 py-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors text-left">
          <div className="flex items-center gap-2">
            <Icon className="w-4 h-4 text-primary" />
            <span className="font-semibold text-sm text-card-foreground">{title}</span>
          </div>
          <ChevronDown className={`w-4 h-4 text-muted-foreground transition-transform ${open ? "rotate-180" : ""}`} />
        </button>
      </CollapsibleTrigger>
      <CollapsibleContent className="px-1 pt-3 pb-1">{children}</CollapsibleContent>
    </Collapsible>
  );
};

const SiteConfiguration = () => {
  const [config, setConfig] = useState<SiteConfig>(DEFAULT_CONFIG);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  const [savedConfig, setSavedConfig] = useState<SiteConfig>(DEFAULT_CONFIG);
  const { toast } = useToast();

  useEffect(() => {
    fetchConfig();
  }, []);

  const fetchConfig = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("site_config")
      .select("*")
      .eq("dealership_id", "default")
      .maybeSingle();

    if (data && !error) {
      const loaded = { ...DEFAULT_CONFIG, ...data } as SiteConfig;
      setConfig(loaded);
      setSavedConfig(loaded);
    }
    setLoading(false);
  };

  const update = (field: keyof SiteConfig, value: string | number) => {
    setConfig(prev => {
      const next = { ...prev, [field]: value };
      setHasChanges(JSON.stringify(next) !== JSON.stringify(savedConfig));
      return next;
    });
  };

  const handleSave = async () => {
    setSaving(true);
    const { id, ...rest } = config;
    const payload = { ...rest, dealership_id: "default", updated_at: new Date().toISOString() };

    // Try update first, if no rows affected then insert
    const { data: existing } = await supabase
      .from("site_config")
      .select("id")
      .eq("dealership_id", "default")
      .maybeSingle();

    let error;
    if (existing) {
      ({ error } = await supabase
        .from("site_config")
        .update(payload)
        .eq("id", existing.id));
    } else {
      ({ error } = await supabase
        .from("site_config")
        .insert(payload));
    }

    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      setSavedConfig(config);
      setHasChanges(false);
      toast({ title: "Saved", description: "Site configuration updated." });
    }
    setSaving(false);
  };

  const handleLogoUpload = async (field: "logo_url" | "logo_white_url" | "favicon_url", file: File) => {
    if (file.size > 2 * 1024 * 1024) {
      toast({ title: "Too large", description: "Max 2 MB.", variant: "destructive" });
      return;
    }
    const ext = file.name.split(".").pop();
    const path = `branding/${field}_${Date.now()}.${ext}`;

    const { error } = await supabase.storage.from("staff-avatars").upload(path, file, { upsert: true });
    if (error) {
      toast({ title: "Upload failed", description: error.message, variant: "destructive" });
      return;
    }

    const { data: urlData } = supabase.storage.from("staff-avatars").getPublicUrl(path);
    update(field, urlData.publicUrl);
    toast({ title: "Uploaded", description: "Logo uploaded — save to apply." });
  };

  if (loading) {
    return <div className="flex items-center justify-center py-12 text-muted-foreground"><Loader2 className="w-5 h-5 animate-spin mr-2" /> Loading configuration...</div>;
  }

  return (
    <div className="space-y-4 max-w-3xl">
      {/* Save bar */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {hasChanges ? "You have unsaved changes." : "All changes saved."}
        </p>
        <Button onClick={handleSave} disabled={saving || !hasChanges}>
          {saving ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Save className="w-4 h-4 mr-1" />}
          Save Configuration
        </Button>
      </div>

      {/* Dealership Info */}
      <Section icon={Building2} title="Dealership Information" defaultOpen>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold">Dealership Name</Label>
            <Input value={config.dealership_name} onChange={e => update("dealership_name", e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold">Tagline</Label>
            <Input value={config.tagline} onChange={e => update("tagline", e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold">Phone Number</Label>
            <Input value={config.phone} onChange={e => update("phone", e.target.value)} placeholder="(860) 555-1234" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold">Email</Label>
            <Input value={config.email} onChange={e => update("email", e.target.value)} type="email" placeholder="info@dealership.com" />
          </div>
          <div className="sm:col-span-2 space-y-1.5">
            <Label className="text-xs font-semibold">Address</Label>
            <Input value={config.address} onChange={e => update("address", e.target.value)} placeholder="123 Main St, Hartford, CT 06103" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold">Website URL</Label>
            <Input value={config.website_url} onChange={e => update("website_url", e.target.value)} placeholder="https://www.dealership.com" />
          </div>
        </div>
      </Section>

      {/* Logos */}
      <Section icon={Upload} title="Logos & Branding Assets">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {(["logo_url", "logo_white_url", "favicon_url"] as const).map(field => {
            const labels: Record<string, string> = {
              logo_url: "Primary Logo",
              logo_white_url: "White Logo (dark backgrounds)",
              favicon_url: "Favicon",
            };
            return (
              <div key={field} className="space-y-2">
                <Label className="text-xs font-semibold">{labels[field]}</Label>
                <div className="border border-border rounded-lg p-3 bg-muted/30 flex flex-col items-center gap-2 min-h-[100px]">
                  {config[field] ? (
                    <img src={config[field]} alt={labels[field]} className="max-h-16 object-contain" />
                  ) : (
                    <div className="text-xs text-muted-foreground">No image set</div>
                  )}
                  <label className="cursor-pointer text-xs text-primary hover:underline">
                    Upload
                    <input type="file" accept="image/*" className="hidden" onChange={e => {
                      const file = e.target.files?.[0];
                      if (file) handleLogoUpload(field, file);
                      e.target.value = "";
                    }} />
                  </label>
                </div>
                <Input
                  value={config[field]}
                  onChange={e => update(field, e.target.value)}
                  placeholder="Or paste URL"
                  className="text-xs h-8"
                />
              </div>
            );
          })}
        </div>
      </Section>

      {/* Colors */}
      <Section icon={Palette} title="Brand Colors">
        <p className="text-xs text-muted-foreground mb-3">
          Colors in HSL format (e.g. "213 80% 20%"). These will be used as CSS custom properties across the site.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {([
            { key: "primary_color" as const, label: "Primary Color", desc: "Headers, buttons, links" },
            { key: "accent_color" as const, label: "Accent / CTA Color", desc: "Call-to-action buttons" },
            { key: "success_color" as const, label: "Success Color", desc: "Checkmarks, positive states" },
          ]).map(({ key, label, desc }) => (
            <div key={key} className="space-y-1.5">
              <Label className="text-xs font-semibold">{label}</Label>
              <div className="flex items-center gap-2">
                <div
                  className="w-8 h-8 rounded-md border border-border shrink-0"
                  style={{ backgroundColor: `hsl(${config[key]})` }}
                />
                <Input value={config[key]} onChange={e => update(key, e.target.value)} className="h-8 text-xs" />
              </div>
              <p className="text-xs text-muted-foreground">{desc}</p>
            </div>
          ))}
        </div>
      </Section>

      {/* Hero & Content */}
      <Section icon={Type} title="Hero Section & Content">
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold">Hero Headline</Label>
            <Input value={config.hero_headline} onChange={e => update("hero_headline", e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold">Hero Subtext</Label>
            <Textarea value={config.hero_subtext} onChange={e => update("hero_subtext", e.target.value)} rows={2} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold">Price Guarantee (days)</Label>
            <Input type="number" value={config.price_guarantee_days} onChange={e => update("price_guarantee_days", parseInt(e.target.value) || 0)} className="w-24" />
          </div>
        </div>
      </Section>

      {/* Stats */}
      <Section icon={BarChart3} title="Trust Statistics">
        <p className="text-xs text-muted-foreground mb-3">
          These numbers appear in the trust badges section of the landing page.
        </p>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold">Cars Purchased</Label>
            <Input value={config.stats_cars_purchased} onChange={e => update("stats_cars_purchased", e.target.value)} placeholder="14,721+" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold">Years in Business</Label>
            <Input value={config.stats_years_in_business} onChange={e => update("stats_years_in_business", e.target.value)} placeholder="78 yrs" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold">Rating</Label>
            <Input value={config.stats_rating} onChange={e => update("stats_rating", e.target.value)} placeholder="4.9" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold">Reviews Count</Label>
            <Input value={config.stats_reviews_count} onChange={e => update("stats_reviews_count", e.target.value)} placeholder="2,400+" />
          </div>
        </div>
      </Section>

      {/* Preview */}
      <div className="rounded-xl border border-border bg-muted/30 p-4">
        <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-widest mb-3">Live Preview</h4>
        <div className="rounded-lg overflow-hidden" style={{ background: `linear-gradient(135deg, hsl(${config.primary_color}), hsl(${config.primary_color} / 0.8))` }}>
          <div className="p-6 text-center text-white space-y-2">
            {config.logo_white_url && <img src={config.logo_white_url} alt="Logo" className="h-12 mx-auto mb-2" />}
            <h2 className="text-xl font-bold">{config.hero_headline || "Your Headline"}</h2>
            <p className="text-sm opacity-80">{config.hero_subtext || "Your subtext here"}</p>
            <button
              className="mt-3 px-4 py-2 rounded-lg text-sm font-semibold text-white"
              style={{ backgroundColor: `hsl(${config.accent_color})` }}
            >
              Get Your Offer
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SiteConfiguration;
