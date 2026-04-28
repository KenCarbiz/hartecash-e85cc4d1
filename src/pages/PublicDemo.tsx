import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { Loader2, AlertCircle, ExternalLink, Sparkles } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import {
  IframeModalOverlay,
  RightWidgetOverlay,
  VdpGhostOverlay,
  ListingGhostOverlay,
  HomepageBannerOverlay,
  StickyBarOverlay,
  ButtonCtaOverlay,
  PptOverlay,
} from "@/components/admin/embed/AssetOverlays";

/**
 * PublicDemo — read-only view of a saved Prospect Demo, by share_token.
 *
 * Salesperson saves a demo from the admin tool, gets a /demo/:token URL,
 * texts/emails it to the dealer. The dealer clicks, sees their own site
 * with our embed assets layered on, gets pitched without anyone present.
 *
 * No nav, no admin chrome — just the demo. Loads via the public
 * get-prospect-demo edge function (anonymous-safe; uses service role).
 */

interface DemoData {
  shareToken: string;
  dealerName?: string | null;
  homeUrl?: string | null;
  listingUrl?: string | null;
  vdpUrl?: string | null;
  screenshots: {
    home?: string | null;
    listing?: string | null;
    vdp?: string | null;
  };
  config: {
    buttonColor?: string;
    buttonText?: string;
    bannerHeadline?: string;
    bannerText?: string;
    bannerCtaText?: string;
    stickyText?: string;
    stickyCtaText?: string;
    pptButtonText?: string;
    pptEnabled?: boolean;
    activeAssets?: string[];
  };
  pitchLine?: string | null;
  expiresAt?: string;
}

