import { useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { useSiteConfig } from "@/hooks/useSiteConfig";
import SellCarForm from "@/components/SellCarForm";
import { ArrowRightLeft, DollarSign, Clock, ShieldCheck } from "lucide-react";

/**
 * /trade-in — Lightweight iframe-optimized page for dealer website integration.
 *
 * Designed to replace the dealer's "Value Your Trade" page via iframe.
 * No header, no footer, no marketing sections — just the form with
 * trade-focused messaging and trust signals.
 *
 * URL params:
 *   ?store=<locationId>  — pre-assign leads to a store
 *   ?ref=<code>          — referral tracking
 *   ?rep=<code>          — sales rep tracking
 *   ?mode=sell           — switch to sell framing (default: trade)
 */
const TradeIframe = () => {
  const { config } = useSiteConfig();
  const [searchParams] = useSearchParams();
  const mode = searchParams.get("mode") || "trade";
  const isTrade = mode !== "sell";

  const headline = isTrade
    ? (config.trade_iframe_headline || "What's Your Trade Worth?")
    : (config.hero_headline || "Sell Your Car for Top Dollar");
  const subtext = isTrade
    ? (config.trade_iframe_subtext || "Get your trade-in value in under 2 minutes — includes your tax savings.")
    : (config.hero_subtext || "Get a cash offer in 2 minutes. No obligation.");

  // Auto-resize: notify parent iframe of height changes
  useEffect(() => {
    const sendHeight = () => {
      const height = document.documentElement.scrollHeight;
      window.parent.postMessage({ type: "hartecash-resize", height }, "*");
    };

    sendHeight();
    const observer = new ResizeObserver(sendHeight);
    observer.observe(document.body);
    // Also fire on form step transitions
    const interval = setInterval(sendHeight, 500);

    return () => {
      observer.disconnect();
      clearInterval(interval);
    };
  }, []);

  const trustPoints = isTrade
    ? [
        { icon: ArrowRightLeft, text: "Trade-in value includes tax credit" },
        { icon: Clock, text: "Real offer in under 2 minutes" },
        { icon: DollarSign, text: "Powered by Black Book market data" },
        { icon: ShieldCheck, text: "No obligation — your info stays private" },
      ]
    : [
        { icon: DollarSign, text: "Top-dollar cash offer" },
        { icon: Clock, text: "Get your offer in 2 minutes" },
        { icon: ShieldCheck, text: "No obligation — your info stays private" },
      ];

  return (
    <div className="min-h-screen bg-background">
      {/* Compact header band */}
      <div className="bg-gradient-to-r from-primary to-[hsl(210,100%,36%)] text-primary-foreground">
        <div className="max-w-xl mx-auto px-4 py-6 text-center">
          {config.logo_url && (
            <img
              src={config.logo_url}
              alt={config.dealership_name}
              className="h-8 mx-auto mb-3 object-contain brightness-0 invert"
            />
          )}
          <h1 className="text-xl sm:text-2xl font-extrabold tracking-tight leading-tight">
            {headline}
          </h1>
          <p className="text-sm sm:text-base opacity-90 mt-1.5 leading-relaxed">
            {subtext}
          </p>
        </div>
      </div>

      {/* Trust micro-bar */}
      <div className="border-b border-border bg-muted/30">
        <div className="max-w-xl mx-auto px-4 py-2.5 flex flex-wrap justify-center gap-x-5 gap-y-1.5">
          {trustPoints.map((tp, i) => (
            <div key={i} className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <tp.icon className="w-3.5 h-3.5 text-primary flex-shrink-0" />
              <span>{tp.text}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Form — centered, max-width constrained */}
      <div className="max-w-xl mx-auto px-4 py-6">
        <SellCarForm
          variant="default"
          leadSource={isTrade ? "trade" : "inventory"}
        />
      </div>

      {/* Mode toggle */}
      <div className="max-w-xl mx-auto px-4 pb-6 text-center">
        {isTrade ? (
          <p className="text-xs text-muted-foreground">
            Not trading in?{" "}
            <a
              href={`?mode=sell${searchParams.get("store") ? `&store=${searchParams.get("store")}` : ""}${searchParams.get("ref") ? `&ref=${searchParams.get("ref")}` : ""}`}
              className="text-primary hover:underline font-medium"
            >
              Sell your car for cash instead
            </a>
          </p>
        ) : (
          <p className="text-xs text-muted-foreground">
            Have a trade-in?{" "}
            <a
              href={`?mode=trade${searchParams.get("store") ? `&store=${searchParams.get("store")}` : ""}${searchParams.get("ref") ? `&ref=${searchParams.get("ref")}` : ""}`}
              className="text-primary hover:underline font-medium"
            >
              Get your trade-in value with tax savings
            </a>
          </p>
        )}
      </div>

      {/* Minimal footer */}
      <div className="border-t border-border bg-muted/20 py-3 text-center">
        <p className="text-[10px] text-muted-foreground/60">
          Powered by {config.dealership_name} &bull; Values based on real-time market data
        </p>
      </div>
    </div>
  );
};

export default TradeIframe;
