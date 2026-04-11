import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useTenant } from "@/contexts/TenantContext";
import { useSiteConfig } from "@/hooks/useSiteConfig";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Badge } from "@/components/ui/badge";
import {
  Save, Loader2, Paintbrush, Eye, Globe, Mail, FileText, Image, Tag, EyeOff, HardHat,
} from "lucide-react";
import { InDevelopmentBadge } from "./InDevelopmentBadge";

/* ── Premium card shell ────────────────────────────────── */

const PremiumCard = ({
  icon: Icon,
  title,
  description,
  children,
}: {
  icon: React.ElementType;
  title: string;
  description?: string;
  children: React.ReactNode;
}) => (
  <div className="rounded-2xl border border-border/60 bg-card/80 backdrop-blur-sm shadow-[0_1px_3px_rgba(0,0,0,0.04),0_8px_24px_rgba(0,0,0,0.03)] overflow-hidden">
    <div className="bg-gradient-to-r from-muted/60 via-muted/30 to-transparent px-6 py-4 border-b border-border/40 flex items-center gap-3">
      <span className="flex items-center justify-center w-9 h-9 rounded-xl bg-primary/10">
        <Icon className="w-4.5 h-4.5 text-primary" />
      </span>
      <div>
        <h3 className="text-sm font-bold text-foreground/90 tracking-tight">{title}</h3>
        {description && <p className="text-xs text-muted-foreground mt-0.5">{description}</p>}
      </div>
    </div>
    <div className="p-6">{children}</div>
  </div>
);

/* ── Main component ────────────────────────────────────── */

interface WhiteLabelState {
  /** @deprecated Superseded by powered_by_mode. Still read for backward compat. */
  hide_branding: boolean;
  /** Three-way attribution toggle. Dealer-controlled (unless super-admin
   *  has set force_autocurb_attribution on site_config). */
  powered_by_mode: "autocurb" | "dealer" | "hidden";
  custom_email_domain: string;
  custom_favicon_url: string;
  meta_title: string;
  meta_description: string;
}

const DEFAULTS: WhiteLabelState = {
  hide_branding: false,
  powered_by_mode: "autocurb",
  custom_email_domain: "",
  custom_favicon_url: "",
  meta_title: "",
  meta_description: "",
};

