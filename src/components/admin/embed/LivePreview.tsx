import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import {
  Camera, Loader2, MousePointerClick, PanelRightOpen, LayoutList,
  MapPin, Lightbulb, Award, ExternalLink,
} from "lucide-react";
import {
  IframeModalOverlay,
  RightWidgetOverlay,
  VdpGhostOverlay,
  ListingGhostOverlay,
  HomepageBannerOverlay,
  StickyBarOverlay,
  ButtonCtaOverlay,
  PptOverlay,
} from "./AssetOverlays";

/**
 * LivePreview — sales-pitch demo generator.
 *
 * Salesperson enters a dealer's homepage / listing / VDP URL. We hit
 * microlink.io's free tier to capture screenshots, then layer the
 * Autocurb embed assets on top so the prospect sees what their site
 * would look like with each asset installed.
 *
 * Reads the dealer's customization (colors, copy) from the parent
 * EmbedToolkit so what shows in the demo matches what they configured
 * in the earlier tabs.
 *
 * v0.1: client-side fetch to https://api.microlink.io (free, 50/day,
 * no API key, supports CORS). v0.2 will route through a Supabase
 * edge function so we can persist screenshots + share demo URLs.
 */

type PageType = "home" | "listing" | "vdp";

interface CaptureSet {
  home: string | null;     // microlink screenshot URL
  listing: string | null;
  vdp: string | null;
}

const ASSETS = [
  { id: "iframe",   label: "Iframe Modal",     icon: PanelRightOpen, pages: ["home"] as PageType[] },
  { id: "homepage", label: "Hero Banner",      icon: Lightbulb,      pages: ["home"] as PageType[] },
  { id: "widget",   label: "Widget Tab",       icon: MousePointerClick, pages: ["home", "listing", "vdp"] as PageType[] },
  { id: "sticky",   label: "Sticky Bar",       icon: LayoutList,     pages: ["home", "listing", "vdp"] as PageType[] },
  { id: "vdp",      label: "VDP Ghost",        icon: MapPin,         pages: ["vdp"] as PageType[] },
  { id: "listing",  label: "Listing Ghost",    icon: LayoutList,     pages: ["listing"] as PageType[] },
  { id: "button",   label: "Button CTA",       icon: MousePointerClick, pages: ["home", "listing", "vdp"] as PageType[] },
  { id: "ppt",      label: "PPT Badge",        icon: Award,          pages: ["home", "vdp"] as PageType[] },
] as const;

type AssetId = typeof ASSETS[number]["id"];

interface Props {
  buttonColor: string;
  buttonText: string;
  bannerHeadline: string;
  bannerText: string;
  bannerCtaText: string;
  stickyText: string;
  stickyCtaText: string;
  pptButtonText: string;
  pptEnabled: boolean;
  dealerDisplayName?: string;
}