const PublicDemo = () => {
  const { token } = useParams<{ token: string }>();
  const [demo, setDemo] = useState<DemoData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) {
      setError("Missing demo token");
      setLoading(false);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const { data, error: fnErr } = await supabase.functions.invoke<DemoData>(
          "get-prospect-demo",
          { body: { token } },
        );
        if (cancelled) return;
        if (fnErr) {
          setError(fnErr.message || "Couldn't load demo");
          return;
        }
        if (!data) {
          setError("Demo not found");
          return;
        }
        setDemo(data);
      } catch (e) {
        if (cancelled) return;
        setError(e instanceof Error ? e.message : "Network error");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [token]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <Loader2 className="w-8 h-8 animate-spin text-slate-400" />
      </div>
    );
  }

  if (error || !demo) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 px-6">
        <div className="max-w-md text-center">
          <AlertCircle className="w-12 h-12 text-amber-500 mx-auto mb-3" />
          <h1 className="text-xl font-bold text-slate-800 mb-2">Demo unavailable</h1>
          <p className="text-sm text-slate-600">
            {error || "This demo link is no longer valid. It may have expired or been removed."}
          </p>
          <a
            href="https://hartecash.com"
            className="inline-block mt-4 text-sm text-blue-600 hover:underline"
          >
            Visit Autocurb →
          </a>
        </div>
      </div>
    );
  }

  const config = demo.config || {};
  const activeSet = new Set(config.activeAssets || ["iframe", "widget", "vdp"]);
  const dealerName = demo.dealerName || "your dealership";

  const commonOverlayProps = {
    buttonColor: config.buttonColor || "#003B80",
    buttonText: config.buttonText || "Get Cash Offer",
    dealerName: demo.dealerName || undefined,
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white">
      {/* Header — leads with the dealer's name, not Autocurb branding */}
      <div className="bg-gradient-to-r from-[#003b80] to-[#005bb5] text-white py-10 px-4">
        <div className="max-w-6xl mx-auto">
          <div className="flex items-center gap-2 mb-2 text-white/80 text-xs uppercase tracking-wider font-bold">
            <Sparkles className="w-3.5 h-3.5" />
            Prepared for {dealerName}
          </div>
          <h1 className="text-3xl md:text-5xl font-bold mb-3 leading-tight">
            Here's {dealerName} with instant cash offers built in.
          </h1>
          {demo.pitchLine && (
            <p className="text-base md:text-lg text-white/90 max-w-3xl">
              {demo.pitchLine}
            </p>
          )}
        </div>
      </div>

      {/* Demo body */}
      <div className="max-w-6xl mx-auto px-4 py-8 space-y-6">
        {demo.screenshots.home && (
          <PublicBrowserFrame label="Homepage" url={demo.homeUrl}>
            <PublicScreenshot src={demo.screenshots.home}>
              {activeSet.has("homepage") && <HomepageBannerOverlay {...commonOverlayProps} />}
              {activeSet.has("widget") && <RightWidgetOverlay {...commonOverlayProps} />}
              {activeSet.has("sticky") && (
                <StickyBarOverlay
                  {...commonOverlayProps}
                  stickyText={config.stickyText}
                  stickyCtaText={config.stickyCtaText}
                />
              )}
              {activeSet.has("button") && <ButtonCtaOverlay {...commonOverlayProps} />}
              {activeSet.has("ppt") && config.pptEnabled && (
                <PptOverlay {...commonOverlayProps} pptButtonText={config.pptButtonText} />
              )}
              {activeSet.has("iframe") && <IframeModalOverlay {...commonOverlayProps} />}
            </PublicScreenshot>
          </PublicBrowserFrame>
        )}

        {demo.screenshots.listing && (
          <PublicBrowserFrame label="Listing / Inventory Page" url={demo.listingUrl}>
            <PublicScreenshot src={demo.screenshots.listing}>
              {activeSet.has("listing") && (
                <ListingGhostOverlay
                  {...commonOverlayProps}
                  bannerHeadline={config.bannerHeadline}
                  bannerCtaText={config.bannerCtaText}
                />
              )}
              {activeSet.has("widget") && <RightWidgetOverlay {...commonOverlayProps} />}
              {activeSet.has("sticky") && (
                <StickyBarOverlay
                  {...commonOverlayProps}
                  stickyText={config.stickyText}
                  stickyCtaText={config.stickyCtaText}
                />
              )}
              {activeSet.has("button") && <ButtonCtaOverlay {...commonOverlayProps} />}
            </PublicScreenshot>
          </PublicBrowserFrame>
        )}

        {demo.screenshots.vdp && (
          <PublicBrowserFrame label="Vehicle Detail Page" url={demo.vdpUrl}>
            <PublicScreenshot src={demo.screenshots.vdp}>
              {activeSet.has("vdp") && (
                <VdpGhostOverlay
                  {...commonOverlayProps}
                  bannerHeadline={config.bannerHeadline}
                  bannerText={config.bannerText}
                  bannerCtaText={config.bannerCtaText}
                />
              )}
              {activeSet.has("widget") && <RightWidgetOverlay {...commonOverlayProps} />}
              {activeSet.has("sticky") && (
                <StickyBarOverlay
                  {...commonOverlayProps}
                  stickyText={config.stickyText}
                  stickyCtaText={config.stickyCtaText}
                />
              )}
              {activeSet.has("button") && <ButtonCtaOverlay {...commonOverlayProps} />}
              {activeSet.has("ppt") && config.pptEnabled && (
                <PptOverlay {...commonOverlayProps} pptButtonText={config.pptButtonText} />
              )}
            </PublicScreenshot>
          </PublicBrowserFrame>
        )}

        {/* Footer CTA */}
        <div className="rounded-xl bg-gradient-to-br from-[#003b80] to-[#005bb5] text-white p-8 text-center">
          <h2 className="text-2xl font-bold mb-2">Like what you see?</h2>
          <p className="text-white/90 mb-4 max-w-xl mx-auto">
            This is how your dealership's site would look with Autocurb's
            cash-offer flow. Every embed is fully customizable — colors, copy,
            and placement under your control. Set it once, change anytime.
          </p>
          <a
            href="https://hartecash.com"
            className="inline-block bg-white text-[#003b80] font-bold px-6 py-3 rounded-lg hover:bg-slate-100 transition"
          >
            Talk to us about Autocurb
          </a>
        </div>
      </div>
    </div>
  );
};

const PublicBrowserFrame = ({
  label,
  url,
  children,
}: {
  label: string;
  url?: string | null;
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
        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 ml-2">
          {label}
        </span>
      </div>
      <div className="flex-1 mx-4 flex items-center gap-1.5 bg-white border border-slate-200 rounded-md px-2 py-1 text-[11px] text-slate-600 truncate">
        <ExternalLink className="w-3 h-3 shrink-0 text-slate-400" />
        <span className="truncate">{url || "—"}</span>
      </div>
    </div>
    {children}
  </div>
);

const PublicScreenshot = ({
  src,
  children,
}: {
  src: string;
  children?: React.ReactNode;
}) => {
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
      {status === "loading" && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-100">
          <Loader2 className="w-8 h-8 text-slate-400 animate-spin" />
        </div>
      )}

      {status === "errored" && (
        <div className="absolute inset-0 flex flex-col items-center justify-center text-center bg-slate-50 p-6">
          <AlertCircle className="w-10 h-10 text-amber-500 mb-3" />
          <div className="text-sm font-bold text-slate-800">
            Preview unavailable
          </div>
          <div className="text-xs text-slate-600 mt-1 max-w-md">
            We couldn't load the screenshot of this page.
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

      {children}
    </div>
  );
};

export default PublicDemo;
