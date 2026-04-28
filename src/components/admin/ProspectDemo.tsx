import { useState, useEffect, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import {
  Camera, Loader2, MousePointerClick, PanelRightOpen, LayoutList,
  MapPin, Lightbulb, Award, ExternalLink, AlertCircle, RefreshCw,
  Target, Sparkles,
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
} from "./embed/AssetOverlays";
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
import {
  type PaletteColor,
  type AttentionRecommendation,
  extractPalette,
  recommendAttentionColors,
} from "@/lib/colorAnalysis";
import { supabase } from "@/integrations/supabase/client";
import { Brain } from "lucide-react";

/**
 * ProspectDemo — standalone sales-pitch generator for Autocurb staff
 * pitching dealers who aren't customers yet.
 *
 * Differs from EmbedToolkit's Live Preview in three ways:
 *   1. No tenant context — sales reps configure the prospect's brand colors,
 *      copy, logo here in this page, not by being logged into their tenant.
 *   2. Internal-staff-only access — gated to platform admins so individual
 *      tenants can't accidentally pitch their own competitors.
 *   3. Becomes the home for AI-driven recommendations (Phase 2+),
 *      shareable demo URLs (Phase 5), and export-to-provider snippet
 *      (Phase 6) since prospects don't have an EmbedToolkit yet.
 *
 * Phase 1 scope: form + capture + overlay rendering. AI, before/after slider,
 * shareable URL, ROI overlay, and snippet export land in subsequent phases.
 */

const SESSION_KEY = "autocurb:prospect-demo";

const readPersisted = <T,>(key: string, fallback: T): T =>
  readPersistedShared<T>(SESSION_KEY, key, fallback);
const writePersisted = (key: string, value: unknown) =>
  writePersistedShared(SESSION_KEY, key, value);

const ASSETS = [
  { id: "iframe",   label: "Iframe Modal",     icon: PanelRightOpen,    pages: ["home"] as PageType[] },
  { id: "homepage", label: "Hero Banner",      icon: Lightbulb,         pages: ["home"] as PageType[] },
  { id: "widget",   label: "Widget Tab",       icon: MousePointerClick, pages: ["home", "listing", "vdp"] as PageType[] },
  { id: "sticky",   label: "Sticky Bar",       icon: LayoutList,        pages: ["home", "listing", "vdp"] as PageType[] },
  { id: "vdp",      label: "VDP Ghost",        icon: MapPin,            pages: ["vdp"] as PageType[] },
  { id: "listing",  label: "Listing Ghost",    icon: LayoutList,        pages: ["listing"] as PageType[] },
  { id: "button",   label: "Button CTA",       icon: MousePointerClick, pages: ["home", "listing", "vdp"] as PageType[] },
  { id: "ppt",      label: "PPT Badge",        icon: Award,             pages: ["home", "vdp"] as PageType[] },
] as const;

type AssetId = typeof ASSETS[number]["id"];

// Shape returned by the analyze-prospect-site edge function. Mirrors the
// JSON schema we ask Claude to produce. All fields optional because the
// LLM occasionally omits per-page sections when there's no useful signal.
interface LlmPageAnalysis {
  placements?: string[];
  skipAssets?: string[];
  notes?: string;
}
interface LlmAnalysis {
  pitchLine?: string;
  accentColor?: { hex?: string; name?: string; reasoning?: string };
  pages?: {
    home?: LlmPageAnalysis;
    listing?: LlmPageAnalysis;
    vdp?: LlmPageAnalysis;
  };
}

// Reasonable defaults that look credible on any dealer site without
// the rep having to write fresh copy from scratch. Sales rep can edit
// per-prospect in the form below.
const DEFAULT_CONFIG = {
  dealerName: "",
  buttonColor: "#003B80",
  buttonText: "Get Cash Offer",
  bannerHeadline: "Sell Your Car For Cash — In Minutes",
  bannerText: "Get an instant offer good for 7 days. No appointment, no hassle.",
  bannerCtaText: "Get My Offer",
  stickyText: "Want to know what your car is worth?",
  stickyCtaText: "Get Cash Offer",
  pptButtonText: "Push, Pull, or Tow",
  pptEnabled: true,
};

const ProspectDemo = () => {
  const { toast } = useToast();

  // ── Prospect-config form (replaces tenant prop-drilling) ──
  const [dealerName, setDealerName] = useState(() =>
    readPersisted("dealerName", DEFAULT_CONFIG.dealerName),
  );
  const [buttonColor, setButtonColor] = useState(() =>
    readPersisted("buttonColor", DEFAULT_CONFIG.buttonColor),
  );
  const [buttonText, setButtonText] = useState(() =>
    readPersisted("buttonText", DEFAULT_CONFIG.buttonText),
  );
  const [bannerHeadline, setBannerHeadline] = useState(() =>
    readPersisted("bannerHeadline", DEFAULT_CONFIG.bannerHeadline),
  );
  const [bannerText, setBannerText] = useState(() =>
    readPersisted("bannerText", DEFAULT_CONFIG.bannerText),
  );
  const [bannerCtaText, setBannerCtaText] = useState(() =>
    readPersisted("bannerCtaText", DEFAULT_CONFIG.bannerCtaText),
  );
  const [stickyText, setStickyText] = useState(() =>
    readPersisted("stickyText", DEFAULT_CONFIG.stickyText),
  );
  const [stickyCtaText, setStickyCtaText] = useState(() =>
    readPersisted("stickyCtaText", DEFAULT_CONFIG.stickyCtaText),
  );
  const [pptButtonText, setPptButtonText] = useState(() =>
    readPersisted("pptButtonText", DEFAULT_CONFIG.pptButtonText),
  );
  const [pptEnabled, setPptEnabled] = useState(() =>
    readPersisted("pptEnabled", DEFAULT_CONFIG.pptEnabled),
  );

  // ── Capture form (URLs + screenshot state) ──
  const [homeUrl, setHomeUrl] = useState(() => readPersisted("homeUrl", ""));
  const [listingUrl, setListingUrl] = useState(() => readPersisted("listingUrl", ""));
  const [vdpUrl, setVdpUrl] = useState(() => readPersisted("vdpUrl", ""));
  const [capturing, setCapturing] = useState(false);
  const [lastCapturedAt, setLastCapturedAt] = useState<number | null>(() =>
    readPersisted<number | null>("lastCapturedAt", null),
  );
  const [now, setNow] = useState(() => Date.now());
  const [captures, setCaptures] = useState<CaptureSet>(() =>
    readPersisted<CaptureSet>("captures", { home: null, listing: null, vdp: null }),
  );
  const [failures, setFailures] = useState<FailureSet>({
    home: null,
    listing: null,
    vdp: null,
  });
  const [activeAssets, setActiveAssets] = useState<Set<AssetId>>(() => {
    const stored = readPersisted<AssetId[]>("activeAssets", ["iframe", "widget", "vdp"]);
    return new Set(stored);
  });

  // ── AI color recommendations ──
  // Populated client-side from the homepage screenshot using
  // colorAnalysis.ts (zero API cost). Re-runs whenever a new homepage
  // capture lands. Phase 3 layers vision-LLM placement reasoning on top.
  const [palette, setPalette] = useState<PaletteColor[] | null>(null);
  const [recommendations, setRecommendations] = useState<AttentionRecommendation[] | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [analysisError, setAnalysisError] = useState<string | null>(null);

  // ── Vision-LLM recommendations (Phase 3) ──
  // Costs ~$0.03–0.05 per click. Surfaces a "senior sales rep" opinion:
  // per-page placement reasoning, accent-color override, pitch line.
  const [llmRunning, setLlmRunning] = useState(false);
  const [llmResult, setLlmResult] = useState<LlmAnalysis | null>(null);
  const [llmError, setLlmError] = useState<string | null>(null);

  // ── Persistence ──
  useEffect(() => writePersisted("dealerName", dealerName), [dealerName]);
  useEffect(() => writePersisted("buttonColor", buttonColor), [buttonColor]);
  useEffect(() => writePersisted("buttonText", buttonText), [buttonText]);
  useEffect(() => writePersisted("bannerHeadline", bannerHeadline), [bannerHeadline]);
  useEffect(() => writePersisted("bannerText", bannerText), [bannerText]);
  useEffect(() => writePersisted("bannerCtaText", bannerCtaText), [bannerCtaText]);
  useEffect(() => writePersisted("stickyText", stickyText), [stickyText]);
  useEffect(() => writePersisted("stickyCtaText", stickyCtaText), [stickyCtaText]);
  useEffect(() => writePersisted("pptButtonText", pptButtonText), [pptButtonText]);
  useEffect(() => writePersisted("pptEnabled", pptEnabled), [pptEnabled]);
  useEffect(() => writePersisted("homeUrl", homeUrl), [homeUrl]);
  useEffect(() => writePersisted("listingUrl", listingUrl), [listingUrl]);
  useEffect(() => writePersisted("vdpUrl", vdpUrl), [vdpUrl]);
  useEffect(() => writePersisted("captures", captures), [captures]);
  useEffect(() => writePersisted("lastCapturedAt", lastCapturedAt), [lastCapturedAt]);
  useEffect(
    () => writePersisted("activeAssets", Array.from(activeAssets)),
    [activeAssets],
  );

  // ── Auto-fill listing URL when homepage changes and listing is blank ──
  useEffect(() => {
    if (!listingUrl.trim() && homeUrl.trim()) {
      const guess = guessListingUrl(homeUrl);
      if (guess) setListingUrl(guess);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [homeUrl]);

  // ── Auto-analyze palette when homepage screenshot arrives ──
  // Runs entirely client-side (canvas pixel sampling). No quota burn.
  useEffect(() => {
    if (!captures.home) {
      setPalette(null);
      setRecommendations(null);
      return;
    }
    let cancelled = false;
    setAnalyzing(true);
    setAnalysisError(null);
    extractPalette(captures.home, { topN: 5 })
      .then((p) => {
        if (cancelled) return;
        setPalette(p);
        setRecommendations(recommendAttentionColors(p, { count: 3 }));
      })
      .catch((e) => {
        if (cancelled) return;
        console.warn("Palette extraction failed:", e);
        setAnalysisError(
          e instanceof Error ? e.message : "Couldn't analyze the screenshot",
        );
      })
      .finally(() => {
        if (!cancelled) setAnalyzing(false);
      });
    return () => {
      cancelled = true;
    };
  }, [captures.home]);

  // ── Cooldown ticker ──
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

  // Kick off the vision-LLM analysis. Runs over whichever screenshots
  // are present (some prospects have only a homepage to analyze).
  const handleRunLlmAnalysis = async () => {
    if (!hasAnyCapture) return;
    setLlmRunning(true);
    setLlmError(null);
    try {
      const { data, error } = await supabase.functions.invoke<LlmAnalysis>(
        "analyze-prospect-site",
        {
          body: {
            dealerName: dealerName || undefined,
            screenshots: {
              home: captures.home || undefined,
              listing: captures.listing || undefined,
              vdp: captures.vdp || undefined,
            },
            palette: palette?.map((p) => p.hex),
            buttonColor,
          },
        },
      );
      if (error) throw new Error(error.message);
      if (!data) throw new Error("Empty response from analyze-prospect-site");
      setLlmResult(data);
      toast({
        title: "AI analysis complete",
        description: "Senior-rep recommendations are below the screenshots.",
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Unknown error";
      setLlmError(msg);
      toast({
        title: "AI analysis failed",
        description: msg,
        variant: "destructive",
      });
    } finally {
      setLlmRunning(false);
    }
  };

  const handleCapture = async () => {
    if (inCooldown) return;
    if (!homeUrl.trim()) {
      toast({
        title: "Need a homepage URL",
        description: "Paste the prospect's homepage URL to start.",
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
          description: "Free tier is 50 captures/day per IP. Try again later.",
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
    dealerName: dealerName || undefined,
  };

  const visibleAssets = ASSETS.filter((a) => {
    if (a.id === "ppt" && !pptEnabled) return false;
    return a.pages.some((p) => captures[p]);
  });

  const hasAnyCapture = !!(captures.home || captures.listing || captures.vdp);
  const hasAnyFailure = !!(failures.home || failures.listing || failures.vdp);

  return (
    <div className="space-y-5 max-w-[1400px]">
      {/* Header explainer */}
      <div className="rounded-lg border border-slate-200 bg-gradient-to-r from-slate-50 to-blue-50 p-4 flex items-start gap-3">
        <Target className="w-5 h-5 text-blue-700 shrink-0 mt-0.5" />
        <div className="text-sm text-slate-700 leading-relaxed">
          <strong>Prospect Demo Builder</strong> — for pitching dealers who aren't customers yet.
          Configure the prospect's brand below, paste their site URLs, and we'll generate a
          screenshot demo showing exactly how Autocurb assets would look on their site. Use it
          on cold calls, in emails, or in the showroom. Powered by microlink.io (free, 50/day).
        </div>
      </div>

      {/* Prospect config form */}
      <div className="rounded-lg border border-slate-200 bg-white p-4 space-y-4">
        <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.1em] text-slate-500">
          <Sparkles className="w-3.5 h-3.5" />
          Prospect Brand &amp; Copy
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div>
            <Label className="text-xs font-semibold text-slate-700">Dealer Name</Label>
            <Input
              value={dealerName}
              onChange={(e) => setDealerName(e.target.value)}
              placeholder="Harte INFINITI"
              className="mt-1"
            />
          </div>
          <div>
            <Label className="text-xs font-semibold text-slate-700">Button Color</Label>
            <div className="mt-1 flex gap-2">
              <input
                type="color"
                value={buttonColor}
                onChange={(e) => setButtonColor(e.target.value)}
                className="h-9 w-12 rounded border border-slate-200 cursor-pointer"
              />
              <Input
                value={buttonColor}
                onChange={(e) => setButtonColor(e.target.value)}
                placeholder="#003B80"
                className="flex-1 font-mono text-xs"
              />
            </div>
          </div>
          <div>
            <Label className="text-xs font-semibold text-slate-700">Primary CTA Text</Label>
            <Input
              value={buttonText}
              onChange={(e) => setButtonText(e.target.value)}
              placeholder="Get Cash Offer"
              className="mt-1"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <Label className="text-xs font-semibold text-slate-700">Banner Headline</Label>
            <Input
              value={bannerHeadline}
              onChange={(e) => setBannerHeadline(e.target.value)}
              className="mt-1"
            />
          </div>
          <div>
            <Label className="text-xs font-semibold text-slate-700">Banner CTA Text</Label>
            <Input
              value={bannerCtaText}
              onChange={(e) => setBannerCtaText(e.target.value)}
              className="mt-1"
            />
          </div>
        </div>

        <div>
          <Label className="text-xs font-semibold text-slate-700">Banner Body Text</Label>
          <Textarea
            value={bannerText}
            onChange={(e) => setBannerText(e.target.value)}
            rows={2}
            className="mt-1"
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <Label className="text-xs font-semibold text-slate-700">Sticky Bar Text</Label>
            <Input
              value={stickyText}
              onChange={(e) => setStickyText(e.target.value)}
              className="mt-1"
            />
          </div>
          <div>
            <Label className="text-xs font-semibold text-slate-700">Sticky Bar CTA</Label>
            <Input
              value={stickyCtaText}
              onChange={(e) => setStickyCtaText(e.target.value)}
              className="mt-1"
            />
          </div>
        </div>

        <div className="flex items-center justify-between gap-3 rounded-md border border-slate-200 bg-slate-50 px-3 py-2">
          <div className="flex items-center gap-3">
            <Switch checked={pptEnabled} onCheckedChange={setPptEnabled} id="ppt-enabled" />
            <Label htmlFor="ppt-enabled" className="text-xs font-semibold text-slate-700 cursor-pointer">
              Enable Push-Pull-Tow badge
            </Label>
          </div>
          <Input
            value={pptButtonText}
            onChange={(e) => setPptButtonText(e.target.value)}
            placeholder="Push, Pull, or Tow"
            disabled={!pptEnabled}
            className="max-w-xs text-xs"
          />
        </div>
      </div>

      {/* Capture form */}
      <div className="rounded-lg border border-slate-200 bg-white p-4 space-y-3">
        <div className="text-[10px] font-bold uppercase tracking-[0.1em] text-slate-500">
          Prospect Site URLs
        </div>
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
            Listing and VDP URLs are optional — leave blank for a homepage-only demo.
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

      {/* AI color recommendations (algorithmic, client-side) */}
      {captures.home && (
        <ColorRecommendationsPanel
          palette={palette}
          recommendations={recommendations}
          analyzing={analyzing}
          error={analysisError}
          activeColor={buttonColor}
          onApply={setButtonColor}
        />
      )}

      {/* Vision-LLM senior-rep recommendations (~$0.05 per click) */}
      {hasAnyCapture && (
        <LlmRecommendationsPanel
          running={llmRunning}
          result={llmResult}
          error={llmError}
          onRun={handleRunLlmAnalysis}
          onApplyAccent={setButtonColor}
          activeColor={buttonColor}
        />
      )}

      {/* Asset toggles */}
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

      {/* Browser-frame demo cards */}
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

const PageScreenshot = ({
  src,
  children,
}: {
  src: string;
  children?: React.ReactNode;
}) => (
  <div className="relative bg-slate-100" style={{ aspectRatio: "1280 / 800" }}>
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

// ── AI color recommendations panel ────────────────────────────────────
// Surfaces the dealer's extracted palette + 2-3 attention-color picks.
// Algorithmic only — Phase 3 layers vision-LLM placement reasoning on top.
const ColorRecommendationsPanel = ({
  palette,
  recommendations,
  analyzing,
  error,
  activeColor,
  onApply,
}: {
  palette: PaletteColor[] | null;
  recommendations: AttentionRecommendation[] | null;
  analyzing: boolean;
  error: string | null;
  activeColor: string;
  onApply: (hex: string) => void;
}) => {
  const matchingActive = (hex: string) =>
    hex.toUpperCase() === activeColor.toUpperCase();

  if (analyzing) {
    return (
      <div className="rounded-lg border border-slate-200 bg-white p-4 flex items-center gap-3">
        <Loader2 className="w-4 h-4 animate-spin text-slate-500" />
        <span className="text-sm text-slate-600">Analyzing dealer's palette…</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 flex items-start gap-2">
        <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
        <div className="text-xs text-amber-800">
          Couldn't analyze the screenshot for color recommendations: {error}
        </div>
      </div>
    );
  }

  if (!palette || !recommendations) return null;

  return (
    <div className="rounded-lg border border-slate-200 bg-gradient-to-br from-white to-slate-50 p-4 space-y-4">
      <div className="flex items-center gap-2">
        <Sparkles className="w-4 h-4 text-blue-600" />
        <div className="text-[10px] font-bold uppercase tracking-[0.1em] text-slate-500">
          AI Color Recommendations
        </div>
      </div>

      {/* Dealer's existing palette */}
      <div>
        <div className="text-[11px] text-slate-600 mb-1.5">Dealer's site palette</div>
        <div className="flex gap-1.5">
          {palette.map((p) => (
            <div
              key={p.hex}
              className="group relative"
              title={`${p.hex} — ${Math.round(p.weight * 100)}% of analyzed pixels`}
            >
              <div
                className="w-10 h-10 rounded-md border border-slate-200 shadow-sm"
                style={{ backgroundColor: p.hex }}
              />
              <div className="text-[9px] font-mono text-slate-500 mt-0.5 text-center">
                {p.hex}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Attention-color recommendations */}
      <div>
        <div className="text-[11px] text-slate-600 mb-2">
          Recommended CTA colors that pop against this site
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
          {recommendations.map((r) => {
            const isActive = matchingActive(r.hex);
            return (
              <button
                key={r.hex}
                onClick={() => onApply(r.hex)}
                className={`text-left rounded-lg border p-3 transition ${
                  isActive
                    ? "border-blue-500 bg-blue-50 ring-2 ring-blue-200"
                    : "border-slate-200 bg-white hover:border-slate-400"
                }`}
              >
                <div className="flex items-center gap-2 mb-1">
                  <div
                    className="w-6 h-6 rounded-md border border-slate-300 shrink-0"
                    style={{ backgroundColor: r.hex }}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-bold text-slate-800 truncate">
                      {r.name}
                    </div>
                    <div className="text-[10px] font-mono text-slate-500">{r.hex}</div>
                  </div>
                  {isActive && (
                    <div className="text-[10px] font-bold text-blue-700 uppercase tracking-wider">
                      Applied
                    </div>
                  )}
                </div>
                <div className="text-[10px] text-slate-600 leading-snug">{r.reasoning}</div>
                <div className="flex gap-3 mt-1.5 text-[9px] text-slate-500">
                  <span>{r.contrastVsWhite}:1 vs white</span>
                  <span>{r.contrastVsPrimary}:1 vs primary</span>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};

// ── Vision-LLM senior-rep panel ───────────────────────────────────────
// Single click → analyze-prospect-site edge function → Claude Sonnet 4.5
// vision → structured JSON (pitchLine, accentColor, per-page placements).
// The button costs real money each press, so we don't auto-run.
const LlmRecommendationsPanel = ({
  running,
  result,
  error,
  onRun,
  onApplyAccent,
  activeColor,
}: {
  running: boolean;
  result: LlmAnalysis | null;
  error: string | null;
  onRun: () => void;
  onApplyAccent: (hex: string) => void;
  activeColor: string;
}) => {
  const accent = result?.accentColor;
  const accentApplied =
    accent?.hex && accent.hex.toUpperCase() === activeColor.toUpperCase();

  return (
    <div className="rounded-lg border border-blue-200 bg-gradient-to-br from-blue-50 to-violet-50 p-4 space-y-3">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <Brain className="w-4 h-4 text-violet-700" />
          <div className="text-[10px] font-bold uppercase tracking-[0.1em] text-violet-700">
            Senior-Rep AI Recommendations
          </div>
        </div>
        <Button
          onClick={onRun}
          disabled={running}
          variant="default"
          size="sm"
          className="gap-1.5 bg-violet-700 hover:bg-violet-800"
        >
          {running ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          ) : (
            <Sparkles className="w-3.5 h-3.5" />
          )}
          {running
            ? "Analyzing screenshots…"
            : result
              ? "Re-run analysis"
              : "Get AI Recommendations"}
        </Button>
      </div>

      {!result && !running && !error && (
        <p className="text-xs text-slate-600 leading-relaxed">
          Claude Sonnet will look at the captured screenshots and tell you
          where each embed asset would have the most impact, recommend an
          accent color tuned to this dealer's brand, and write a one-line
          opening pitch. Runs ~$0.05 per click.
        </p>
      )}

      {error && (
        <div className="rounded-md border border-amber-200 bg-amber-50 p-3 flex items-start gap-2">
          <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
          <div className="text-xs text-amber-800">{error}</div>
        </div>
      )}

      {result && (
        <div className="space-y-3">
          {result.pitchLine && (
            <div className="rounded-md border border-violet-200 bg-white p-3">
              <div className="text-[10px] font-bold uppercase tracking-[0.1em] text-violet-700 mb-1">
                Opening pitch
              </div>
              <div className="text-sm text-slate-800 italic leading-relaxed">
                "{result.pitchLine}"
              </div>
            </div>
          )}

          {accent?.hex && (
            <div className="rounded-md border border-slate-200 bg-white p-3">
              <div className="text-[10px] font-bold uppercase tracking-[0.1em] text-slate-500 mb-2">
                Recommended accent color
              </div>
              <div className="flex items-center gap-3">
                <div
                  className="w-10 h-10 rounded-md border border-slate-300 shrink-0"
                  style={{ backgroundColor: accent.hex }}
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-baseline gap-2">
                    <span className="text-sm font-bold text-slate-800">
                      {accent.name || "AI accent"}
                    </span>
                    <span className="text-[11px] font-mono text-slate-500">
                      {accent.hex}
                    </span>
                  </div>
                  {accent.reasoning && (
                    <div className="text-[11px] text-slate-600 mt-0.5 leading-snug">
                      {accent.reasoning}
                    </div>
                  )}
                </div>
                <Button
                  size="sm"
                  variant={accentApplied ? "secondary" : "default"}
                  onClick={() => onApplyAccent(accent.hex!)}
                  disabled={accentApplied}
                >
                  {accentApplied ? "Applied" : "Apply"}
                </Button>
              </div>
            </div>
          )}

          {result.pages && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
              {(["home", "listing", "vdp"] as const).map((pageKey) => {
                const p = result.pages?.[pageKey];
                if (!p) return null;
                return (
                  <div
                    key={pageKey}
                    className="rounded-md border border-slate-200 bg-white p-3"
                  >
                    <div className="text-[10px] font-bold uppercase tracking-[0.1em] text-slate-500 mb-1.5">
                      {pageKey === "home"
                        ? "Homepage"
                        : pageKey === "listing"
                          ? "Listing"
                          : "VDP"}
                    </div>
                    {p.notes && (
                      <div className="text-[11px] text-slate-700 leading-snug mb-2">
                        {p.notes}
                      </div>
                    )}
                    {!!p.placements?.length && (
                      <div className="mb-1.5">
                        <div className="text-[9px] font-bold uppercase tracking-wider text-emerald-700 mb-0.5">
                          Use
                        </div>
                        <ul className="text-[11px] text-slate-700 leading-snug space-y-0.5 list-disc list-inside">
                          {p.placements.map((line, i) => (
                            <li key={i}>{line}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                    {!!p.skipAssets?.length && (
                      <div>
                        <div className="text-[9px] font-bold uppercase tracking-wider text-rose-700 mb-0.5">
                          Skip
                        </div>
                        <ul className="text-[11px] text-slate-600 leading-snug space-y-0.5 list-disc list-inside">
                          {p.skipAssets.map((line, i) => (
                            <li key={i}>{line}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

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

export default ProspectDemo;
