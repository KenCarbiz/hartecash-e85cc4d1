import AnimatedCounter from "./AnimatedCounter";
import { ShieldCheck, Award, Users } from "lucide-react";
import { useSiteConfig } from "@/hooks/useSiteConfig";

const TrustBadges = () => {
  const { config } = useSiteConfig();

  const carsNum = parseInt((config.stats_cars_purchased || "2400").replace(/[^0-9]/g, "")) || 2400;
  const carsSuffix = (config.stats_cars_purchased || "").replace(/[0-9,]/g, "").trim() || "+";
  const yearsFromEst = config.established_year ? new Date().getFullYear() - config.established_year : null;
  const yearsNum = yearsFromEst || parseInt((config.stats_years_in_business || "72").replace(/[^0-9]/g, "")) || 72;
  const yearsSuffix = yearsFromEst ? "+" : (config.stats_years_in_business || "").replace(/[0-9,]/g, "").trim() || " yrs";
  const ratingVal = parseFloat(config.stats_rating || "4.9") || 4.9;

  const stats = [
    { icon: Users, value: carsNum, suffix: carsSuffix, label: "Cars Purchased" },
    { icon: Award, value: yearsNum, suffix: yearsSuffix, label: "In Business" },
    { icon: ShieldCheck, value: ratingVal, suffix: "★", label: "Rating" },
  ];

  return (
    <section id="trust" className="py-12 lg:py-14 px-5 bg-gradient-to-br from-primary via-primary to-[hsl(210,100%,18%)] relative overflow-hidden">
      {/* Subtle shimmer overlay */}
      <div className="absolute inset-0 bg-[linear-gradient(135deg,transparent_40%,hsl(0,0%,100%,0.04)_50%,transparent_60%)] pointer-events-none" />
      
      <div className="max-w-[600px] lg:max-w-4xl mx-auto grid grid-cols-3 gap-4 text-center relative">
        {stats.map((s, i) => (
          <div key={i} className="text-primary-foreground group">
            <div className="inline-flex items-center justify-center w-12 h-12 lg:w-14 lg:h-14 rounded-xl bg-primary-foreground/10 backdrop-blur-sm mb-3 transition-transform duration-300 group-hover:scale-110">
              <s.icon className="w-6 h-6 lg:w-7 lg:h-7 opacity-90" />
            </div>
            <p className="text-2xl md:text-3xl lg:text-4xl font-extrabold">
              {s.value === ratingVal && s.label === "Rating" ? (
                <span>{s.value}{s.suffix}</span>
              ) : (
                <AnimatedCounter target={s.value} suffix={s.suffix} />
              )}
            </p>
            <p className="text-xs lg:text-sm opacity-60 mt-1.5 font-medium tracking-wide uppercase">{s.label}</p>
          </div>
        ))}
      </div>
    </section>
  );
};

export default TrustBadges;
