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
import { Copy, Check, Code2, ExternalLink, Monitor, MapPin } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface DealerLocation {
  id: string;
  name: string;
  city: string;
  state: string;
}

const EmbedToolkit = () => {
  const { config } = useSiteConfig();
  const { tenant } = useTenant();
  const { toast } = useToast();
  const [copied, setCopied] = useState<string | null>(null);
  const [buttonText, setButtonText] = useState("Get Your Trade-In Value");
  const [buttonColor, setButtonColor] = useState(`hsl(${config.primary_color})`);
  const [targetPage, setTargetPage] = useState("/trade");
  const [widgetPosition, setWidgetPosition] = useState("bottom-right");
  const [locations, setLocations] = useState<DealerLocation[]>([]);
  const [selectedLocationId, setSelectedLocationId] = useState<string>("__all__");

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

  // Build URL with optional store param
  const buildUrl = (path: string, extraParams: string[] = []) => {
    const params = [...extraParams];
    if (selectedLocationId && selectedLocationId !== "__all__") params.push(`store=${selectedLocationId}`);
    const qs = params.length > 0 ? `?${params.join("&")}` : "";
    return `${baseUrl}${path}${qs}`;
  };

  const copy = (code: string, key: string) => {
    navigator.clipboard.writeText(code);
    setCopied(key);
    toast({ title: "Copied to clipboard" });
    setTimeout(() => setCopied(null), 2000);
  };

  const selectedLocLabel = locations.find(l => l.id === selectedLocationId);

  // ── 1. Simple Button Snippet ──
  const buttonSnippet = `<!-- ${config.dealership_name}${selectedLocLabel ? ` — ${selectedLocLabel.name}` : ''} - Trade-In Button -->
<a href="${buildUrl(targetPage)}" target="_blank" rel="noopener"
   style="display:inline-block;padding:14px 28px;background:${buttonColor};color:#fff;font-family:system-ui,sans-serif;font-size:16px;font-weight:700;border-radius:8px;text-decoration:none;text-align:center;cursor:pointer;transition:opacity .2s"
   onmouseover="this.style.opacity='0.9'" onmouseout="this.style.opacity='1'">
  ${buttonText}
</a>`;

  // ── 2. Floating Widget ──
  const widgetSnippet = `<!-- ${config.dealership_name}${selectedLocLabel ? ` — ${selectedLocLabel.name}` : ''} - Floating Trade Widget -->
<script>
(function(){
  var cfg = {
    url: "${buildUrl(targetPage)}",
    text: "${buttonText}",
    color: "${buttonColor}",
    position: "${widgetPosition}",
    dealership: "${config.dealership_name}"
  };
  var s = document.createElement("script");
  s.src = "${baseUrl}/embed.js";
  s.async = true;
  s.onload = function(){ if(window.AutoCurbWidget) window.AutoCurbWidget.init(cfg); };
  document.body.appendChild(s);
})();
</script>`;

  // ── 3. iFrame Embed ──
  const iframeSnippet = `<!-- ${config.dealership_name}${selectedLocLabel ? ` — ${selectedLocLabel.name}` : ''} - Embedded Trade Form -->
<iframe
  src="${buildUrl(targetPage, ["embed=true"])}"
  style="width:100%;min-height:800px;border:none;border-radius:12px"
  title="Trade-In Your Vehicle - ${config.dealership_name}"
  loading="lazy"
  allow="camera"
></iframe>`;

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

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-card-foreground">Website Embed Toolkit</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Generate code snippets your web provider can add to the dealership website. Customers can click to submit trade-ins directly.
        </p>
      </div>

      {/* Customization */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Customize</CardTitle>
          <CardDescription>Configure the button appearance before copying the code.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="space-y-1.5">
              <Label className="text-xs">Button Text</Label>
              <Input value={buttonText} onChange={(e) => setButtonText(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Button Color</Label>
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
              <Label className="text-xs">Landing Page</Label>
              <Select value={targetPage} onValueChange={setTargetPage}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="/">Homepage (Sell)</SelectItem>
                  <SelectItem value="/trade">Trade-In</SelectItem>
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

          {/* Store Location Selector */}
          {locations.length > 1 && (
            <div className="mt-4 p-3 bg-muted/30 rounded-lg border border-border space-y-2">
              <div className="flex items-center gap-2">
                <MapPin className="w-4 h-4 text-primary" />
                <Label className="text-xs font-semibold">Assign to Store Location</Label>
              </div>
              <p className="text-[11px] text-muted-foreground">
                Select which store this embed is for. Leads will be automatically assigned to this location and customers will be locked to this store for scheduling.
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
              {selectedLocationId && (
                <p className="text-[11px] text-primary font-medium">
                  ✓ Leads from this embed will be tagged to {selectedLocLabel?.name} — no store selection shown to customers.
                </p>
              )}
            </div>
          )}

          {/* Live Preview */}
          <div className="mt-4 p-4 bg-muted/30 rounded-lg border border-border">
            <Label className="text-xs text-muted-foreground mb-2 block">Preview</Label>
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

      {/* Code Tabs */}
      <Tabs defaultValue="button" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="button" className="gap-1.5 text-xs">
            <ExternalLink className="w-3.5 h-3.5" /> Link Button
          </TabsTrigger>
          <TabsTrigger value="widget" className="gap-1.5 text-xs">
            <Code2 className="w-3.5 h-3.5" /> Floating Widget
          </TabsTrigger>
          <TabsTrigger value="iframe" className="gap-1.5 text-xs">
            <Monitor className="w-3.5 h-3.5" /> iFrame Embed
          </TabsTrigger>
        </TabsList>

        <TabsContent value="button" className="mt-4 space-y-3">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Simple Link Button</CardTitle>
              <CardDescription>
                A styled HTML link that opens your trade-in page. Paste it anywhere on your website — banners, sidebars, vehicle detail pages, etc.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <CodeBlock code={buttonSnippet} id="button" />
              <p className="text-xs text-muted-foreground mt-3">
                <strong>Best for:</strong> Adding a CTA button to existing pages. Zero JavaScript, works everywhere.
              </p>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="widget" className="mt-4 space-y-3">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Floating Widget</CardTitle>
              <CardDescription>
                A small script that adds a floating "Trade In" button to every page. Always visible as customers browse.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <CodeBlock code={widgetSnippet} id="widget" />
              <p className="text-xs text-muted-foreground mt-3">
                <strong>Best for:</strong> Site-wide visibility. Add it once to the footer template and it appears on every page.
              </p>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="iframe" className="mt-4 space-y-3">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Inline iFrame</CardTitle>
              <CardDescription>
                Embed the full trade-in form directly inside a page on your website. Customers never leave your site.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <CodeBlock code={iframeSnippet} id="iframe" />
              <p className="text-xs text-muted-foreground mt-3">
                <strong>Best for:</strong> Dedicated "Trade In" or "Sell My Car" pages. Seamless experience with no redirects.
              </p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Instructions for Web Provider */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Instructions for Your Web Provider</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground space-y-2">
          <p>Share any of the code snippets above with your web developer or website provider. Here's what they need to know:</p>
          <ul className="list-disc pl-5 space-y-1">
            <li><strong>Link Button:</strong> Paste the HTML wherever you want a trade-in CTA — vehicle pages, homepage banners, service pages.</li>
            <li><strong>Floating Widget:</strong> Add the script tag just before the closing <code className="bg-muted px-1 rounded text-xs">&lt;/body&gt;</code> tag in your site's footer template.</li>
            <li><strong>iFrame:</strong> Create a new page (e.g. <code className="bg-muted px-1 rounded text-xs">/trade-in</code>) and paste the iframe code in the page body.</li>
            {selectedLocationId && (
              <li><strong>Store Tag:</strong> This snippet includes a <code className="bg-muted px-1 rounded text-xs">store={selectedLocationId.slice(0, 8)}…</code> parameter that auto-assigns leads to <strong>{selectedLocLabel?.name}</strong>. Generate separate snippets for each store's website.</li>
            )}
          </ul>
          <p className="pt-2">All options are fully branded with your dealership's colors and information. No additional setup is needed.</p>
        </CardContent>
      </Card>
    </div>
  );
};

export default EmbedToolkit;
