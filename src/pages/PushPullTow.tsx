import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useSiteConfig } from "@/hooks/useSiteConfig";
import SellCarForm from "@/components/SellCarForm";
import { ShieldCheck, Award, Clock, BadgeDollarSign } from "lucide-react";

/**
 * /push-pull-tow — Iframe-optimized page for the Push/Pull/Tow guarantee certificate.
 *
 * Dealers with a minimum trade-in guarantee program embed this page on their site.
 * Customer enters their vehicle, gets a certificate guaranteeing the minimum amount.
 *
 * URL params:
 *   ?store=<locationId>  — pre-assign leads to a store
 *   ?ref=<code>          — referral tracking
 *   ?rep=<code>          — sales rep tracking
 *   ?amount=<number>     — override the guaranteed amount (e.g. 3000)
 */
const PushPullTow = () => {
  const { config } = useSiteConfig();
  const [searchParams] = useSearchParams();

  const guaranteeAmount = Number(searchParams.get("amount")) || config.ppt_guarantee_amount || 3000;
  const headline = config.ppt_headline || `$${guaranteeAmount.toLocaleString()} Minimum Trade Guarantee`;
  const subtext = config.ppt_subtext || "Push it, pull it, or tow it — your trade is worth at least this much toward your next vehicle.";

  // Auto-resize iframe for parent
  useEffect(() => {
    const sendHeight = () => {
      const height = document.documentElement.scrollHeight;
      window.parent.postMessage({ type: "hartecash-resize", height }, "*");
    };
    sendHeight();
    const observer = new ResizeObserver(sendHeight);
    observer.observe(document.body);
    const interval = setInterval(sendHeight, 500);
    return () => { observer.disconnect(); clearInterval(interval); };
  }, []);

  const formattedAmount = `$${guaranteeAmount.toLocaleString()}`;

  return (
    <div className="min-h-screen bg-background">
      {/* Guarantee banner */}
      <div className="bg-gradient-to-r from-amber-600 to-amber-500 text-white">
        <div className="max-w-xl mx-auto px-4 py-6 text-center">
          {config.logo_url && (
            <img
              src={config.logo_url}
              alt={config.dealership_name}
              className="h-8 mx-auto mb-3 object-contain brightness-0 invert"
            />
          )}
          {/* Certificate badge */}
          <div className="inline-flex items-center gap-2 bg-white/20 backdrop-blur-sm rounded-full px-4 py-1.5 mb-3">
            <Award className="w-4 h-4" />
            <span className="text-xs font-bold uppercase tracking-wider">Guaranteed Minimum Trade</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight leading-tight">
            {headline}
          </h1>
          <p className="text-sm sm:text-base opacity-90 mt-2 leading-relaxed max-w-md mx-auto">
            {subtext}
          </p>
        </div>
      </div>

      {/* Trust points */}
      <div className="border-b border-border bg-muted/30">
        <div className="max-w-xl mx-auto px-4 py-2.5 flex flex-wrap justify-center gap-x-5 gap-y-1.5">
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <BadgeDollarSign className="w-3.5 h-3.5 text-amber-600 flex-shrink-0" />
            <span>{formattedAmount} minimum guaranteed</span>
          </div>
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Clock className="w-3.5 h-3.5 text-amber-600 flex-shrink-0" />
            <span>Certificate in 2 minutes</span>
          </div>
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <ShieldCheck className="w-3.5 h-3.5 text-amber-600 flex-shrink-0" />
            <span>Valid on any vehicle purchase</span>
          </div>
        </div>
      </div>

      {/* Guarantee callout */}
      <div className="max-w-xl mx-auto px-4 pt-5">
        <div className="rounded-xl border-2 border-amber-200 bg-amber-50 dark:bg-amber-950/20 dark:border-amber-800 p-4 text-center">
          <p className="text-sm font-semibold text-amber-900 dark:text-amber-200">
            Enter your vehicle below. If our market offer is higher than {formattedAmount}, you'll get the higher amount.
            If it's lower, you're still guaranteed {formattedAmount} toward your next vehicle.
          </p>
        </div>
      </div>

      {/* Form */}
      <div className="max-w-xl mx-auto px-4 py-6">
        <SellCarForm
          variant="default"
          leadSource="push-pull-tow"
        />
      </div>

      {/* Fine print */}
      <div className="max-w-xl mx-auto px-4 pb-6 text-center">
        <p className="text-[10px] text-muted-foreground/60 leading-relaxed max-w-sm mx-auto">
          Push/Pull/Tow guarantee is valid with the purchase of a new or pre-owned vehicle from {config.dealership_name}.
          Guarantee applies to the trade-in value credited toward the purchase. Subject to approved credit.
          Cannot be combined with other offers unless specified by the dealer.
        </p>
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

export default PushPullTow;