const WhiteLabelSettings = () => {
  const { tenant } = useTenant();
  const { config: siteConfig } = useSiteConfig();
  const { toast } = useToast();
  const dealershipId = tenant.dealership_id;

  const [state, setState] = useState<WhiteLabelState>(DEFAULTS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  /* ── Load persisted settings from site_config ── */
  useEffect(() => {
    const fetch = async () => {
      setLoading(true);
      const { data } = await supabase
        .from("site_config")
        .select("white_label_settings, favicon_url")
        .eq("dealership_id", dealershipId)
        .maybeSingle();
      if (data) {
        const wl = (data as any).white_label_settings as Partial<WhiteLabelState> | null;
        // Legacy mapping: old hide_branding boolean maps to 'hidden'
        // when no explicit powered_by_mode exists on the record.
        const resolvedMode: "autocurb" | "dealer" | "hidden" =
          wl?.powered_by_mode ?? (wl?.hide_branding ? "hidden" : "autocurb");
        setState({
          hide_branding: wl?.hide_branding ?? false,
          powered_by_mode: resolvedMode,
          custom_email_domain: wl?.custom_email_domain ?? "",
          custom_favicon_url: wl?.custom_favicon_url ?? (data as any).favicon_url ?? "",
          meta_title: wl?.meta_title ?? "",
          meta_description: wl?.meta_description ?? "",
        });
      }
      setLoading(false);
    };
    fetch();
  }, [dealershipId]);

  /* ── Persist ── */
  const handleSave = async () => {
    setSaving(true);
    const { error } = await supabase
      .from("site_config")
      .update({ white_label_settings: state } as any)
      .eq("dealership_id", dealershipId);
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Saved", description: "White-label settings updated." });
    }
    setSaving(false);
  };

  const update = <K extends keyof WhiteLabelState>(key: K, value: WhiteLabelState[K]) => {
    setState((prev) => ({ ...prev, [key]: value }));
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const previewName = siteConfig.dealership_name || "Your Dealership";

  return (
    <div className="space-y-6">
      {/* ── Page header ── */}
      <div>
        <h2 className="text-xl font-bold text-card-foreground tracking-tight flex items-center gap-2">
          <Paintbrush className="w-5 h-5 text-primary" />
          White Label
        </h2>
        <p className="text-sm text-muted-foreground mt-1">
          Remove Autocurb platform attribution and customise the customer-facing experience to match your dealership.
        </p>
      </div>

      {/* ── Attribution mode (three-way) ── */}
      <PremiumCard icon={Tag} title="Footer Attribution" description="Choose what appears in the customer-facing site footer">
        {/* Locked state — super admin has forced Autocurb attribution */}
        {siteConfig.force_autocurb_attribution && (
          <div className="mb-3 rounded-xl border border-amber-500/40 bg-amber-500/10 p-3 flex items-start gap-2.5">
            <Eye className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
            <div className="text-xs text-amber-900 dark:text-amber-100 leading-snug">
              <strong className="text-amber-700 dark:text-amber-300">Attribution is locked by your Autocurb account.</strong>{" "}
              Your contract requires the "Powered by Autocurb.ai" credit to remain
              visible. Contact your Autocurb Success Manager to change this setting.
            </div>
          </div>
        )}

        <RadioGroup
          value={state.powered_by_mode}
          onValueChange={(v) => update("powered_by_mode", v as WhiteLabelState["powered_by_mode"])}
          disabled={siteConfig.force_autocurb_attribution}
          className="space-y-2"
        >
          <label
            htmlFor="pb-autocurb"
            className={`flex items-start gap-3 rounded-xl border border-border bg-muted/20 px-4 py-3 cursor-pointer hover:bg-muted/30 transition-colors ${
              siteConfig.force_autocurb_attribution ? "opacity-60 cursor-not-allowed" : ""
            }`}
          >
            <RadioGroupItem value="autocurb" id="pb-autocurb" className="mt-0.5" />
            <div className="flex-1">
              <p className="text-sm font-medium">Powered by Autocurb.ai (default)</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Standard platform attribution. Subtle link to autocurb.io in the
                site footer. The right choice for most dealerships.
              </p>
            </div>
          </label>

          <label
            htmlFor="pb-dealer"
            className={`flex items-start gap-3 rounded-xl border border-border bg-muted/20 px-4 py-3 cursor-pointer hover:bg-muted/30 transition-colors ${
              siteConfig.force_autocurb_attribution ? "opacity-60 cursor-not-allowed" : ""
            }`}
          >
            <RadioGroupItem value="dealer" id="pb-dealer" className="mt-0.5" />
            <div className="flex-1">
              <p className="text-sm font-medium">
                Powered by {siteConfig.dealership_name || "your dealership"}
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">
                White-label the attribution. The footer reads "Powered by {siteConfig.dealership_name || "your dealership name"}"
                — no mention of Autocurb. Good for dealer groups with a strong
                independent brand.
              </p>
            </div>
          </label>

          <label
            htmlFor="pb-hidden"
            className={`flex items-start gap-3 rounded-xl border border-border bg-muted/20 px-4 py-3 cursor-pointer hover:bg-muted/30 transition-colors ${
              siteConfig.force_autocurb_attribution ? "opacity-60 cursor-not-allowed" : ""
            }`}
          >
            <RadioGroupItem value="hidden" id="pb-hidden" className="mt-0.5" />
            <div className="flex-1">
              <p className="text-sm font-medium flex items-center gap-2">
                Hide attribution entirely
                <EyeOff className="w-3.5 h-3.5 text-muted-foreground" />
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">
                No "Powered by" line at all. Only your copyright remains in the
                footer. Cleanest white-label look.
              </p>
            </div>
          </label>
        </RadioGroup>
      </PremiumCard>

      {/* ── Custom email domain ── */}
      <PremiumCard icon={Mail} title="Email Sending Domain" description="Customise the From address on outbound emails">
        <div className="space-y-3">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <Label className="text-xs font-medium">Custom Domain</Label>
            <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider border border-blue-500/40 bg-blue-500/10 text-blue-700 dark:text-blue-300">
              Enterprise Beta
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground whitespace-nowrap">noreply@</span>
            <Input
              placeholder="yourdealership.com"
              value={state.custom_email_domain}
              onChange={(e) => update("custom_email_domain", e.target.value)}
              className="flex-1"
            />
          </div>
          {state.custom_email_domain && (
            <p className="text-[11px] text-muted-foreground bg-muted/40 rounded-lg px-3 py-2">
              Emails will be sent from: <span className="font-mono font-medium text-foreground/80">noreply@{state.custom_email_domain}</span>
            </p>
          )}
          {/* Enterprise Beta — DNS/SSL provisioning note */}
          <div className="rounded-xl border border-blue-500/30 bg-blue-500/5 p-3 flex items-start gap-2.5">
            <div className="flex items-center justify-center w-7 h-7 rounded-lg bg-blue-500/15 border border-blue-500/30 shrink-0">
              <Mail className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
            </div>
            <p className="text-[11px] leading-snug text-blue-900 dark:text-blue-100">
              <span className="font-bold text-blue-700 dark:text-blue-300">Enterprise Beta:</span>{" "}
              Custom sending domain configuration is saved now. Your Autocurb
              Success Manager handles DNS verification and SSL provisioning as
              part of Enterprise Beta enablement — contact support to activate.
            </p>
          </div>
        </div>
      </PremiumCard>

      {/* ── Favicon ── */}
      <PremiumCard icon={Image} title="Custom Favicon" description="Browser tab icon for your white-labeled site">
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">Favicon URL</Label>
            <Input
              placeholder="https://yourdealership.com/favicon.ico"
              value={state.custom_favicon_url}
              onChange={(e) => update("custom_favicon_url", e.target.value)}
            />
          </div>
          {state.custom_favicon_url && (
            <div className="flex items-center gap-3 bg-muted/30 rounded-lg px-3 py-2">
              <img
                src={state.custom_favicon_url}
                alt="Favicon preview"
                className="w-6 h-6 rounded object-contain"
                onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
              />
              <span className="text-xs text-muted-foreground">Favicon preview</span>
            </div>
          )}
        </div>
      </PremiumCard>

      {/* ── SEO / Meta ── */}
      <PremiumCard icon={FileText} title="SEO & Meta Tags" description="Customise page title and description for search engines">
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">Page Title</Label>
            <Input
              placeholder={`${previewName} | Sell Your Car`}
              value={state.meta_title}
              onChange={(e) => update("meta_title", e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">Meta Description</Label>
            <Input
              placeholder="Get a top-dollar cash offer on your vehicle in under 2 minutes."
              value={state.meta_description}
              onChange={(e) => update("meta_description", e.target.value)}
              className="h-auto py-2"
            />
            {state.meta_description && (
              <p className="text-[11px] text-muted-foreground">
                {state.meta_description.length}/160 characters
              </p>
            )}
          </div>
        </div>
      </PremiumCard>

      {/* ── Preview ── */}
      <PremiumCard icon={Eye} title="Brand Preview" description="How your site header and footer will appear to customers">
        <div className="space-y-4">
          {/* Header preview */}
          <div>
            <p className="text-[10px] uppercase tracking-widest font-bold text-muted-foreground/60 mb-2">Header</p>
            <div className="rounded-xl border border-border bg-muted/20 px-5 py-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                {state.custom_favicon_url ? (
                  <img
                    src={state.custom_favicon_url}
                    alt="Logo"
                    className="w-8 h-8 rounded-lg object-contain"
                    onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                  />
                ) : (
                  <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                    <Globe className="w-4 h-4 text-primary" />
                  </div>
                )}
                <span className="text-sm font-bold text-foreground">
                  {state.meta_title || previewName}
                </span>
              </div>
              <Badge variant="secondary" className="text-[10px]">
                {state.custom_email_domain || "yourdomain.com"}
              </Badge>
            </div>
          </div>

          {/* Footer preview — mirrors the resolved mode (including super-admin force) */}
          <div>
            <p className="text-[10px] uppercase tracking-widest font-bold text-muted-foreground/60 mb-2">Footer Preview</p>
            <div className="rounded-xl border border-border bg-muted/20 px-5 py-4 text-center space-y-1">
              <p className="text-xs text-muted-foreground">
                &copy; {new Date().getFullYear()} {previewName}. All rights reserved.
              </p>
              {(() => {
                // The super-admin force override always wins
                const effectiveMode = siteConfig.force_autocurb_attribution
                  ? "autocurb"
                  : state.powered_by_mode;
                if (effectiveMode === "autocurb") {
                  return (
                    <p className="text-[10px] text-muted-foreground/50">
                      Powered by Autocurb.ai
                    </p>
                  );
                }
                if (effectiveMode === "dealer") {
                  return (
                    <p className="text-[10px] text-muted-foreground/50">
                      Powered by {previewName}
                    </p>
                  );
                }
                return (
                  <Badge variant="outline" className="text-[9px] text-emerald-600 dark:text-emerald-400 border-emerald-500/30">
                    Attribution hidden
                  </Badge>
                );
              })()}
            </div>
          </div>
        </div>
      </PremiumCard>

      {/* ── Save ── */}
      <div className="flex justify-end pt-2">
        <Button onClick={handleSave} disabled={saving} className="gap-1.5 px-6">
          {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
          Save White Label Settings
        </Button>
      </div>
    </div>
  );
};

export default WhiteLabelSettings;
