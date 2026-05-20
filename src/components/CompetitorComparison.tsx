import { useEffect, useState, useRef } from "react";
import { Check, X, Minus, Sparkles } from "lucide-react";
import { useSiteConfig } from "@/hooks/useSiteConfig";
import { supabase } from "@/integrations/supabase/client";
import { useTenant } from "@/contexts/TenantContext";
import { motion, useInView } from "framer-motion";

interface ComparisonFeature {
  label: string;
  values: (boolean | "partial")[];
}

const CompetitorComparison = () => {
  const { config } = useSiteConfig();
  const { tenant } = useTenant();
  const name = config.dealership_name || "Our Dealership";
  const shortName = name.split(" ")[0];
  const animate = config.enable_animations;

  const DEFAULT_COLUMNS = ["CarMax", "Carvana", "KBB Instant Offer"];
  const pickupOffered = config.pickup_offered !== false;
  const DEFAULT_FEATURES: ComparisonFeature[] = [
    { label: "Real cash offer in 2 minutes",       values: [true,  "partial", true,      true] },
    pickupOffered
      ? { label: "Free at-home pickup",            values: [true,  false,     true,      false] }
      : { label: "Quick in-person drop-off",       values: [true,  true,      false,     "partial"] },
    { label: "We pay the loan payoff",             values: [true,  true,      true,      "partial"] },
    { label: "Same-day payment",                   values: [true,  true,      "partial", false] },
    { label: `Offer good for ${config.price_guarantee_days || 8} days`, values: [true, true, true, false] },
    { label: "No haggling or trade-in pressure",   values: [true,  true,      true,      true] },
    { label: "Local family-owned, not a corporation", values: [true, false, false, false] },
  ];

  const [columns, setColumns] = useState<string[]>(DEFAULT_COLUMNS);
  const [features, setFeatures] = useState<ComparisonFeature[]>(DEFAULT_FEATURES);

  const sectionRef = useRef<HTMLElement>(null);
  const isInView = useInView(sectionRef, { once: true, amount: 0.2 });

  useEffect(() => {
    if (!tenant?.dealership_id) return;
    let cancelled = false;
    (async () => {
      try {
        const { data } = await supabase
          .from("site_config")
          .select("competitor_columns, comparison_features")
          .eq("dealership_id", tenant.dealership_id)
          .maybeSingle();
        if (cancelled || !data) return;
        const d = data as any;
        if (Array.isArray(d.competitor_columns) && d.competitor_columns.length > 0) {
          setColumns(d.competitor_columns);
        }
        if (Array.isArray(d.comparison_features) && d.comparison_features.length > 0) {
          setFeatures(d.comparison_features);
        }
      } catch (err) {
        console.warn("[CompetitorComparison] override fetch failed:", err);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [tenant?.dealership_id]);

  const CellIcon = ({ value, highlight = false }: { value: boolean | string; highlight?: boolean }) => {
    if (value === true)
      return (
        <span
          className={`inline-flex items-center justify-center w-7 h-7 lg:w-9 lg:h-9 rounded-full ${
            highlight ? "bg-success text-white shadow-md shadow-success/30" : "bg-success/15 text-success"
          }`}
        >
          <Check className="w-4 h-4 lg:w-5 lg:h-5" strokeWidth={3} />
        </span>
      );
    if (value === "partial")
      return (
        <span className="inline-flex items-center justify-center w-7 h-7 lg:w-9 lg:h-9 rounded-full bg-muted text-muted-foreground">
          <Minus className="w-4 h-4 lg:w-5 lg:h-5" strokeWidth={3} />
        </span>
      );
    return (
      <span className="inline-flex items-center justify-center w-7 h-7 lg:w-9 lg:h-9 rounded-full bg-destructive/10 text-destructive/70">
        <X className="w-4 h-4 lg:w-5 lg:h-5" strokeWidth={3} />
      </span>
    );
  };

  const shouldAnimate = animate && isInView;

  return (
    <section
      ref={sectionRef}
      className="relative overflow-hidden py-16 lg:py-20 px-5 bg-card"
      id="compare"
    >
      {/* Match HowItWorks dotted texture */}
      <div className="absolute inset-0 bg-[radial-gradient(hsl(var(--border)/0.3)_1px,transparent_1px)] [background-size:32px_32px] pointer-events-none opacity-40" />

      <div className="relative max-w-5xl mx-auto">
        {/* Header — mirrors HowItWorks eyebrow + display title */}
        <div className="text-center mb-12 lg:mb-16">
          <motion.span
            className="inline-block text-xs font-bold uppercase tracking-[0.2em] text-primary/70 mb-3"
            initial={animate ? { opacity: 0, y: 8 } : false}
            animate={shouldAnimate ? { opacity: 1, y: 0 } : undefined}
            transition={{ duration: 0.5 }}
          >
            Head-to-Head
          </motion.span>
          <motion.h2
            className="font-display text-2xl md:text-[28px] lg:text-[34px] font-extrabold text-card-foreground tracking-[0.04em]"
            initial={animate ? { opacity: 0, y: 16, filter: "blur(4px)" } : false}
            animate={shouldAnimate ? { opacity: 1, y: 0, filter: "blur(0px)" } : undefined}
            transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
          >
            Why {shortName} Wins
          </motion.h2>
          <motion.p
            className="text-[15px] lg:text-base text-muted-foreground mt-3 max-w-xl mx-auto"
            initial={animate ? { opacity: 0, y: 12 } : false}
            animate={shouldAnimate ? { opacity: 1, y: 0 } : undefined}
            transition={{ duration: 0.6, delay: 0.08 }}
          >
            See how we stack up against the competition.
          </motion.p>
        </div>

        {/* Comparison card */}
        <motion.div
          className="rounded-2xl bg-background border border-border shadow-[0_20px_60px_-25px_hsl(var(--foreground)/0.18)] overflow-hidden"
          initial={animate ? { opacity: 0, y: 20, filter: "blur(4px)" } : false}
          animate={shouldAnimate ? { opacity: 1, y: 0, filter: "blur(0px)" } : undefined}
          transition={{ duration: 0.7, delay: 0.15, ease: [0.16, 1, 0.3, 1] }}
        >
          <div className="overflow-x-auto">
            <table className="w-full text-sm lg:text-[15px] border-separate border-spacing-0">
              <thead>
                <tr>
                  <th className="text-left px-4 lg:px-6 py-4 lg:py-5 font-semibold text-muted-foreground uppercase text-[11px] tracking-[0.15em] bg-muted/30 border-b border-border w-[34%]">
                    Feature
                  </th>
                  {/* Our column — elevated to match HowItWorks card vibe */}
                  <th
                    className="relative text-center px-3 lg:px-4 py-4 lg:py-5 bg-gradient-to-b from-primary to-[hsl(210,100%,22%)] text-primary-foreground border-b border-primary"
                    style={{ width: "22%" }}
                  >
                    <span className="inline-flex items-center gap-1.5 text-[10px] lg:text-xs font-extrabold uppercase tracking-[0.18em]">
                      <Sparkles className="w-3 h-3 lg:w-3.5 lg:h-3.5" />
                      {shortName}
                    </span>
                  </th>
                  {columns.map((col, i) => (
                    <th
                      key={i}
                      className="text-center px-3 lg:px-4 py-4 lg:py-5 font-semibold text-muted-foreground uppercase text-[11px] tracking-[0.15em] bg-muted/30 border-b border-border"
                      style={{ width: `${44 / columns.length}%` }}
                    >
                      {col}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {features.map((f, i) => (
                  <motion.tr
                    key={i}
                    initial={animate ? { opacity: 0, x: -12 } : false}
                    animate={shouldAnimate ? { opacity: 1, x: 0 } : undefined}
                    transition={{
                      duration: 0.45,
                      delay: 0.25 + i * 0.07,
                      ease: [0.16, 1, 0.3, 1],
                    }}
                    className="group"
                  >
                    <td className="px-4 lg:px-6 py-4 lg:py-5 font-medium text-card-foreground text-[14px] lg:text-[15px] border-b border-border/60 group-last:border-b-0">
                      {f.label}
                    </td>
                    <td className="px-3 lg:px-4 py-4 lg:py-5 text-center bg-primary/5 border-b border-border/60 group-last:border-b-0">
                      <CellIcon value={f.values[0]} highlight />
                    </td>
                    {columns.map((_, cIdx) => (
                      <td
                        key={cIdx}
                        className="px-3 lg:px-4 py-4 lg:py-5 text-center border-b border-border/60 group-last:border-b-0"
                      >
                        <CellIcon value={f.values[cIdx + 1] ?? false} />
                      </td>
                    ))}
                  </motion.tr>
                ))}
              </tbody>
            </table>
          </div>
        </motion.div>

        {/* Legend */}
        <motion.div
          className="flex flex-wrap items-center justify-center gap-4 lg:gap-6 mt-6 text-xs text-muted-foreground"
          initial={animate ? { opacity: 0 } : false}
          animate={shouldAnimate ? { opacity: 1 } : undefined}
          transition={{ duration: 0.5, delay: 0.6 }}
        >
          <span className="inline-flex items-center gap-2">
            <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-success/15 text-success">
              <Check className="w-3 h-3" strokeWidth={3} />
            </span>
            Yes
          </span>
          <span className="inline-flex items-center gap-2">
            <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-muted text-muted-foreground">
              <Minus className="w-3 h-3" strokeWidth={3} />
            </span>
            Sometimes / Varies
          </span>
          <span className="inline-flex items-center gap-2">
            <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-destructive/10 text-destructive/70">
              <X className="w-3 h-3" strokeWidth={3} />
            </span>
            No
          </span>
        </motion.div>
      </div>
    </section>
  );
};

export default CompetitorComparison;
