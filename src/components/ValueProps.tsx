import { DollarSign, Clock, Truck, ShieldCheck, Shield } from "lucide-react";
import { useSiteConfig } from "@/hooks/useSiteConfig";

const ValueProps = () => {
  const { config } = useSiteConfig();
  const shortName = (config.dealership_name || "Us").split(" ")[0];
  const days = config.price_guarantee_days || 8;
  const items = [
    {
      icon: Shield,
      title: `${days}-Day Price Guarantee`,
      desc: `Your offer is locked in for ${days} full days. No pressure, no surprises — sell on your schedule.`,
      highlight: true,
      color: "text-success",
      bg: "bg-success/10 border-success/25",
    },
    {
      icon: DollarSign,
      title: "Top Dollar Guaranteed",
      desc: "We use real-time market data to ensure you get the best price.",
      color: "text-primary",
      bg: "bg-card",
    },
    {
      icon: Clock,
      title: "Offer in 2 Minutes",
      desc: "No waiting around — get your cash offer almost instantly.",
      color: "text-primary",
      bg: "bg-card",
    },
    {
      icon: Truck,
      title: "Free Pickup",
      desc: "We come to your home or office. Zero hassle on your end. Available on select transactions.",
      color: "text-primary",
      bg: "bg-card",
    },
    {
      icon: ShieldCheck,
      title: "Trusted Dealership",
      desc: "Family-owned since 1952. Thousands of happy customers.",
      color: "text-primary",
      bg: "bg-card",
    },
  ];

  return (
    <section id="value-props" className="py-16 lg:py-20 px-5 bg-background">
      <div className="text-center mb-12">
        <span className="inline-block text-xs font-bold uppercase tracking-[0.2em] text-primary mb-3">The {shortName} Advantage</span>
        <h2 className="font-display text-2xl md:text-[28px] lg:text-[34px] font-extrabold text-foreground tracking-[0.04em]">
          Why Sell to {shortName}?
        </h2>
      </div>
      <div className="grid gap-4 max-w-[500px] lg:max-w-4xl lg:grid-cols-2 xl:grid-cols-3 mx-auto">
        {items.map((item, i) => {
          const Icon = item.icon;
          return (
            <div
              key={i}
              className={`flex items-start gap-4 p-5 rounded-xl border transition-all duration-300 hover:shadow-md hover:-translate-y-0.5 ${
                item.highlight
                  ? `${item.bg} border-2 lg:col-span-2 xl:col-span-1`
                  : `${item.bg} border-border/50 hover:border-primary/20`
              }`}
            >
              <div className={`flex-shrink-0 mt-1 w-10 h-10 rounded-lg flex items-center justify-center ${item.highlight ? "bg-success/15" : "bg-primary/10"}`}>
                <Icon className={`w-5 h-5 ${item.color}`} />
              </div>
              <div>
                <h3 className="text-base font-bold mb-1 text-card-foreground">
                  {item.title}
                </h3>
                <p className="text-sm text-foreground/70 leading-relaxed">{item.desc}</p>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
};

export default ValueProps;
