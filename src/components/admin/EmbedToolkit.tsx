import { useState, useEffect } from "react";
import { useSiteConfig } from "@/hooks/useSiteConfig";
import { useTenant } from "@/contexts/TenantContext";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Copy, Check, Code2, ExternalLink, Monitor, MapPin, PanelRightOpen, LayoutList, Lightbulb, MousePointerClick, Award, Info, Eye, EyeOff, Layout, Sparkles } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
import { LANDING_TEMPLATES, type LandingTemplate } from "@/hooks/useSiteConfig";
import TemplateThumbnail from "@/components/landing/TemplateThumbnail";
import LivePreview from "./embed/LivePreview";
import InstallSnippet from "./embed/InstallSnippet";

interface DealerLocation {
  id: string;
  name: string;
  city: string;
  state: string;
}

const CTA_PRESETS = [
  "Get Your Trade-In Value",
  "What's Your Car Worth?",
  "Top Dollar for Your Trade",
  "Value My Trade in 2 Min",
  "Get Trade Value Now",
  "See What Your Car Is Worth",
  "Instant Trade Appraisal",
  "Sell or Trade Your Car",
];

const VDP_CTA_PRESETS = [
  "Have a Trade-In?",
  "Get Top Dollar for Your Trade",
  "What's Your Current Car Worth?",
  "Trade Up — Get Your Value",
  "Upgrade Your Ride — See Your Trade Value",
];

