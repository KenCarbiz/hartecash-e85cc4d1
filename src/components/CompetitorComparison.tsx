import { useEffect, useState, useRef } from "react";
import { Check, X, Minus } from "lucide-react";
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

  // Sensible defaults so the wedge always renders, even before a
  // dealer customizes their own comparison rows in the admin. The
  // section disappeared in production around mid-April 2026 because
  // dealers' comparison_features columns were null and the component
  // was silently early-returning. Defaults restore the original
  // hartecash.com "Why X Wins" wedge against CarMax / Carvana /
  // Private Sale across the seven points the page historically used.
  // Each row is [us, CarMax, Carvana, Private Sale]. true = yes,
  // false = no, "partial" = sometimes/varies.
  const DEFAULT_COLUMNS = ["CarMax", "Carvana", "Private Sale"];
  // Whether the dealer offers free at-home pickup. When the toggle is
  // off, swap the row label to in-person drop-off so the wedge stays
  // honest. Default true preserves historical hartecash.com behavior.
  const pickupOffered = config.pickup_offered !== false;
  const DEFAULT_FEATURES: ComparisonFeature[] = [
    { label: "Real cash offer in 2 minutes",       values: [true,  "partial", true,  false] },
    pickupOffered
      ? { label: "Free at-home pickup",            values: [true,  false,     true,  false] }
      : { label: "Quick in-person drop-off",       values: [true,  true,      false, "partial"] },
    { label: "We pay the loan payoff",             values: [true,  true,      true,  false] },
    { label: "Same-day payment",                   values: [true,  true,      "partial", "partial"] },
    { label: "Offer good for 7 days",              values: [true,  true,      true,  false] },
    { label: "No haggling or trade-in pressure",   values: [true,  true,      true,  false] },
    { label: "Local family-owned, not a corporation", values: [true, false, false, true] },
  ];

  const [columns, setColumns] = useState<string[]>(DEFAULT_COLUMNS);
  const [features, setFeatures] = useState<ComparisonFeature[]>(DEFAULT_FEATURES);
  const [loaded, setLoaded] = useState(false);

  const sectionRef = useRef<HTMLElement>(null);
  const isInView = useInView(sectionRef, { once: true, amount: 0.2 });

  useEffect(() => {
    supabase
      .from("site_config")
      .select("competitor_columns, comparison_features")
      .eq("dealership_id", tenant.dealership_id)
      .maybeSingle()
      .then(({ data }) => {
        if (data) {
          const d = data as any;
          // Only override defaults when the dealer has provided
          // a non-empty array — empty/null keeps the defaults visible.
          if (Array.isArray(d.competitor_columns) && d.competitor_columns.length > 0) {
            setColumns(d.competitor_columns);
          }
          if (Array.isArray(d.comparison_features) && d.comparison_features.length > 0) {
            setFeatures(d.comparison_features);
          }
        }
        setLoaded(true);
      });
  }, []);

  // We no longer early-return when features is empty — DEFAULT_FEATURES
  // guarantees there's always something to show. We still wait for the
  // initial fetch to settle so we don't flash defaults when the dealer
  // has custom data on the way.
  if (!loaded) return null;

  const CellIcon = ({ value }: { value: boolean | string }) => {
    if (value === true) return <Check className="w-5 h-5 text-success mx-auto" />;
    if (value === "partial") return <Minus className="w-5 h-5 text-muted-foreground mx-auto" />;
    return <X className="w-5 h-5 text-destructive/60 mx-auto" />;
  };

  const colWidth = `${Math.floor(60 / (columns.length + 1))}%`;

  const shouldAnimate = animate && isInView;

  return (
    <section ref={sectionRef} className="bg-background px-5 py-14" id="compare">
      <div className="max-w-3xl mx-auto">
        <motion.h2
          className="font-display text-2xl md:text-3xl font-extrabold text-foreground text-center mb-2 tracking-[0.04em]"
          initial={animate ? { opacity: 0, y: 16, filter: "blur(4px)" } : false}
          animate={shouldAnimate ? { opacity: 1, y: 0, filter: "blur(0px)" } : undefined}
          transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
        >
          Why {shortName} Wins
        </motion.h2>
        <motion.p
          className="text-center text-muted-foreground mb-8 text-sm"
          initial={animate ? { opacity: 0, y: 12 } : false}
          animate={shouldAnimate ? { opacity: 1, y: 0 } : undefined}
          transition={{ duration: 0.6, delay: 0.08, ease: [0.16, 1, 0.3, 1] }}
        >
          See how we stack up against the competition.
        </motion.p>

        <motion.div
          className="bg-card rounded-xl shadow-lg border border-border overflow-hidden"
          initial={animate ? { opacity: 0, y: 20, filter: "blur(4px)" } : false}
          animate={shouldAnimate ? { opacity: 1, y: 0, filter: "blur(0px)" } : undefined}
          transition={{ duration: 0.7, delay: 0.15, ease: [0.16, 1, 0.3, 1] }}
        >
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b-2 border-border">
                  <th className="text-left px-4 py-3 font-semibold text-muted-foreground w-[40%]">Feature</th>
                  <th className="text-center px-3 py-3 font-bold text-accent" style={{ width: colWidth }}>
                    <span className="block text-xs uppercase tracking-wider">{shortName}</span>
                  </th>
                  {columns.map((col, i) => (
                    <th key={i} className="text-center px-3 py-3 font-semibold text-muted-foreground" style={{ width: colWidth }}>
                      <span className="block text-xs uppercase tracking-wider">{col}</span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {features.map((f, i) => (
                  <motion.tr
                    key={i}
                    className="border-b border-border last:border-0 hover:bg-muted/30 transition-colors"
                    initial={animate ? { opacity: 0, x: -12 } : false}
                    animate={shouldAnimate ? { opacity: 1, x: 0 } : undefined}
                    transition={{
                      duration: 0.45,
                      delay: 0.25 + i * 0.07,
                      ease: [0.16, 1, 0.3, 1],
                    }}
                  >
                    <td className="px-4 py-3 font-medium text-card-foreground text-[13px]">{f.label}</td>
                    <td className="px-3 py-3 bg-accent/5"><CellIcon value={f.values[0]} /></td>
                    {columns.map((_, cIdx) => (
                      <td key={cIdx} className="px-3 py-3"><CellIcon value={f.values[cIdx + 1] ?? false} /></td>
                    ))}
                  </motion.tr>
                ))}
              </tbody>
            </table>
          </div>
        </motion.div>

        <motion.p
          className="text-center text-xs text-muted-foreground mt-4"
          initial={animate ? { opacity: 0 } : false}
          animate={shouldAnimate ? { opacity: 1 } : undefined}
          transition={{ duration: 0.5, delay: 0.6, ease: [0.16, 1, 0.3, 1] }}
        >
          <Minus className="w-3 h-3 inline mr-1" /> = Sometimes / Varies
        </motion.p>
      </div>
    </section>
  );
};

export default CompetitorComparison;