const LivePreview = ({
  buttonColor,
  buttonText,
  bannerHeadline,
  bannerText,
  bannerCtaText,
  stickyText,
  stickyCtaText,
  pptButtonText,
  pptEnabled,
  dealerDisplayName,
}: Props) => {
  const { toast } = useToast();

  // Capture form
  const [homeUrl, setHomeUrl] = useState("https://harteinfiniti.com");
  const [listingUrl, setListingUrl] = useState("");
  const [vdpUrl, setVdpUrl] = useState("");
  const [capturing, setCapturing] = useState(false);
  const [captures, setCaptures] = useState<CaptureSet>({
    home: null,
    listing: null,
    vdp: null,
  });

  // Toggleable assets
  const [activeAssets, setActiveAssets] = useState<Set<AssetId>>(new Set(["iframe", "widget", "vdp"]));

  const toggleAsset = (id: AssetId) => {
    setActiveAssets((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // Build microlink URL — viewport sized like a desktop, full-page capture.
  const buildMicrolinkUrl = (target: string) => {
    const params = new URLSearchParams({
      url: target,
      screenshot: "true",
      meta: "false",
      embed: "screenshot.url",
      "viewport.width": "1280",
      "viewport.height": "800",
      type: "png",
      waitUntil: "networkidle0",
    });
    return `https://api.microlink.io?${params.toString()}`;
  };

  const captureOne = async (target: string): Promise<string | null> => {
    if (!target.trim()) return null;
    let normalized = target.trim();
    if (!/^https?:\/\//i.test(normalized)) normalized = `https://${normalized}`;
    try {
      const res = await fetch(buildMicrolinkUrl(normalized), { redirect: "follow" });
      if (!res.ok) {
        // microlink redirects the embed=screenshot.url request to the PNG
        // directly — most browsers follow it transparently. If we got an
        // explicit JSON instead (free-tier rate-limit etc.), fall through.
        if (res.status === 429) {
          toast({
            title: "Rate limit hit",
            description: "microlink.io free tier is 50/day. Try again later or upgrade.",
            variant: "destructive",
          });
          return null;
        }
        throw new Error(`microlink ${res.status}`);
      }
      // The embed param makes microlink redirect to the screenshot URL
      // directly; res.url after redirect is the CDN URL we want.
      return res.url;
    } catch (e) {
      console.warn(`Capture failed for ${normalized}:`, e);
      return null;
    }
  };

  const handleCapture = async () => {
    if (!homeUrl.trim()) {
      toast({ title: "Need a homepage URL", description: "Paste the dealer's homepage URL to start.", variant: "destructive" });
      return;
    }
    setCapturing(true);
    setCaptures({ home: null, listing: null, vdp: null });
    try {
      const [home, listing, vdp] = await Promise.all([
        captureOne(homeUrl),
        captureOne(listingUrl),
        captureOne(vdpUrl),
      ]);
      setCaptures({ home, listing, vdp });
      const successCount = [home, listing, vdp].filter(Boolean).length;
      if (successCount === 0) {
        toast({ title: "All captures failed", description: "Check the URLs and try again.", variant: "destructive" });
      } else {
        toast({
          title: `Captured ${successCount} ${successCount === 1 ? "page" : "pages"}`,
          description: "Toggle assets below to layer them on the screenshots.",
        });
      }
    } finally {
      setCapturing(false);
    }
  };

  const commonOverlayProps = {
    buttonColor,
    buttonText,
    dealerName: dealerDisplayName,
  };

  // Filter the asset chips to only those that apply to at least one captured page.
  const visibleAssets = ASSETS.filter((a) => {
    if (a.id === "ppt" && !pptEnabled) return false;
    return a.pages.some((p) => captures[p]);
  });

  const hasAnyCapture = !!(captures.home || captures.listing || captures.vdp);

  return (
    <div className="space-y-5">
      {/* Header explainer */}
      <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 flex items-start gap-3">
        <Camera className="w-5 h-5 text-slate-500 shrink-0 mt-0.5" />
        <div className="text-sm text-slate-700 leading-relaxed">
          <strong>Live Preview</strong> — paste a prospect's homepage, listing, and VDP URLs. We'll screenshot each page
          and let you layer Autocurb's embed assets on top so the prospect can visualize the integration on their actual site.
          Powered by microlink.io (free, 50 captures/day).
        </div>
      </div>

      {/* Capture form */}
      <div className="rounded-lg border border-slate-200 bg-white p-4 space-y-3">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div>
            <Label className="text-xs font-semibold text-slate-700">Homepage URL *</Label>
            <Input
              value={homeUrl}
              onChange={(e) => setHomeUrl(e.target.value)}
              placeholder="harteinfiniti.com"
              className="mt-1"
            />
          </div>
          <div>
            <Label className="text-xs font-semibold text-slate-700">Listing / Inventory page</Label>
            <Input
              value={listingUrl}
              onChange={(e) => setListingUrl(e.target.value)}
              placeholder="harteinfiniti.com/used-vehicles"
              className="mt-1"
            />
          </div>
          <div>
            <Label className="text-xs font-semibold text-slate-700">VDP — sample vehicle</Label>
            <Input
              value={vdpUrl}
              onChange={(e) => setVdpUrl(e.target.value)}
              placeholder="harteinfiniti.com/used/2022-…"
              className="mt-1"
            />
          </div>
        </div>
        <div className="flex items-center justify-between pt-1">
          <p className="text-[11px] text-slate-500">
            Listing and VDP URLs are optional — leave blank if you only want the homepage demo.
          </p>
          <Button onClick={handleCapture} disabled={capturing} className="gap-1.5">
            {capturing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Camera className="w-4 h-4" />}
            {capturing ? "Capturing…" : "Capture screenshots"}
          </Button>
        </div>
      </div>

      {/* Asset toggle chips */}
      {hasAnyCapture && (
        <div className="rounded-lg border border-slate-200 bg-white p-4">
          <div className="text-[10px] font-bold uppercase tracking-[0.1em] text-slate-500 mb-2">
            Toggle assets to layer on the screenshots
          </div>
          <div className="flex flex-wrap gap-2">
            {visibleAssets.map((a) => {
              const Icon = a.icon;
              const active = activeAssets.has(a.id);
              return (
                <button
                  key={a.id}
                  onClick={() => toggleAsset(a.id)}
                  className={`inline-flex items-center gap-1.5 text-[11px] font-semibold px-3 py-1.5 rounded-full border transition ${
                    active
                      ? "bg-[#003b80] text-white border-[#003b80]"
                      : "bg-white text-slate-700 border-slate-200 hover:border-slate-400"
                  }`}
                >
                  <Icon className="w-3 h-3" />
                  {a.label}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Three browser-frame cards: Homepage, Listing, VDP */}
      {hasAnyCapture && (
        <div className="space-y-5">
          {captures.home && (
            <BrowserFrame label="Homepage" url={homeUrl}>
              <PageScreenshot src={captures.home}>
                {activeAssets.has("homepage") && <HomepageBannerOverlay {...commonOverlayProps} />}
                {activeAssets.has("widget") && <RightWidgetOverlay {...commonOverlayProps} />}
                {activeAssets.has("sticky") && (
                  <StickyBarOverlay {...commonOverlayProps} stickyText={stickyText} stickyCtaText={stickyCtaText} />
                )}
                {activeAssets.has("button") && <ButtonCtaOverlay {...commonOverlayProps} />}
                {activeAssets.has("ppt") && pptEnabled && (
                  <PptOverlay {...commonOverlayProps} pptButtonText={pptButtonText} />
                )}
                {/* Iframe modal renders LAST so it sits on top */}
                {activeAssets.has("iframe") && <IframeModalOverlay {...commonOverlayProps} />}
              </PageScreenshot>
            </BrowserFrame>
          )}

          {captures.listing && (
            <BrowserFrame label="Listing / Inventory Page" url={listingUrl}>
              <PageScreenshot src={captures.listing}>
                {activeAssets.has("listing") && (
                  <ListingGhostOverlay
                    {...commonOverlayProps}
                    bannerHeadline={bannerHeadline}
                    bannerCtaText={bannerCtaText}
                  />
                )}
                {activeAssets.has("widget") && <RightWidgetOverlay {...commonOverlayProps} />}
                {activeAssets.has("sticky") && (
                  <StickyBarOverlay {...commonOverlayProps} stickyText={stickyText} stickyCtaText={stickyCtaText} />
                )}
                {activeAssets.has("button") && <ButtonCtaOverlay {...commonOverlayProps} />}
              </PageScreenshot>
            </BrowserFrame>
          )}

          {captures.vdp && (
            <BrowserFrame label="VDP — Vehicle Detail Page" url={vdpUrl}>
              <PageScreenshot src={captures.vdp}>
                {activeAssets.has("vdp") && (
                  <VdpGhostOverlay
                    {...commonOverlayProps}
                    bannerHeadline={bannerHeadline}
                    bannerText={bannerText}
                    bannerCtaText={bannerCtaText}
                  />
                )}
                {activeAssets.has("widget") && <RightWidgetOverlay {...commonOverlayProps} />}
                {activeAssets.has("sticky") && (
                  <StickyBarOverlay {...commonOverlayProps} stickyText={stickyText} stickyCtaText={stickyCtaText} />
                )}
                {activeAssets.has("button") && <ButtonCtaOverlay {...commonOverlayProps} />}
                {activeAssets.has("ppt") && pptEnabled && (
                  <PptOverlay {...commonOverlayProps} pptButtonText={pptButtonText} />
                )}
              </PageScreenshot>
            </BrowserFrame>
          )}
        </div>
      )}
    </div>
  );
};

// ── Browser chrome wrapper for each captured page ─────────────────────
const BrowserFrame = ({
  label,
  url,
  children,
}: {
  label: string;
  url: string;
  children: React.ReactNode;
}) => (
  <div className="rounded-xl border border-slate-200 bg-white overflow-hidden shadow-sm">
    <div className="flex items-center justify-between px-3 py-2 bg-slate-50 border-b border-slate-200">
      <div className="flex items-center gap-2">
        <div className="flex gap-1.5">
          <div className="w-2.5 h-2.5 rounded-full bg-red-400" />
          <div className="w-2.5 h-2.5 rounded-full bg-amber-400" />
          <div className="w-2.5 h-2.5 rounded-full bg-emerald-400" />
        </div>
        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 ml-2">{label}</span>
      </div>
      <div className="flex-1 mx-4 flex items-center gap-1.5 bg-white border border-slate-200 rounded-md px-2 py-1 text-[11px] text-slate-600 truncate">
        <ExternalLink className="w-3 h-3 shrink-0 text-slate-400" />
        <span className="truncate">{url || "—"}</span>
      </div>
    </div>
    {children}
  </div>
);

// ── Screenshot viewport — overlays positioned absolutely inside ───────
const PageScreenshot = ({
  src,
  children,
}: {
  src: string;
  children?: React.ReactNode;
}) => (
  <div className="relative bg-slate-100" style={{ aspectRatio: "1280 / 800" }}>
    {/* eslint-disable-next-line jsx-a11y/img-redundant-alt */}
    <img
      src={src}
      alt="Dealer site screenshot"
      className="w-full h-full object-cover object-top"
      onError={(e) => {
        (e.currentTarget as HTMLImageElement).style.display = "none";
      }}
    />
    {children}
  </div>
);

export default LivePreview;
