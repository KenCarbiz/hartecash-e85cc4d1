import AnimatedCounter from "./AnimatedCounter";
import { ShieldCheck, Award, Users } from "lucide-react";

const TrustBadges = () => {
  const stats = [
    { icon: Users, value: 2400, suffix: "+", label: "Cars Purchased" },
    { icon: Award, value: 72, suffix: " yrs", label: "In Business" },
    { icon: ShieldCheck, value: 4.9, suffix: "★", label: "Rating" },
  ];

  return (
    <section className="py-10 px-5 bg-primary">
      <div className="max-w-[600px] mx-auto grid grid-cols-3 gap-4 text-center">
        {stats.map((s, i) => (
          <div key={i} className="text-primary-foreground">
            <s.icon className="w-6 h-6 mx-auto mb-2 opacity-80" />
            <p className="text-2xl md:text-3xl font-extrabold">
              {s.value === 4.9 ? (
                <span>{s.value}{s.suffix}</span>
              ) : (
                <AnimatedCounter target={s.value} suffix={s.suffix} />
              )}
            </p>
            <p className="text-xs opacity-70 mt-1 font-medium">{s.label}</p>
          </div>
        ))}
      </div>
    </section>
  );
};

export default TrustBadges;