const EmbedToolkit = ({ embedded = false }: { embedded?: boolean } = {}) => {
  const { config } = useSiteConfig();
  // Escalation controls — local state mirrors site_config so toggles
  // feel responsive while the write is in flight. We persist on
  // change rather than batching behind a save button (matches the
  // pattern in LandingFlowConfig).
  const [escalationEnabled, setEscalationEnabled] = useState<boolean>(config.embed_escalation_enabled);
  const [escalationMaxTier, setEscalationMaxTier] = useState<0 | 1 | 2 | 3>(
    config.embed_escalation_max_tier as 0 | 1 | 2 | 3,
  );
  const [escalationSaving, setEscalationSaving] = useState(false);
  useEffect(() => {
    setEscalationEnabled(config.embed_escalation_enabled);
    setEscalationMaxTier(config.embed_escalation_max_tier as 0 | 1 | 2 | 3);
  }, [config.embed_escalation_enabled, config.embed_escalation_max_tier]);

  const persistEscalation = async (
    next: { embed_escalation_enabled?: boolean; embed_escalation_max_tier?: number },
  ) => {
    setEscalationSaving(true);
    try {
      const { error } = await supabase
        .from("site_config" as never)
        .update(next as never)
        .eq("dealership_id", tenant.dealership_id);
      if (error) {
        // PGRST204 / schema-cache misses mean the migration hasn't
        // been applied yet on this environment. Surface a useful
        // toast instead of failing silently.
        toast({
          title: "Couldn't save",
          description: error.message.includes("schema cache")
            ? "Pending migration — apply 20260506120000_embed_attribution_and_analytics.sql."
            : error.message,
          variant: "destructive",
        });
      }
    } finally {
      setEscalationSaving(false);
    }
  };
  const { tenant } = useTenant();
  const { toast } = useToast();
  const [copied, setCopied] = useState<string | null>(null);
  const [buttonText, setButtonText] = useState("Get Your Trade-In Value");
  const [buttonColor, setButtonColor] = useState(`hsl(${config.primary_color})`);
  const [targetPage, setTargetPage] = useState("/trade-in");
  const [widgetPosition, setWidgetPosition] = useState("bottom-right");
  const [openMode, setOpenMode] = useState("drawer");
  const [locations, setLocations] = useState<DealerLocation[]>([]);
  const [selectedLocationId, setSelectedLocationId] = useState<string>("__all__");
  // "__default__" = use whatever the dealer set as landing_template in Landing & Flow.
  // Any other value forces that specific template for embeds landing on "/".
  const [embedTemplate, setEmbedTemplate] = useState<LandingTemplate | "__default__">("__default__");

  // VDP/SRP Banner options
  const [bannerHeadline, setBannerHeadline] = useState("Have a Trade-In?");
  const [bannerText, setBannerText] = useState("What's your current car worth? Get your trade-in value instantly.");
  const [bannerCtaText, setBannerCtaText] = useState("Get Trade Value");

  // Sticky ghost link options
  const [stickyText, setStickyText] = useState("Get your trade-in value");
  const [stickyCtaText, setStickyCtaText] = useState("See Value");
  const [stickyPosition, setStickyPosition] = useState("bottom");

  // Push/Pull/Tow options
  const pptEnabled = config.ppt_enabled;
  const pptAmount = config.ppt_guarantee_amount || 3000;
  const [pptButtonText, setPptButtonText] = useState(`Get Your $${pptAmount.toLocaleString()} Trade Certificate`);

  useEffect(() => {
    supabase
      .from("dealership_locations")
      .select("id, name, city, state")
      .eq("dealership_id", tenant.dealership_id)
      .eq("is_active", true)
      .order("sort_order")
      .then(({ data }) => {
        if (data) setLocations(data as DealerLocation[]);
      });
  }, [tenant.dealership_id]);

  const baseUrl = window.location.origin;

  // Build URL with optional store + landing-template params.
  // template= only piggybacks on "/" embeds (the homepage landing). Other
  // paths like /trade-in have their own iframe-optimized layout and ignore it.
  const buildUrl = (path: string, extraParams: string[] = []) => {
    const params = [...extraParams];
    if (selectedLocationId && selectedLocationId !== "__all__") params.push(`store=${selectedLocationId}`);
    if (path === "/" && embedTemplate !== "__default__") params.push(`template=${embedTemplate}`);
    const qs = params.length > 0 ? `?${params.join("&")}` : "";
    return `${baseUrl}${path}${qs}`;
  };

  const storeParam = selectedLocationId && selectedLocationId !== "__all__"
    ? `store: "${selectedLocationId}",`
    : "";

  const copy = (code: string, key: string) => {
    navigator.clipboard.writeText(code);
    setCopied(key);
    toast({ title: "Copied to clipboard" });
    setTimeout(() => setCopied(null), 2000);
  };

  const selectedLocLabel = locations.find(l => l.id === selectedLocationId);

  // ── Snippet: Simple Button ──
  const buttonSnippet = `<!-- ${config.dealership_name}${selectedLocLabel ? ` — ${selectedLocLabel.name}` : ''} - Trade-In Button -->
<a href="${buildUrl(targetPage)}" target="_blank" rel="noopener"
   style="display:inline-block;padding:14px 28px;background:${buttonColor};color:#fff;font-family:system-ui,sans-serif;font-size:16px;font-weight:700;border-radius:8px;text-decoration:none;text-align:center;cursor:pointer;transition:opacity .2s"
   onmouseover="this.style.opacity='0.9'" onmouseout="this.style.opacity='1'">
  ${buttonText}
</a>`;

  // ── Snippet: Floating Widget (v2 with drawer) ──
  const widgetSnippet = `<!-- ${config.dealership_name}${selectedLocLabel ? ` — ${selectedLocLabel.name}` : ''} - Floating Trade Widget -->
<script>
(function(){
  var s = document.createElement("script");
  s.src = "${baseUrl}/embed.js";
  s.async = true;
  s.onload = function(){
    HarteCash.init({
      baseUrl: "${baseUrl}",
      text: "${buttonText}",
      color: "${buttonColor}",
      position: "${widgetPosition}",
      openMode: "${openMode}",
      mode: "trade",
      ${storeParam}
      drawerTitle: "${buttonText}"
    });
  };
  document.body.appendChild(s);
})();
</script>`;

  // ── Snippet: Homepage Iframe (honors the template picker above) ──
  const homepageTemplateLabel =
    embedTemplate === "__default__"
      ? `Dealer default${config.landing_template ? ` (${config.landing_template})` : ""}`
      : embedTemplate;
  const homepageIframeSnippet = `<!-- ${config.dealership_name}${selectedLocLabel ? ` — ${selectedLocLabel.name}` : ''} - Homepage Landing (${homepageTemplateLabel}) -->
<iframe
  id="hartecash-home"
  src="${buildUrl("/")}"
  style="width:100%;min-height:900px;border:none;border-radius:12px"
  title="Sell Your Car - ${config.dealership_name}"
  loading="lazy"
  allow="camera"
></iframe>
<script>
window.addEventListener("message", function(e) {
  if (e.data && e.data.type === "hartecash-resize") {
    var iframe = document.getElementById("hartecash-home");
    if (iframe) iframe.style.height = e.data.height + "px";
  }
});
</script>`;

  // ── Snippet: Trade Iframe ──
  const iframeSnippet = `<!-- ${config.dealership_name}${selectedLocLabel ? ` — ${selectedLocLabel.name}` : ''} - Trade-In Form (Full Page Embed) -->
<iframe
  id="hartecash-trade"
  src="${buildUrl("/trade-in", ["mode=trade"])}"
  style="width:100%;min-height:700px;border:none;border-radius:12px"
  title="Get Your Trade-In Value - ${config.dealership_name}"
  loading="lazy"
  allow="camera"
></iframe>
<script>
// Auto-resize iframe to fit content
window.addEventListener("message", function(e) {
  if (e.data && e.data.type === "hartecash-resize") {
    var iframe = document.getElementById("hartecash-trade");
    if (iframe) iframe.style.height = e.data.height + "px";
  }
});
</script>`;

  // ── Snippet: VDP/SRP Banner ──
  const vdpBannerSnippet = `<!-- ${config.dealership_name}${selectedLocLabel ? ` — ${selectedLocLabel.name}` : ''} - VDP/SRP Trade Banner -->
<div id="hartecash-banner"></div>
<script>
(function(){
  var s = document.createElement("script");
  s.src = "${baseUrl}/embed.js";
  s.async = true;
  s.onload = function(){
    HarteCash.banner({
      baseUrl: "${baseUrl}",
      targetId: "hartecash-banner",
      headline: "${bannerHeadline}",
      text: "${bannerText}",
      ctaText: "${bannerCtaText}",
      color: "${buttonColor}",
      openMode: "${openMode}",
      mode: "trade",
      ${storeParam}
      drawerTitle: "${bannerCtaText}"
    });
  };
  document.body.appendChild(s);
})();
</script>`;

  // ── Snippet: VDP/SRP Sticky Ghost Link ──
  const stickySnippet = `<!-- ${config.dealership_name}${selectedLocLabel ? ` — ${selectedLocLabel.name}` : ''} - Sticky Trade Link (VDP/SRP) -->
<script>
(function(){
  var s = document.createElement("script");
  s.src = "${baseUrl}/embed.js";
  s.async = true;
  s.onload = function(){
    HarteCash.sticky({
      baseUrl: "${baseUrl}",
      text: "${stickyText}",
      ctaText: "${stickyCtaText}",
      color: "${buttonColor}",
      position: "${stickyPosition}",
      openMode: "${openMode}",
      mode: "trade",
      ${storeParam}
      drawerTitle: "${stickyCtaText}"
    });
  };
  document.body.appendChild(s);
})();
</script>`;

  // ── Snippet: Inventory-Aware Floating Widget (v3) ──
  // The state-aware re-engagement widget. Detects the inventory
  // vehicle on VDPs (schema.org JSON-LD → OG meta) and reshapes
  // its copy around the customer's submission state. Persists the
  // resume token in localStorage so a returning visitor sees
  // "Apply your $X toward this vehicle" on a VDP and "Increase
  // your $X trade offer" everywhere else.
  // Bake the dealer's escalation prefs into the snippet so the
  // loader doesn't need a config-fetch round-trip on every page.
  // Re-pasting after a toggle change is the documented update path.
  const escalationSnippetLines = [
    `escalationEnabled: ${escalationEnabled ? "true" : "false"}`,
    `escalationMaxTier: ${escalationMaxTier}`,
  ];
  const inventoryFloatingSnippet = `<!-- ${config.dealership_name}${selectedLocLabel ? ` — ${selectedLocLabel.name}` : ''} - Inventory-Aware Trade Widget -->
<script>
(function(){
  var s = document.createElement("script");
  s.src = "${baseUrl}/embed.js";
  s.async = true;
  s.onload = function(){
    HarteCash.inventory({
      dealerId: "${tenant.dealership_id}",
      host: "${baseUrl}",
      displayMode: "floating",
      color: "${buttonColor}",
      position: "${widgetPosition}",
      ${escalationSnippetLines.join(",\n      ")},${embedTemplate !== "__default__" ? `\n      template: "${embedTemplate}",` : ""}${storeParam ? `\n      ${storeParam}` : ""}
    });
  };
  document.body.appendChild(s);
})();
</script>`;

  // ── Snippet: Inventory-Aware Inline Banner (v3) ──
  // Same engine as the floating widget but mounted inline in a
  // dealer-chosen container (e.g. on the VDP between gallery and
  // specs). Auto-resizes via postMessage as the customer moves
  // through the flow.
  const inventoryInlineSnippet = `<!-- ${config.dealership_name}${selectedLocLabel ? ` — ${selectedLocLabel.name}` : ''} - Inventory-Aware Inline Embed -->
<div id="hartecash-inventory"></div>
<script>
(function(){
  var s = document.createElement("script");
  s.src = "${baseUrl}/embed.js";
  s.async = true;
  s.onload = function(){
    HarteCash.inventory({
      dealerId: "${tenant.dealership_id}",
      host: "${baseUrl}",
      displayMode: "inline",
      target: "#hartecash-inventory",
      color: "${buttonColor}",
      ${escalationSnippetLines.join(",\n      ")},${embedTemplate !== "__default__" ? `\n      template: "${embedTemplate}",` : ""}${storeParam ? `\n      ${storeParam}` : ""}
    });
  };
  document.body.appendChild(s);
})();
</script>`;

  // ── Snippet: Push/Pull/Tow Floating Widget ──
  const pptWidgetSnippet = `<!-- ${config.dealership_name}${selectedLocLabel ? ` — ${selectedLocLabel.name}` : ''} - Push/Pull/Tow Certificate Widget -->
<script>
(function(){
  var s = document.createElement("script");
  s.src = "${baseUrl}/embed.js";
  s.async = true;
  s.onload = function(){
    HarteCash.init({
      baseUrl: "${baseUrl}",
      text: "${pptButtonText}",
      color: "#d97706",
      position: "${widgetPosition}",
      openMode: "drawer",
      ppt: true,
      amount: ${pptAmount},
      ${storeParam}
      drawerTitle: "${pptButtonText}"
    });
  };
  document.body.appendChild(s);
})();
</script>`;

  // ── Snippet: Push/Pull/Tow iFrame ──
  const pptIframeSnippet = `<!-- ${config.dealership_name}${selectedLocLabel ? ` — ${selectedLocLabel.name}` : ''} - Push/Pull/Tow Certificate Form -->
<iframe
  id="hartecash-ppt"
  src="${buildUrl("/push-pull-tow", [`amount=${pptAmount}`])}"
  style="width:100%;min-height:700px;border:none;border-radius:12px"
  title="$${pptAmount.toLocaleString()} Minimum Trade Guarantee - ${config.dealership_name}"
  loading="lazy"
  allow="camera"
></iframe>
<script>
window.addEventListener("message", function(e) {
  if (e.data && e.data.type === "hartecash-resize") {
    var iframe = document.getElementById("hartecash-ppt");
    if (iframe) iframe.style.height = e.data.height + "px";
  }
});
</script>`;

  // Preview state
  const [previewOpen, setPreviewOpen] = useState<string | null>(null);
  const togglePreview = (id: string) => setPreviewOpen(previewOpen === id ? null : id);

  const CopyRow = ({
    state,
    onVdp,
    offVdp,
    accent = false,
  }: {
    state: string;
    onVdp: string;
    offVdp: string;
    accent?: boolean;
  }) => (
    <div className={`grid grid-cols-3 gap-3 px-4 py-2.5 ${accent ? "bg-emerald-50/40" : ""}`}>
      <div className="text-muted-foreground">{state}</div>
      <div className={accent ? "font-semibold text-success" : "text-card-foreground"}>{onVdp}</div>
      <div className={accent ? "font-semibold text-success" : "text-card-foreground"}>{offVdp}</div>
    </div>
  );

  const CodeBlock = ({ code, id }: { code: string; id: string }) => (
    <div className="relative">
      <pre className="bg-muted/50 border border-border rounded-lg p-4 text-xs overflow-x-auto whitespace-pre-wrap font-mono text-foreground/80 max-h-64">
        {code}
      </pre>
      <Button
        size="sm"
        variant="outline"
        className="absolute top-2 right-2 h-8 gap-1.5"
        onClick={() => copy(code, id)}
      >
        {copied === id ? <Check className="w-3.5 h-3.5 text-success" /> : <Copy className="w-3.5 h-3.5" />}
        {copied === id ? "Copied" : "Copy"}
      </Button>
    </div>
  );

  const PreviewToggle = ({ id, label }: { id: string; label: string }) => (
    <Button
      size="sm"
      variant={previewOpen === id ? "default" : "outline"}
      className="gap-1.5 text-xs"
      onClick={() => togglePreview(id)}
    >
      {previewOpen === id ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
      {previewOpen === id ? "Hide Preview" : label}
    </Button>
  );

  const IframePreview = ({ src, id, height = "500px" }: { src: string; id: string; height?: string }) => (
    previewOpen === id ? (
      <div className="rounded-xl border-2 border-primary/30 overflow-hidden bg-white dark:bg-background shadow-lg">
        <div className="flex items-center gap-2 px-3 py-2 bg-muted/50 border-b border-border">
          <div className="flex gap-1.5">
            <div className="w-2.5 h-2.5 rounded-full bg-red-400" />
            <div className="w-2.5 h-2.5 rounded-full bg-yellow-400" />
            <div className="w-2.5 h-2.5 rounded-full bg-green-400" />
          </div>
          <span className="text-micro text-muted-foreground font-mono truncate flex-1">{src}</span>
        </div>
        <iframe
          src={src}
          style={{ width: "100%", height, border: "none" }}
          title="Preview"
          loading="lazy"
          allow="camera"
        />
      </div>
    ) : null
  );

  return (
    <div className="space-y-6">
      {!embedded && (
      <div>
        <h2 className="text-lg font-semibold text-card-foreground">Website Integration Toolkit</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Embed Autocurb.io into the dealership website to convert existing traffic into trade-in leads. Customers never leave the dealer site.
        </p>
      </div>
      )}

      {/* Strategy Card */}
      <Card className="border-primary/20 bg-primary/5">
        <CardContent className="pt-5">
          <div className="flex gap-3">
            <Lightbulb className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
            <div className="space-y-2 text-sm">
              <p className="font-semibold text-card-foreground">Integration Strategy</p>
              <ul className="text-muted-foreground space-y-1.5 text-xs leading-relaxed">
                <li><strong>Trade Page Replacement:</strong> Use the <em>Trade iFrame</em> to replace the dealer's existing "Value Your Trade" page. It looks built-in with no headers or footers.</li>
                <li><strong>Site-Wide Floating Button:</strong> Add the <em>Floating Widget</em> to the site footer — it appears on every page and opens a slide-out panel.</li>
                <li><strong>Ghost Link on VDP/SRP:</strong> The <em>Ghost Link</em> follows the customer as they scroll vehicle pages — a subtle, persistent CTA that opens the trade panel.</li>
                <li><strong>VDP &amp; SRP Banners:</strong> Place the <em>Inventory Banner</em> on vehicle detail and search results pages for a more prominent inline CTA.</li>
                {pptEnabled && (
                  <li><strong>Push/Pull/Tow Certificate:</strong> If you offer a minimum trade guarantee, add the <em>PPT Certificate</em> page or widget. Customers enter their car and get a guaranteed minimum certificate.</li>
                )}
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ── Global Customization ── */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Customize</CardTitle>
          <CardDescription>Configure appearance and behavior for all embed types.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <div className="space-y-1.5">
              <Label className="text-xs">Button / CTA Text</Label>
              <Input value={buttonText} onChange={(e) => setButtonText(e.target.value)} />
              <div className="flex flex-wrap gap-1 mt-1.5">
                {CTA_PRESETS.slice(0, 4).map((preset) => (
                  <Badge
                    key={preset}
                    variant="outline"
                    className="text-micro cursor-pointer hover:bg-primary/10 transition-colors"
                    onClick={() => setButtonText(preset)}
                  >
                    {preset}
                  </Badge>
                ))}
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Brand Color</Label>
              <div className="flex gap-2">
                <input
                  type="color"
                  value={buttonColor}
                  onChange={(e) => setButtonColor(e.target.value)}
                  className="w-10 h-9 rounded border border-border cursor-pointer"
                />
                <Input value={buttonColor} onChange={(e) => setButtonColor(e.target.value)} className="flex-1" />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Click Behavior</Label>
              <Select value={openMode} onValueChange={setOpenMode}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="drawer">Slide-Out Panel (stays on page)</SelectItem>
                  <SelectItem value="new-tab">Open in New Tab</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label className="text-xs">Landing Page</Label>
              <Select value={targetPage} onValueChange={setTargetPage}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="/trade-in">Trade-In (iframe-optimized)</SelectItem>
                  <SelectItem value="/trade">Trade-In (full page)</SelectItem>
                  <SelectItem value="/">Homepage (Sell)</SelectItem>
                  <SelectItem value="/service">Service</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Widget Position</Label>
              <Select value={widgetPosition} onValueChange={setWidgetPosition}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="bottom-right">Bottom Right</SelectItem>
                  <SelectItem value="bottom-left">Bottom Left</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Homepage template override — only relevant for "/" embeds */}
          <div className="p-3 bg-muted/30 rounded-lg border border-border space-y-2.5">
            <div className="flex items-center gap-2">
              <Layout className="w-4 h-4 text-primary" />
              <Label className="text-xs font-semibold">Homepage Template</Label>
            </div>
            <p className="text-[11px] text-muted-foreground">
              Picks which landing-page layout loads for embeds that hit{" "}
              <code className="bg-muted px-1 rounded">/</code>. Ignored for /trade-in, /service, and
              Push/Pull/Tow embeds — those have their own layouts.
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => setEmbedTemplate("__default__")}
                className={`text-left rounded-lg border-2 p-2 transition-all ${
                  embedTemplate === "__default__"
                    ? "border-primary bg-primary/5"
                    : "border-border bg-background hover:border-primary/30"
                }`}
              >
                <div className="aspect-[16/10] mb-1.5 rounded overflow-hidden border border-dashed border-border bg-muted/40 flex items-center justify-center">
                  <span className="text-micro font-semibold text-muted-foreground uppercase tracking-wider">
                    Inherits
                  </span>
                </div>
                <div className="font-semibold text-xs">Dealer Default</div>
                <div className="text-micro text-muted-foreground mt-0.5 line-clamp-2">
                  Use whatever is set in Landing &amp; Flow.
                </div>
              </button>
              {LANDING_TEMPLATES.map((t) => {
                const active = embedTemplate === t.value;
                return (
                  <button
                    key={t.value}
                    type="button"
                    onClick={() => setEmbedTemplate(t.value)}
                    className={`text-left rounded-lg border-2 p-2 transition-all ${
                      active
                        ? "border-primary bg-primary/5"
                        : "border-border bg-background hover:border-primary/30"
                    }`}
                  >
                    <div className="aspect-[16/10] mb-1.5 rounded overflow-hidden border border-border/60">
                      <TemplateThumbnail template={t.value} />
                    </div>
                    <div className="font-semibold text-xs">{t.label}</div>
                    <div className="text-micro text-muted-foreground mt-0.5 line-clamp-2">
                      {t.description}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Store Location Selector */}
          {locations.length > 1 && (
            <div className="p-3 bg-muted/30 rounded-lg border border-border space-y-2">
              <div className="flex items-center gap-2">
                <MapPin className="w-4 h-4 text-primary" />
                <Label className="text-xs font-semibold">Assign to Store Location</Label>
              </div>
              <p className="text-[11px] text-muted-foreground">
                Select which store this embed is for. Leads will be automatically assigned to this location.
              </p>
              <Select value={selectedLocationId} onValueChange={setSelectedLocationId}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="All locations (auto-assign by ZIP)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all__">All locations (auto-assign)</SelectItem>
                  {locations.map((loc) => (
                    <SelectItem key={loc.id} value={loc.id}>
                      {loc.name} — {loc.city}, {loc.state}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {selectedLocationId && selectedLocationId !== "__all__" && (
                <p className="text-[11px] text-primary font-medium">
                  Leads from this embed will be tagged to {selectedLocLabel?.name} — generate separate snippets for each store.
                </p>
              )}
            </div>
          )}

          {/* Live Preview */}
          <div className="p-4 bg-muted/30 rounded-lg border border-border">
            <Label className="text-xs text-muted-foreground mb-2 block">Button Preview</Label>
            <a
              href="#"
              onClick={(e) => e.preventDefault()}
              style={{
                display: "inline-block",
                padding: "14px 28px",
                background: buttonColor,
                color: "#fff",
                fontFamily: "system-ui, sans-serif",
                fontSize: "16px",
                fontWeight: 700,
                borderRadius: "8px",
                textDecoration: "none",
                cursor: "pointer",
              }}
            >
              {buttonText}
            </a>
          </div>
        </CardContent>
      </Card>

      {/* ── Iframe Content & Offer Flow ── */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Iframe Display Settings</CardTitle>
          <CardDescription>
            Customize the content shown on embedded iframe pages, and control when the offer is displayed relative to customer info capture.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Trade iframe content */}
          <div className="space-y-3">
            <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Trade-In iFrame Content</Label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Headline</Label>
                <Input
                  value={config.trade_iframe_headline || ""}
                  placeholder="What's Your Trade Worth?"
                  readOnly
                  className="bg-muted/30"
                />
                <p className="text-micro text-muted-foreground">Edit in Branding → Hero Content section</p>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Subtext</Label>
                <Input
                  value={config.trade_iframe_subtext || ""}
                  placeholder="Get your trade-in value in under 2 minutes..."
                  readOnly
                  className="bg-muted/30"
                />
                <p className="text-micro text-muted-foreground">Edit in Branding → Hero Content section</p>
              </div>
            </div>
          </div>

          {/* PPT content (if enabled) */}
          {pptEnabled && (
            <div className="space-y-3 pt-2 border-t border-border">
              <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Push/Pull/Tow Certificate Content</Label>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs">Guarantee Amount</Label>
                  <div className="flex items-center gap-1 text-sm font-bold text-warning">${pptAmount.toLocaleString()}</div>
                  <p className="text-micro text-muted-foreground">Configured in Branding settings</p>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Headline</Label>
                  <Input
                    value={config.ppt_headline || ""}
                    placeholder={`$${pptAmount.toLocaleString()} Minimum Trade Guarantee`}
                    readOnly
                    className="bg-muted/30"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Subtext</Label>
                  <Input
                    value={config.ppt_subtext || ""}
                    placeholder="Push it, pull it, or tow it..."
                    readOnly
                    className="bg-muted/30"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Offer flow reference */}
          <div className="pt-2 border-t border-border">
            <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/30 border border-border">
              <Info className="w-4 h-4 text-primary flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-xs font-semibold text-card-foreground">Offer Flow: Show Offer Before or After Contact Info?</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Control whether customers see their offer before or after entering their name/phone/email.
                  This is configured in <strong>Configuration → Lead Form → Offer-First Flow</strong> toggle.
                  The same setting applies to all iframe integrations including trade-in and Push/Pull/Tow.
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ── Code Snippets ── */}
      <Tabs defaultValue="inventory" className="w-full">
        <TabsList className={`flex h-auto w-full flex-wrap gap-1 md:grid md:h-10 ${pptEnabled ? "md:grid-cols-10" : "md:grid-cols-9"}`}>
          <TabsTrigger value="inventory" className="gap-1.5 text-xs">
            <Sparkles className="w-3.5 h-3.5" /> Inventory-Aware
          </TabsTrigger>
          <TabsTrigger value="iframe" className="gap-1.5 text-xs">
            <Monitor className="w-3.5 h-3.5" /> Trade iFrame
          </TabsTrigger>
          <TabsTrigger value="homepage" className="gap-1.5 text-xs">
            <Layout className="w-3.5 h-3.5" /> Homepage
          </TabsTrigger>
          <TabsTrigger value="widget" className="gap-1.5 text-xs">
            <PanelRightOpen className="w-3.5 h-3.5" /> Floating Widget
          </TabsTrigger>
          <TabsTrigger value="sticky" className="gap-1.5 text-xs">
            <MousePointerClick className="w-3.5 h-3.5" /> Ghost Link
          </TabsTrigger>
          <TabsTrigger value="vdp" className="gap-1.5 text-xs">
            <LayoutList className="w-3.5 h-3.5" /> Banner
          </TabsTrigger>
          {pptEnabled && (
            <TabsTrigger value="ppt" className="gap-1.5 text-xs">
              <Award className="w-3.5 h-3.5" /> Push/Pull/Tow
            </TabsTrigger>
          )}
          <TabsTrigger value="button" className="gap-1.5 text-xs">
            <ExternalLink className="w-3.5 h-3.5" /> Button
          </TabsTrigger>
          <TabsTrigger value="livepreview" className="gap-1.5 text-xs">
            <Eye className="w-3.5 h-3.5" /> Live Preview
          </TabsTrigger>
          <TabsTrigger value="install" className="gap-1.5 text-xs">
            <Code2 className="w-3.5 h-3.5" /> Install
          </TabsTrigger>
        </TabsList>

        {/* Inventory-Aware Embed (v3) — state-aware re-engagement */}
        <TabsContent value="inventory" className="mt-4 space-y-3">
          <Card>
            <CardHeader className="pb-2">
              <div className="flex items-center gap-2">
                <CardTitle className="text-base">Inventory-Aware Trade Widget</CardTitle>
                <Badge className="text-micro bg-success hover:bg-success">New</Badge>
                <Badge variant="secondary" className="text-micro">State-Aware</Badge>
              </div>
              <CardDescription>
                One snippet, every page. Detects the vehicle the customer is viewing on the dealer's
                inventory pages and reframes the embed as <em>"apply your trade toward this car"</em>{" "}
                — using trade value with state tax credit, not the cash equivalent. Recognizes
                returning customers via localStorage so a visitor with an offer sees{" "}
                <strong>"Apply your $X toward this vehicle"</strong> on a VDP and{" "}
                <strong>"Increase your $X trade offer"</strong> elsewhere.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              {/* State-aware copy preview matrix */}
              <div className="rounded-xl border border-border overflow-hidden">
                <div className="bg-muted/40 px-4 py-2 border-b border-border">
                  <Label className="text-xs font-semibold text-card-foreground">
                    How the floating button copy adapts
                  </Label>
                </div>
                <div className="divide-y divide-border text-xs">
                  <div className="grid grid-cols-3 gap-3 px-4 py-2.5 bg-muted/20 font-semibold text-card-foreground">
                    <div>Customer state</div>
                    <div>On a VDP</div>
                    <div>Anywhere else</div>
                  </div>
                  <CopyRow
                    state="First-time visitor"
                    onVdp="Get your trade-in value"
                    offVdp="Get your trade-in value"
                  />
                  <CopyRow state="In progress" onVdp="Resume your trade-in" offVdp="Resume your trade-in" />
                  <CopyRow
                    state="Has an offer"
                    onVdp="Apply your $X toward this Civic"
                    offVdp="Increase your $X trade offer"
                    accent
                  />
                  <CopyRow state="Deal accepted" onVdp="View your accepted offer" offVdp="View your accepted offer" />
                </div>
              </div>

              {/* Live performance summary — aggregates embed_events
                  for the last 30 days. Surfaces top-of-funnel
                  metrics so the dealer can validate the widget is
                  firing on their site without leaving the admin. */}
              <EmbedPerformanceCard dealershipId={tenant.dealership_id} />

              {/* Escalation controls */}
              <div className="rounded-xl border border-border bg-muted/20 p-4 space-y-3">
                <div className="flex items-center justify-between gap-4">
                  <div className="space-y-0.5">
                    <Label className="text-sm font-semibold">Time-decay escalation</Label>
                    <p className="text-xs text-muted-foreground">
                      Reshape the floating widget across visits when an offer goes stale. Off ={" "}
                      ambient pill only — no pulse, no toast, no auto-open.
                    </p>
                  </div>
                  <Switch
                    checked={escalationEnabled}
                    disabled={escalationSaving}
                    onCheckedChange={(v) => {
                      setEscalationEnabled(v);
                      persistEscalation({ embed_escalation_enabled: v });
                    }}
                  />
                </div>
                {escalationEnabled && (
                  <div className="flex items-center justify-between gap-4 pt-2 border-t border-border/60">
                    <div className="space-y-0.5">
                      <Label className="text-xs font-semibold">Maximum tier</Label>
                      <p className="text-[11px] text-muted-foreground">
                        Caps how aggressive escalation gets. Recommend 3 for mainstream brands; 1 or
                        2 for luxury / high-end where Day 7 auto-open feels intrusive.
                      </p>
                    </div>
                    <Select
                      value={String(escalationMaxTier)}
                      disabled={escalationSaving}
                      onValueChange={(v) => {
                        const next = Number(v) as 0 | 1 | 2 | 3;
                        setEscalationMaxTier(next);
                        persistEscalation({ embed_escalation_max_tier: next });
                      }}
                    >
                      <SelectTrigger className="w-[200px]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="1">Tier 1 — Pulse only</SelectItem>
                        <SelectItem value="2">Tier 2 — Pulse + toast</SelectItem>
                        <SelectItem value="3">Tier 3 — Full (auto-open)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </div>

              {/* Floating mode snippet */}
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <PanelRightOpen className="w-4 h-4 text-muted-foreground" />
                  <Label className="text-sm font-semibold">Floating mode (recommended)</Label>
                </div>
                <p className="text-xs text-muted-foreground">
                  One snippet for the dealer's site-wide template / footer. Pill button bottom-{widgetPosition === "bottom-left" ? "left" : "right"}, opens an overlay
                  iframe when tapped. Auto-detects vehicles on VDPs.
                </p>
                <CodeBlock code={inventoryFloatingSnippet} id="inventory-floating" />
              </div>

              {/* Inline mode snippet */}
              <div className="space-y-2 pt-2 border-t border-border">
                <div className="flex items-center gap-2">
                  <LayoutList className="w-4 h-4 text-muted-foreground" />
                  <Label className="text-sm font-semibold">Inline mode</Label>
                </div>
                <p className="text-xs text-muted-foreground">
                  Drop the embed straight into a page (e.g. between gallery and specs on a VDP). Same
                  inventory detection + state awareness as floating, just no pill button.
                </p>
                <CodeBlock code={inventoryInlineSnippet} id="inventory-inline" />
              </div>

              <div className="bg-muted/30 rounded-lg border border-border p-3 space-y-2">
                <p className="text-xs font-semibold text-card-foreground">How it works:</p>
                <ol className="text-xs text-muted-foreground space-y-1 list-decimal pl-4">
                  <li>
                    Drop one snippet into the dealer's global template (header / footer). Works on
                    every page — homepage, SRP, VDP, content pages.
                  </li>
                  <li>
                    On VDPs the loader reads schema.org <code className="bg-muted px-1 rounded">Vehicle</code> JSON-LD
                    (or OG meta as fallback) and forwards <code className="bg-muted px-1 rounded">vehicle_label</code> +{" "}
                    <code className="bg-muted px-1 rounded">vehicle_msrp</code> into the iframe.
                  </li>
                  <li>
                    The embed banner shows the customer's <strong>trade value with state tax credit</strong> —
                    the actual amount applied against the inventory vehicle, not the base cash offer.
                  </li>
                  <li>
                    Resume token + offer + status are persisted in <code className="bg-muted px-1 rounded">localStorage</code>{" "}
                    on the dealer domain, so a returning customer sees the right CTA without re-entering anything.
                  </li>
                </ol>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Trade iFrame */}
        <TabsContent value="iframe" className="mt-4 space-y-3">
          <Card>
            <CardHeader className="pb-2">
              <div className="flex items-center gap-2">
                <CardTitle className="text-base">Trade-In Page iFrame</CardTitle>
                <Badge variant="secondary" className="text-micro">Recommended</Badge>
              </div>
              <CardDescription>
                Replace the dealer's "Value Your Trade" page with this iframe. No header or footer — it looks like a native part of the dealer's website. The form defaults to trade-in value with tax savings.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <PreviewToggle id="iframe-preview" label="Preview Trade iFrame" />
              <IframePreview src={buildUrl("/trade-in", ["mode=trade"])} id="iframe-preview" height="600px" />
              <CodeBlock code={iframeSnippet} id="iframe" />
              <div className="bg-muted/30 rounded-lg border border-border p-3 space-y-2">
                <p className="text-xs font-semibold text-card-foreground">How to install:</p>
                <ol className="text-xs text-muted-foreground space-y-1 list-decimal pl-4">
                  <li>Ask the web provider to create a page at <code className="bg-muted px-1 rounded">/value-your-trade</code> (or replace the existing trade page).</li>
                  <li>Paste this code into the page body. Remove any existing trade tools (KBB, TradePending, etc.).</li>
                  <li>The iframe auto-resizes to fit the form — no scrollbars needed.</li>
                  <li>Update the dealer site's "Trade Your Car" navigation link to point to this page.</li>
                </ol>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Homepage iFrame — lets the dealer embed the full landing flow with a chosen template */}
        <TabsContent value="homepage" className="mt-4 space-y-3">
          <Card>
            <CardHeader className="pb-2">
              <div className="flex items-center gap-2">
                <CardTitle className="text-base">Homepage Landing iFrame</CardTitle>
                <Badge variant="secondary" className="text-micro">
                  {embedTemplate === "__default__" ? "Dealer Default" : LANDING_TEMPLATES.find(t => t.value === embedTemplate)?.label}
                </Badge>
              </div>
              <CardDescription>
                Embed the full sell-your-car landing flow on the dealer's website. Pick any of the
                five templates above to override the dealer's default — or leave it on "Dealer
                Default" to inherit whatever is set in Landing &amp; Flow.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <PreviewToggle id="homepage-preview" label="Preview Homepage" />
              <IframePreview src={buildUrl("/")} id="homepage-preview" height="700px" />
              <CodeBlock code={homepageIframeSnippet} id="homepage" />
              <div className="bg-muted/30 rounded-lg border border-border p-3 space-y-2">
                <p className="text-xs font-semibold text-card-foreground">How to install:</p>
                <ol className="text-xs text-muted-foreground space-y-1 list-decimal pl-4">
                  <li>Create a page on the dealer site — e.g. <code className="bg-muted px-1 rounded">/sell-your-car</code>.</li>
                  <li>Paste this iframe into the page body.</li>
                  <li>The template override travels in the URL (<code className="bg-muted px-1 rounded">?template=…</code>) so different stores can embed different layouts on different pages.</li>
                  <li>To change the template later, come back here, pick a different one, and re-paste the snippet.</li>
                </ol>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Floating Widget */}
        <TabsContent value="widget" className="mt-4 space-y-3">
          <Card>
            <CardHeader className="pb-2">
              <div className="flex items-center gap-2">
                <CardTitle className="text-base">Floating Widget</CardTitle>
                <Badge variant="secondary" className="text-micro">Site-Wide</Badge>
              </div>
              <CardDescription>
                A floating button on every page. {openMode === "drawer" ? "Clicking opens a slide-out panel with the trade form — customers never leave the page." : "Clicking opens the trade form in a new tab."}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Floating widget visual mockup */}
              <div className="rounded-xl border border-border overflow-hidden">
                <Label className="text-xs text-muted-foreground px-3 pt-2 block">Preview — how it appears on the dealer's site</Label>
                <div className="relative bg-gradient-to-b from-muted/30 to-muted/60 p-8 min-h-[140px]">
                  <div className="text-center text-xs text-muted-foreground/40 mb-4">[ Dealer website content ]</div>
                  {/* Simulated floating button */}
                  <div
                    className={`absolute bottom-4 ${widgetPosition === "bottom-right" ? "right-4" : "left-4"} flex items-center gap-2 px-5 py-3 text-white text-sm font-bold rounded-full shadow-lg cursor-default`}
                    style={{ background: buttonColor }}
                  >
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 17h2c.6 0 1-.4 1-1v-3c0-.9-.7-1.7-1.5-1.9C18.7 10.6 16 10 16 10s-1.3-1.4-2.2-2.3c-.5-.4-1.1-.7-1.8-.7H5c-.6 0-1.1.4-1.4.9l-1.4 2.9A3.7 3.7 0 0 0 2 12v4c0 .6.4 1 1 1h2"></path><circle cx="7" cy="17" r="2"></circle><path d="M9 17h6"></path><circle cx="17" cy="17" r="2"></circle></svg>
                    {buttonText}
                  </div>
                </div>
              </div>
              <CodeBlock code={widgetSnippet} id="widget" />
              <div className="bg-muted/30 rounded-lg border border-border p-3">
                <p className="text-xs font-semibold text-card-foreground mb-1">How to install:</p>
                <p className="text-xs text-muted-foreground">
                  Add this script just before the closing <code className="bg-muted px-1 rounded">&lt;/body&gt;</code> tag in the dealer site's footer template. It will appear on every page automatically.
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Sticky Ghost Link */}
        <TabsContent value="sticky" className="mt-4 space-y-3">
          <Card>
            <CardHeader className="pb-2">
              <div className="flex items-center gap-2">
                <CardTitle className="text-base">Sticky Ghost Link</CardTitle>
                <Badge variant="secondary" className="text-micro">VDP / SRP</Badge>
              </div>
              <CardDescription>
                A thin, semi-transparent bar that follows the customer as they scroll VDP and SRP pages. Appears after a short scroll to avoid feeling pushy — then stays visible until they engage or dismiss.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Ghost link customization */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs">Message Text</Label>
                  <Input value={stickyText} onChange={(e) => setStickyText(e.target.value)} />
                  <div className="flex flex-wrap gap-1 mt-1">
                    {["Get your trade-in value", "Top dollar for your trade", "What's your car worth?"].map((preset) => (
                      <Badge
                        key={preset}
                        variant="outline"
                        className="text-micro cursor-pointer hover:bg-primary/10 transition-colors"
                        onClick={() => setStickyText(preset)}
                      >
                        {preset}
                      </Badge>
                    ))}
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Button Text</Label>
                  <Input value={stickyCtaText} onChange={(e) => setStickyCtaText(e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Position</Label>
                  <Select value={stickyPosition} onValueChange={setStickyPosition}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="bottom">Bottom of screen</SelectItem>
                      <SelectItem value="top">Top of screen</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Sticky Preview — shown in context of a fake dealer VDP */}
              <div className="rounded-xl border border-border overflow-hidden">
                <Label className="text-xs text-muted-foreground px-3 pt-2 block">Preview — how it appears on a vehicle detail page</Label>
                <div className="relative bg-gradient-to-b from-muted/20 to-muted/50" style={{ minHeight: 220 }}>
                  {/* Fake VDP content */}
                  <div className="p-4 space-y-2">
                    <div className="h-24 bg-muted/40 rounded-lg flex items-center justify-center text-xs text-muted-foreground/30">[ Vehicle Photo Gallery ]</div>
                    <div className="flex gap-3">
                      <div className="flex-1 space-y-1.5">
                        <div className="h-3 w-3/4 bg-muted/40 rounded" />
                        <div className="h-2 w-1/2 bg-muted/30 rounded" />
                        <div className="h-2 w-2/3 bg-muted/30 rounded" />
                      </div>
                      <div className="w-24 h-12 bg-muted/40 rounded flex items-center justify-center text-[9px] text-muted-foreground/30">Price</div>
                    </div>
                  </div>
                  {/* Ghost link bar */}
                  <div
                    style={{
                      position: "absolute",
                      left: 0,
                      right: 0,
                      ...(stickyPosition === "bottom" ? { bottom: 0 } : { top: 0 }),
                      background: buttonColor,
                      opacity: 0.94,
                    }}
                  >
                    <div
                      className="flex items-center justify-center gap-2.5 py-2.5 px-4 text-white"
                    >
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 17h2c.6 0 1-.4 1-1v-3c0-.9-.7-1.7-1.5-1.9C18.7 10.6 16 10 16 10s-1.3-1.4-2.2-2.3c-.5-.4-1.1-.7-1.8-.7H5c-.6 0-1.1.4-1.4.9l-1.4 2.9A3.7 3.7 0 0 0 2 12v4c0 .6.4 1 1 1h2"></path><circle cx="7" cy="17" r="2"></circle><path d="M9 17h6"></path><circle cx="17" cy="17" r="2"></circle></svg>
                      <span className="text-sm font-semibold">{stickyText}</span>
                      <span className="text-xs font-bold px-3 py-1 rounded-full" style={{ background: "rgba(255,255,255,0.2)", border: "1px solid rgba(255,255,255,0.3)" }}>{stickyCtaText}</span>
                    </div>
                  </div>
                </div>
              </div>

              <CodeBlock code={stickySnippet} id="sticky" />
              <div className="bg-muted/30 rounded-lg border border-border p-3 space-y-2">
                <p className="text-xs font-semibold text-card-foreground">How to install:</p>
                <ol className="text-xs text-muted-foreground space-y-1 list-decimal pl-4">
                  <li>Add this script to the dealer site's VDP and SRP page templates (before <code className="bg-muted px-1 rounded">&lt;/body&gt;</code>).</li>
                  <li>The bar appears after the customer scrolls 200px or after 5 seconds — whichever comes first.</li>
                  <li>Customers can dismiss it (remembered per session). It doesn't reappear until the next visit.</li>
                  <li>Clicking opens the {openMode === "drawer" ? "slide-out trade panel" : "trade page in a new tab"}.</li>
                </ol>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* VDP/SRP Banner */}
        <TabsContent value="vdp" className="mt-4 space-y-3">
          <Card>
            <CardHeader className="pb-2">
              <div className="flex items-center gap-2">
                <CardTitle className="text-base">Inventory Page Banner</CardTitle>
                <Badge variant="secondary" className="text-micro">VDP / SRP</Badge>
              </div>
              <CardDescription>
                An inline banner for vehicle detail pages (VDP) and search results pages (SRP). Catches the customer while they're already shopping.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Banner customization */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs">Banner Headline</Label>
                  <Input value={bannerHeadline} onChange={(e) => setBannerHeadline(e.target.value)} />
                  <div className="flex flex-wrap gap-1 mt-1">
                    {VDP_CTA_PRESETS.slice(0, 3).map((preset) => (
                      <Badge
                        key={preset}
                        variant="outline"
                        className="text-micro cursor-pointer hover:bg-primary/10 transition-colors"
                        onClick={() => setBannerHeadline(preset)}
                      >
                        {preset}
                      </Badge>
                    ))}
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Description</Label>
                  <Input value={bannerText} onChange={(e) => setBannerText(e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Button Text</Label>
                  <Input value={bannerCtaText} onChange={(e) => setBannerCtaText(e.target.value)} />
                </div>
              </div>

              {/* Banner Preview */}
              <div className="rounded-lg border border-border overflow-hidden">
                <Label className="text-xs text-muted-foreground px-3 pt-2 block">Preview</Label>
                <div className="p-3">
                  <div
                    className="flex items-center gap-4 p-4 text-white rounded-xl flex-wrap"
                    style={{ background: buttonColor }}
                  >
                    <div className="flex-shrink-0 opacity-90">
                      <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M19 17h2c.6 0 1-.4 1-1v-3c0-.9-.7-1.7-1.5-1.9C18.7 10.6 16 10 16 10s-1.3-1.4-2.2-2.3c-.5-.4-1.1-.7-1.8-.7H5c-.6 0-1.1.4-1.4.9l-1.4 2.9A3.7 3.7 0 0 0 2 12v4c0 .6.4 1 1 1h2"></path><circle cx="7" cy="17" r="2"></circle><path d="M9 17h6"></path><circle cx="17" cy="17" r="2"></circle></svg>
                    </div>
                    <div className="flex-1 min-w-[200px]">
                      <strong className="block text-sm font-bold mb-0.5">{bannerHeadline}</strong>
                      <span className="text-xs opacity-90">{bannerText}</span>
                    </div>
                    <button
                      className="inline-flex items-center gap-1.5 px-5 py-2.5 bg-white font-bold text-sm rounded-lg shadow-md cursor-pointer"
                      style={{ color: buttonColor }}
                      onClick={(e) => e.preventDefault()}
                    >
                      {bannerCtaText}
                    </button>
                  </div>
                </div>
              </div>

              <CodeBlock code={vdpBannerSnippet} id="vdp" />
              <div className="bg-muted/30 rounded-lg border border-border p-3 space-y-2">
                <p className="text-xs font-semibold text-card-foreground">How to install:</p>
                <ol className="text-xs text-muted-foreground space-y-1 list-decimal pl-4">
                  <li>Add <code className="bg-muted px-1 rounded">&lt;div id="hartecash-banner"&gt;&lt;/div&gt;</code> where you want the banner to appear on VDP and SRP pages.</li>
                  <li>Common locations: below the vehicle price, above vehicle specs, or between photo gallery and details.</li>
                  <li>The banner renders inside the div — it inherits the page's column width automatically.</li>
                </ol>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Push/Pull/Tow */}
        {pptEnabled && (
          <TabsContent value="ppt" className="mt-4 space-y-3">
            <Card>
              <CardHeader className="pb-2">
                <div className="flex items-center gap-2">
                  <CardTitle className="text-base">Push/Pull/Tow Certificate</CardTitle>
                  <Badge className="text-micro bg-amber-100 text-amber-800 border-amber-200">Guarantee</Badge>
                </div>
                <CardDescription>
                  Offer customers a guaranteed ${pptAmount.toLocaleString()} minimum trade-in value. If the market offer is higher, they get the higher amount. Embed as an iframe page replacement or use the floating widget.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* PPT CTA customization */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs">Widget Button Text</Label>
                    <Input value={pptButtonText} onChange={(e) => setPptButtonText(e.target.value)} />
                    <div className="flex flex-wrap gap-1 mt-1">
                      {[
                        `Get Your $${pptAmount.toLocaleString()} Trade Certificate`,
                        "Push Pull or Tow — Get Certificate",
                        `$${pptAmount.toLocaleString()} Minimum Trade Guarantee`,
                        "Get Your Guaranteed Trade Value",
                      ].map((preset) => (
                        <Badge
                          key={preset}
                          variant="outline"
                          className="text-micro cursor-pointer hover:bg-amber-50 transition-colors"
                          onClick={() => setPptButtonText(preset)}
                        >
                          {preset}
                        </Badge>
                      ))}
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Guarantee Amount</Label>
                    <div className="p-2 rounded-lg bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800">
                      <p className="text-lg font-extrabold text-warning dark:text-amber-400">${pptAmount.toLocaleString()}</p>
                      <p className="text-micro text-muted-foreground">Configured in Branding settings (ppt_guarantee_amount)</p>
                    </div>
                  </div>
                </div>

                {/* Preview */}
                <PreviewToggle id="ppt-preview" label="Preview Push/Pull/Tow Page" />
                <IframePreview src={buildUrl("/push-pull-tow", [`amount=${pptAmount}`])} id="ppt-preview" height="550px" />

                {/* Two options: iframe or widget */}
                <div className="space-y-3">
                  <div>
                    <Label className="text-xs font-semibold text-card-foreground mb-2 block">Option 1: Full Page iFrame</Label>
                    <p className="text-xs text-muted-foreground mb-2">
                      Replace or create a "Push Pull Tow" page on the dealer site. The iframe shows the guarantee banner, vehicle form, and certificate.
                    </p>
                    <CodeBlock code={pptIframeSnippet} id="ppt-iframe" />
                  </div>
                  <div className="pt-3 border-t border-border">
                    <Label className="text-xs font-semibold text-card-foreground mb-2 block">Option 2: Floating Widget</Label>
                    <p className="text-xs text-muted-foreground mb-2">
                      Add a floating button to every page. Clicking opens a slide-out panel with the Push/Pull/Tow certificate form.
                    </p>
                    <CodeBlock code={pptWidgetSnippet} id="ppt-widget" />
                  </div>
                </div>

                <div className="bg-muted/30 rounded-lg border border-border p-3 space-y-2">
                  <p className="text-xs font-semibold text-card-foreground">How it works for the customer:</p>
                  <ol className="text-xs text-muted-foreground space-y-1 list-decimal pl-4">
                    <li>Customer clicks "Get Your Push/Pull/Tow Certificate" on the dealer site.</li>
                    <li>They enter their vehicle (VIN, license plate, or Year/Make/Model).</li>
                    <li>If the market value is higher than ${pptAmount.toLocaleString()}, they get the higher offer.</li>
                    <li>If the market value is lower, the ${pptAmount.toLocaleString()} guarantee applies toward their next vehicle purchase.</li>
                    <li>Certificate is generated and emailed — drives the customer to the showroom.</li>
                  </ol>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        )}

        {/* Simple Link Button */}
        <TabsContent value="button" className="mt-4 space-y-3">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Simple Link Button</CardTitle>
              <CardDescription>
                A styled HTML link that opens the trade-in page. Paste it anywhere — banners, sidebars, vehicle pages, homepage, service pages.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Button Preview */}
              <div className="rounded-lg border border-border overflow-hidden">
                <Label className="text-xs text-muted-foreground px-3 pt-2 block">Preview</Label>
                <div className="p-4 bg-muted/20 flex justify-center">
                  <a
                    href="#"
                    onClick={(e) => e.preventDefault()}
                    style={{
                      display: "inline-block",
                      padding: "14px 28px",
                      background: buttonColor,
                      color: "#fff",
                      fontFamily: "system-ui, sans-serif",
                      fontSize: "16px",
                      fontWeight: 700,
                      borderRadius: "8px",
                      textDecoration: "none",
                      cursor: "pointer",
                    }}
                  >
                    {buttonText}
                  </a>
                </div>
              </div>
              <CodeBlock code={buttonSnippet} id="button" />
              <p className="text-xs text-muted-foreground mt-3">
                <strong>Best for:</strong> Quick CTA anywhere on the site. Zero JavaScript, works everywhere.
              </p>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Live Preview tab — sales-pitch demo on a dealer's actual site ── */}
        <TabsContent value="livepreview" className="mt-4">
          <LivePreview
            buttonColor={buttonColor}
            buttonText={buttonText}
            bannerHeadline={bannerHeadline}
            bannerText={bannerText}
            bannerCtaText={bannerCtaText}
            stickyText={stickyText}
            stickyCtaText={stickyCtaText}
            pptButtonText={pptButtonText}
            pptEnabled={pptEnabled}
            dealerDisplayName={tenant.display_name}
          />
        </TabsContent>

        <TabsContent value="install" className="mt-4">
          <InstallSnippet
            tenant={tenant}
            buttonColor={buttonColor}
            buttonText={buttonText}
            openMode={openMode}
            widgetPosition={widgetPosition}
            stickyText={stickyText}
            stickyCtaText={stickyCtaText}
            stickyPosition={stickyPosition}
            bannerHeadline={bannerHeadline}
            bannerText={bannerText}
            bannerCtaText={bannerCtaText}
            pptEnabled={pptEnabled}
            pptButtonText={pptButtonText}
          />
        </TabsContent>
      </Tabs>

      {/* Instructions for Web Provider */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Instructions for Your Web Provider</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground space-y-2">
          <p>Share any of the code snippets above with your web developer or website provider (DealerInspire, Dealer.com, etc.):</p>
          <ul className="list-disc pl-5 space-y-1">
            <li><strong>Trade iFrame (Priority 1):</strong> Replace the existing "Value Your Trade" page content. Remove KBB/TradePending/CARFAX widgets — Autocurb.io gives instant offers, not just estimates.</li>
            <li><strong>Floating Widget (Priority 2):</strong> Add to the site footer template — one snippet covers every page. The slide-out panel keeps customers on-site.</li>
            <li><strong>Ghost Link (Priority 3):</strong> A sticky bar that follows the customer on VDP/SRP pages — appears after scrolling. Non-intrusive but always present.</li>
            <li><strong>VDP/SRP Banner:</strong> An inline card for vehicle detail and search results templates. Good complement to the ghost link.</li>
            <li><strong>Link Button:</strong> Paste anywhere you want a one-off CTA.</li>
            {selectedLocationId && selectedLocationId !== "__all__" && (
              <li><strong>Store Tag:</strong> This snippet routes leads to <strong>{selectedLocLabel?.name}</strong>. Generate separate snippets for each store's website.</li>
            )}
          </ul>
          <p className="pt-2 text-xs">
            All integrations are fully branded with your dealership's colors. The trade form defaults to showing trade-in value with sales tax credit — customers see what their car is worth as a trade, not just a cash sale.
          </p>
        </CardContent>
      </Card>
    </div>
  );
};

/**
 * Embed performance summary — aggregates the last 30 days of
 * embed_events for the dealership. Five top-of-funnel counters:
 *   - Widget loads     (every page render that mounts the widget)
 *   - Vehicles detected (VDP attribution coverage)
 *   - Pill clicks      (engagement)
 *   - Overlays opened  (conversion intent)
 *   - State changes    (offers + acceptances broadcast back)
 *
 * Reads through Postgres RLS — only events for this rooftop are
 * visible to the dealer's admin user. Refreshes on mount and
 * exposes a manual refresh button so the dealer can verify a new
 * install fires events without waiting for a hard reload.
 */
const EmbedPerformanceCard = ({ dealershipId }: { dealershipId: string }) => {
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    const { data, error: queryError } = await supabase
      .from("embed_events" as never)
      .select("event_type")
      .eq("dealership_id", dealershipId)
      .gte("created_at", since);
    if (queryError) {
      // PGRST205 / "relation does not exist" means the migration
      // hasn't run yet. Surface a soft message instead of a red
      // toast so the rest of the embed UI stays usable.
      const msg = queryError.message.toLowerCase();
      if (msg.includes("does not exist") || msg.includes("schema cache")) {
        setError("Pending migration — apply 20260506120000_embed_attribution_and_analytics.sql.");
      } else {
        setError(queryError.message);
      }
      setLoading(false);
      return;
    }
    const tally: Record<string, number> = {};
    (data as Array<{ event_type: string }> | null)?.forEach((r) => {
      tally[r.event_type] = (tally[r.event_type] || 0) + 1;
    });
    setCounts(tally);
    setLoading(false);
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dealershipId]);

  const tiles: Array<{ key: string; label: string; sub?: string }> = [
    { key: "widget_loaded", label: "Widget loads", sub: "Page renders" },
    { key: "vehicle_detected", label: "Vehicles detected", sub: "VDPs covered" },
    { key: "pill_clicked", label: "Pill clicks", sub: "Engagement" },
    { key: "overlay_opened", label: "Overlays opened", sub: "Intent" },
    { key: "offer_made", label: "Offers made", sub: "Conversion" },
  ];

  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      <div className="flex items-center justify-between gap-3 px-4 py-3 border-b border-border bg-muted/20">
        <div>
          <Label className="text-sm font-semibold">Embed performance — last 30 days</Label>
          <p className="text-xs text-muted-foreground">
            Live counts from embed_events. Refresh after pasting the snippet into the dealer site to confirm install.
          </p>
        </div>
        <Button size="sm" variant="outline" onClick={load} disabled={loading}>
          {loading ? "Loading…" : "Refresh"}
        </Button>
      </div>
      {error ? (
        <div className="px-4 py-6 text-xs text-muted-foreground">{error}</div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-5 divide-x divide-y md:divide-y-0 divide-border">
          {tiles.map((t) => (
            <div key={t.key} className="px-4 py-3.5">
              <p className="text-micro font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                {t.label}
              </p>
              <p className="text-2xl font-bold tabular-nums tracking-tight text-card-foreground mt-0.5">
                {(counts[t.key] || 0).toLocaleString()}
              </p>
              {t.sub && <p className="text-micro text-muted-foreground">{t.sub}</p>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default EmbedToolkit;
