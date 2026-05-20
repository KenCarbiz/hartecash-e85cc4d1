// Moto-aesthetic variant of TrustBadges.
//
// Visual rules (from the design-agent review):
//   * White bg, one accent (--primary) only — no gradient, no shimmer
//   * Numerals in primary color, hairline dividers between stats
//   * No icon chips, no backdrop-blur, no hover-scale animation
//   * Semantic <figure>/<figcaption> markup so each stat is a
//     crawlable unit rather than a giant orphan <p> number
//
// Same site_config wiring as the original TrustBadges so per-tenant
// data flows in identically — just visually quieted for the Moto template.
import AnimatedCounter from "../AnimatedCounter";
import { useSiteConfig } from "@/hooks/useSiteConfig";

const TrustBadgesLean = () => {
  const { config } = useSiteConfig();

  const carsNum = parseInt((config.stats_cars_purchased || "2400").replace(/[^0-9]/g, "")) || 2400;
  const carsSuffix = (config.stats_cars_purchased || "").replace(/[0-9,]/g, "").trim() || "+";
  const yearsFromEst = config.established_year ? new Date().getFullYear() - config.established_year : null;
  const yearsNum = yearsFromEst || parseInt((config.stats_years_in_business || "72").replace(/[^0-9]/g, "")) || 72;
  const yearsSuffix = yearsFromEst ? "+" : (config.stats_years_in_business || "").replace(/[0-9,]/g, "").trim() || " yrs";
  const ratingVal = parseFloat(config.stats_rating || "4.9") || 4.9;

  const stats = [
    { value: carsNum, suffix: carsSuffix, label: "Cars Purchased", isRating: false },
    { value: yearsNum, suffix: yearsSuffix, label: "In Business", isRating: false },
    { value: ratingVal, suffix: "★", label: "Rating", isRating: true },
  ];

  return (
    <section
      id="trust"
      aria-labelledby="trust-heading"
      className="py-20 lg:py-24 px-5 bg-background border-t border-border/60"
    >
      <h2 id="trust-heading" className="sr-only">Trust signals</h2>
      <div className="max-w-4xl mx-auto grid grid-cols-3 divide-x divide-border/60">
        {stats.map((s, i) => (
          <figure key={i} className="text-center px-4">
            <p className="text-3xl lg:text-5xl font-semibold text-primary tracking-tight tabular-nums">
              {s.isRating ? (
                <span>{s.value}{s.suffix}</span>
              ) : (
                <AnimatedCounter target={s.value as number} suffix={s.suffix} />
              )}
            </p>
            <figcaption className="text-sm text-muted-foreground mt-2 font-medium">
              {s.label}
            </figcaption>
          </figure>
        ))}
      </div>
    </section>
  );
};

export default TrustBadgesLean;
