import { useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { motion } from "framer-motion";
import { Award, ShieldCheck, Clock, BadgeDollarSign } from "lucide-react";
import { useSiteConfig } from "@/hooks/useSiteConfig";
import SellCarForm from "@/components/SellCarForm";

/**
 * Clarity-tier Push/Pull/Tow guarantee page — Apple-minimal version
 * of the dealer's minimum-trade certificate iframe page. Mounted by
 * PushPullTow.tsx as a top-level dispatch when landing_template ===
 * "clarity". Same iframe auto-resize behavior + SellCarForm mount.
 */
const PushPullTowClarity = () => {
  const { config } = useSiteConfig();
  const [searchParams] = useSearchParams();

  const guaranteeAmount = Number(searchParams.get("amount")) || config.ppt_guarantee_amount || 3000;
  const headline = config.ppt_headline || `$${guaranteeAmount.toLocaleString()} Minimum Trade Guarantee`;
  const subtext =
    config.ppt_subtext ||
    "Push it, pull it, or tow it — your trade is worth at least this much toward your next vehicle.";
  const formattedAmount = `$${guaranteeAmount.toLocaleString()}`;

  // Auto-resize for parent iframe — identical to legacy.
  useEffect(() => {
    const sendHeight = () => {
      const height = document.documentElement.scrollHeight;
      window.parent.postMessage({ type: "hartecash-resize", height }, "*");
    };
    sendHeight();
    const observer = new ResizeObserver(sendHeight);
    observer.observe(document.body);
    const interval = setInterval(sendHeight, 500);
    return () => {
      observer.disconnect();
      clearInterval(interval);
    };
  }, []);

  return (
    <div className="min-h-screen bg-white text-zinc-900">
      {/* Certificate banner — Clarity language, no amber gradient.
          Big bold amount on a soft zinc-50 stage with a quiet badge. */}
      <section className="border-b border-zinc-200 bg-zinc-50/40">
        <div className="max-w-[680px] mx-auto px-5 md:px-8 py-10 text-center">
          {config.logo_url && (
            <img
              src={config.logo_url}
              alt={config.dealership_name}
              className="h-8 mx-auto mb-5 object-contain"
            />
          )}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.55, ease: [0.16, 1, 0.3, 1] }}
            className="space-y-4"
          >
            <span className="inline-flex items-center gap-1.5 rounded-full border border-zinc-200 bg-white px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-zinc-600">
              <Award className="w-3.5 h-3.5 text-zinc-500" aria-hidden="true" />
              Guaranteed minimum trade
            </span>
            <p className="font-sans text-[56px] md:text-[80px] font-bold tracking-[-0.035em] leading-[1] text-zinc-900 tabular-nums">
              {formattedAmount}
            </p>
            <h1 className="font-sans text-xl md:text-2xl font-semibold tracking-tight text-zinc-900">
              {headline.replace(formattedAmount, "").trim() || "Minimum Trade Guarantee"}
            </h1>
            <p className="text-sm text-zinc-500 max-w-md mx-auto leading-relaxed">{subtext}</p>
          </motion.div>

          {/* Trust pills */}
          <div className="flex flex-wrap items-center justify-center gap-2 mt-6 text-[11px] uppercase tracking-wider">
            <span className="px-3 py-1.5 rounded-full bg-white border border-zinc-200 text-zinc-600 inline-flex items-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5" aria-hidden="true" /> Locked
            </span>
            <span className="px-3 py-1.5 rounded-full bg-white border border-zinc-200 text-zinc-600 inline-flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5" aria-hidden="true" /> 60 seconds
            </span>
            <span className="px-3 py-1.5 rounded-full bg-white border border-zinc-200 text-zinc-600 inline-flex items-center gap-1.5">
              <BadgeDollarSign className="w-3.5 h-3.5" aria-hidden="true" /> No obligation
            </span>
          </div>
        </div>
      </section>

      {/* Form — reuses SellCarForm so the dealer's full lead capture
          fires identically. The wizard chrome inside SellCarForm
          inherits its own theming from useSiteConfig. */}
      <main className="max-w-[680px] mx-auto px-5 md:px-8 py-10">
        <SellCarForm leadSource="ppt" />
      </main>
    </div>
  );
};

export default PushPullTowClarity;
