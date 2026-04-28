import { useState, useEffect, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import {
  Camera, Loader2, MousePointerClick, PanelRightOpen, LayoutList,
  MapPin, Lightbulb, Award, ExternalLink, AlertCircle, RefreshCw,
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
import {
  type PageType,
  type CaptureSet,
  type FailureSet,
  CAPTURE_COOLDOWN_MS,
  normalizeUrl,
  guessListingUrl,
  captureOne,
  readPersisted as readPersistedShared,
  writePersisted as writePersistedShared,
} from "@/lib/embedDemo";

/**
 * LivePreview — sales-pitch demo for the dealer who's currently logged in.
 *
 * Reads buttonColor / banner copy / sticky text etc. from the parent
 * EmbedToolkit so what shows in the demo matches what they configured in
 * the earlier customize tabs. Screenshot pipeline + URL helpers live in
 * src/lib/embedDemo.ts so the standalone Prospect Demo page (for pitching
 * non-customers) shares the exact same capture logic.
 */

const SESSION_KEY = "autocurb:embed-live-preview";

const readPersisted = <T,>(key: string, fallback: T): T =>
  readPersistedShared<T>(SESSION_KEY, key, fallback);
const writePersisted = (key: string, value: unknown) =>
  writePersistedShared(SESSION_KEY, key, value);

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

  // Capture form — hydrated from sessionStorage so the form survives
  // tab switches within the EmbedToolkit. State is per-session, not
  // permanent (full reload clears it).
  const [homeUrl, setHomeUrl] = useState<string>(() =>
    readPersisted("homeUrl", "https://harteinfiniti.com")
  );
  const [listingUrl, setListingUrl] = useState<string>(() =>
    readPersisted("listingUrl", "")
  );
  const [vdpUrl, setVdpUrl] = useState<string>(() => readPersisted("vdpUrl", ""));
  const [capturing, setCapturing] = useState(false);
  const [lastCapturedAt, setLastCapturedAt] = useState<number | null>(() =>
    readPersisted<number | null>("lastCapturedAt", null)
  );
  const [now, setNow] = useState(() => Date.now());
  const [captures, setCaptures] = useState<CaptureSet>(() =>
    readPersisted<CaptureSet>("captures", { home: null, listing: null, vdp: null })
  );
  const [failures, setFailures] = useState<FailureSet>({
    home: null,
    listing: null,
    vdp: null,
  });

  // Toggleable assets — persist across tab switches too.
  const [activeAssets, setActiveAssets] = useState<Set<AssetId>>(() => {
    const stored = readPersisted<AssetId[]>("activeAssets", ["iframe", "widget", "vdp"]);
    return new Set(stored);
  });

  // ── Persistence side-effects ──
  useEffect(() => writePersisted("homeUrl", homeUrl), [homeUrl]);
  useEffect(() => writePersisted("listingUrl", listingUrl), [listingUrl]);
  useEffect(() => writePersisted("vdpUrl", vdpUrl), [vdpUrl]);
  useEffect(() => writePersisted("captures", captures), [captures]);
  useEffect(() => writePersisted("lastCapturedAt", lastCapturedAt), [lastCapturedAt]);
  useEffect(
    () => writePersisted("activeAssets", Array.from(activeAssets)),
    [activeAssets]
  );

  // ── Auto-fill listing URL when homepage changes and listing is empty ──
  // Salespeople usually want a "good enough" guess so they can hit
  // Capture immediately. They can still override before hitting it.
  useEffect(() => {
    if (!listingUrl.trim() && homeUrl.trim()) {
      const guess = guessListingUrl(homeUrl);
      if (guess) setListingUrl(guess);
    }
    // Intentionally only react to homeUrl — we don't want to overwrite
    // the user's manual edits to the listing field.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [homeUrl]);

  // ── Cooldown ticker — re-render once a second while a cooldown is active ──
  // Avoids the user mashing Capture and burning quota.
  useEffect(() => {
    if (!lastCapturedAt) return;
    const remaining = lastCapturedAt + CAPTURE_COOLDOWN_MS - Date.now();
    if (remaining <= 0) return;
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [lastCapturedAt]);

  const cooldownRemainingMs = useMemo(() => {
    if (!lastCapturedAt) return 0;
    return Math.max(0, lastCapturedAt + CAPTURE_COOLDOWN_MS - now);
  }, [lastCapturedAt, now]);
  const inCooldown = cooldownRemainingMs > 0;

  const toggleAsset = (id: AssetId) => {
    setActiveAssets((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleCapture = async () => {
    if (inCooldown) return;
    if (!homeUrl.trim()) {
      toast({
        title: "Need a homepage URL",
        description: "Paste the dealer's homepage URL to start.",
        variant: "destructive",
      });
      return;
    }
    if (!normalizeUrl(homeUrl)) {
      toast({
        title: "Invalid homepage URL",
        description: "Use a real domain like harteinfiniti.com",
        variant: "destructive",
      });
      return;
    }
    setCapturing(true);
    setCaptures({ home: null, listing: null, vdp: null });
    setFailures({ home: null, listing: null, vdp: null });
    try {
      const [home, listing, vdp] = await Promise.all([
        captureOne(homeUrl),
        captureOne(listingUrl),
        captureOne(vdpUrl),
      ]);
      setCaptures({ home: home.url, listing: listing.url, vdp: vdp.url });
      setFailures({ home: home.error, listing: listing.error, vdp: vdp.error });
      const successCount = [home.url, listing.url, vdp.url].filter(Boolean).length;
      const rateLimited = [home, listing, vdp].some(
        (r) => r.error?.includes("rate limit"),
      );
      if (rateLimited) {
        toast({
          title: "Microlink rate limit hit",
          description: "Free tier is 50 captures/day per IP. Try again later or upgrade.",
          variant: "destructive",
        });
      } else if (successCount === 0) {
        toast({
          title: "All captures failed",
          description: "Check the URLs and try again — see the error panels below.",
          variant: "destructive",
        });
      } else {
        toast({
          title: `Captured ${successCount} ${successCount === 1 ? "page" : "pages"}`,
          description: "Toggle assets below to layer them on the screenshots.",
        });
      }
      setLastCapturedAt(Date.now());
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
  const hasAnyFailure = !!(failures.home || failures.listing || failures.vdp);

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
          <Button
            onClick={handleCapture}
            disabled={capturing || inCooldown}
            className="gap-1.5"
            title={inCooldown ? "Cooldown — protects the microlink quota" : undefined}
          >
            {capturing ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : inCooldown ? (
              <RefreshCw className="w-4 h-4" />
            ) : (
              <Camera className="w-4 h-4" />
            )}
            {capturing
              ? "Capturing…"
              : inCooldown
                ? `Wait ${Math.ceil(cooldownRemainingMs / 1000)}s`
                : "Capture screenshots"}
          </Button>
        </div>
      </div>

      {/* Asset toggle chips — show as soon as a successful capture exists */}
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

      {/* Three browser-frame cards. Each renders independently — a frame
          shows up if EITHER the capture succeeded OR the capture failed
          (so the salesperson can see "this URL didn't work" inline
          instead of staring at an empty space). */}
      {(hasAnyCapture || hasAnyFailure) && (
        <div className="space-y-5">
          {(captures.home || failures.home) && (
            <BrowserFrame label="Homepage" url={homeUrl}>
              {captures.home ? (
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
              ) : (
                <CaptureFailurePanel reason={failures.home!} url={homeUrl} />
              )}
            </BrowserFrame>
          )}

          {(captures.listing || failures.listing) && (
            <BrowserFrame label="Listing / Inventory Page" url={listingUrl}>
              {captures.listing ? (
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
              ) : (
                <CaptureFailurePanel reason={failures.listing!} url={listingUrl} />
              )}
            </BrowserFrame>
          )}

          {(captures.vdp || failures.vdp) && (
            <BrowserFrame label="VDP — Vehicle Detail Page" url={vdpUrl}>
              {captures.vdp ? (
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
              ) : (
                <CaptureFailurePanel reason={failures.vdp!} url={vdpUrl} />
              )}
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
}) => {
  // Three states: loading (default), loaded, errored. Critical for UX
  // because microlink can take 5–10s and a silent gray frame with
  // overlays floating over nothing reads as "broken." On error we keep
  // the area rendered + show the URL so the rep knows which page failed.
  const [status, setStatus] = useState<"loading" | "loaded" | "errored">(
    "loading",
  );

  useEffect(() => {
    setStatus("loading");
  }, [src]);

  return (
    <div
      className="relative bg-slate-100 overflow-hidden"
      style={{ aspectRatio: "1280 / 800" }}
    >
      {/* Loading skeleton — pulse + label so user knows it's working */}
      {status === "loading" && (
        <div className="absolute inset-0 flex flex-col items-center justify-center text-center bg-slate-100">
          <Loader2 className="w-8 h-8 text-slate-400 animate-spin mb-2" />
          <div className="text-xs text-slate-500 font-medium">
            Loading screenshot…
          </div>
          <div className="text-[10px] text-slate-400 mt-1 max-w-md truncate px-4">
            {src}
          </div>
        </div>
      )}

      {/* Error fallback — visible message with the URL that failed */}
      {status === "errored" && (
        <div className="absolute inset-0 flex flex-col items-center justify-center text-center bg-slate-50 p-6">
          <AlertCircle className="w-10 h-10 text-amber-500 mb-3" />
          <div className="text-sm font-bold text-slate-800">
            Screenshot didn't load
          </div>
          <div className="text-xs text-slate-600 mt-1 max-w-md">
            The image returned by microlink couldn't be displayed. The site
            may have a cert issue, blocked the capture, or hit microlink's
            free-tier rate limit.
          </div>
          <div className="text-[10px] font-mono text-slate-400 mt-3 max-w-md truncate px-4">
            {src}
          </div>
        </div>
      )}

      <img
        src={src}
        alt="Dealer site screenshot"
        className={`w-full h-full object-cover object-top transition-opacity ${
          status === "loaded" ? "opacity-100" : "opacity-0"
        }`}
        onLoad={() => setStatus("loaded")}
        onError={() => setStatus("errored")}
      />

      {/* Overlays render on top regardless of status so reps can see the
          intended mockup even while the screenshot is still loading. */}
      {children}
    </div>
  );
};

// ── Inline failure panel — replaces the screenshot when a capture errors ──
const CaptureFailurePanel = ({ reason, url }: { reason: string; url: string }) => (
  <div
    className="relative bg-slate-50 flex flex-col items-center justify-center text-center p-8"
    style={{ aspectRatio: "1280 / 800" }}
  >
    <AlertCircle className="w-10 h-10 text-amber-500 mb-3" />
    <div className="text-sm font-bold text-slate-800">Couldn't capture this page</div>
    <div className="text-xs text-slate-600 mt-1 max-w-md">{reason}</div>
    {url && (
      <div className="text-[11px] font-mono text-slate-400 mt-3 max-w-md truncate">{url}</div>
    )}
    <div className="text-[11px] text-slate-500 mt-4">
      Edit the URL above and click Capture again.
    </div>
  </div>
);

export default LivePreview;
