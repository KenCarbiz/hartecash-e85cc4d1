import {
  DollarSign,
  Clock,
  Truck,
  ShieldCheck,
  Shield,
  Award,
  ThumbsUp,
  Users,
  Wrench,
  Heart,
  Star,
  MapPin,
  Banknote,
  type LucideIcon,
} from "lucide-react";
import { useSiteConfig, type ValueProp, type ValuePropIcon } from "@/hooks/useSiteConfig";

/** Map of icon-name → lucide component. Keep in sync with the
 *  ValuePropIcon union in useSiteConfig.ts and the icon picker in
 *  the admin (SiteConfiguration.tsx). */
const VALUE_PROP_ICONS: Record<ValuePropIcon, LucideIcon> = {
  shield: Shield,
  "shield-check": ShieldCheck,
  dollar: DollarSign,
  clock: Clock,
  truck: Truck,
  award: Award,
  "thumbs-up": ThumbsUp,
  users: Users,
  wrench: Wrench,
  heart: Heart,
  star: Star,
  "map-pin": MapPin,
  banknote: Banknote,
};

const ValueProps = () => {
  const { config } = useSiteConfig();
  const shortName = (config.dealership_name || "Us").split(" ")[0];
  const days = config.price_guarantee_days || 8;

  // Default 6 cards used when the dealer hasn't customized them.
  // First card is highlighted (elevated). Headers are bold; bodies
  // are regular weight per dealer feedback.
  const DEFAULT_CARDS: ValueProp[] = [
    {
      icon: "shield",
      title: `${days}-Day Price Guarantee`,
      body: `Your offer is locked in for ${days} full days. No pressure, no surprises — sell on your schedule.`,
      highlight: true,
    },
    {
      icon: "dollar",
      title: "Top Dollar Guaranteed",
      body: "We use real-time market data to ensure you get the best price.",
    },
    {
      icon: "clock",
      title: "Offer in 2 Minutes",
      body: "No waiting around — get your cash offer almost instantly.",
    },
    {
      icon: "truck",
      title: "Free Pickup",
      body: "We come to your home or office. Zero hassle on your end. Available on select transactions.",
    },
    {
      icon: "shield-check",
      title: "Trusted Dealership",
      body: "Family-owned since 1952. Thousands of happy customers.",
    },
    {
      icon: "banknote",
      title: "Same-Day Payment",
      body: "Money in your account the moment you accept — no waiting weeks for a check.",
    },
  ];

  const items: ValueProp[] =
    Array.isArray(config.value_props) && config.value_props.length > 0
      ? config.value_props.slice(0, 6)
      : DEFAULT_CARDS;

  return (
    <section id="value-props" className="py-16 lg:py-20 px-5 bg-background">
      <div className="text-center mb-12">
        <span className="inline-block text-xs font-bold uppercase tracking-[0.2em] text-primary mb-3">
          The {shortName} Advantage
        </span>
        <h2 className="font-display text-2xl md:text-[28px] lg:text-[34px] font-extrabold text-foreground tracking-[0.04em]">
          Why Sell to {shortName}?
        </h2>
      </div>
      <div className="grid gap-4 max-w-[500px] lg:max-w-4xl lg:grid-cols-2 xl:grid-cols-3 mx-auto">
        {items.map((item, i) => {
          const Icon = VALUE_PROP_ICONS[item.icon] || Shield;
          const isHighlight = !!item.highlight;
          return (
            <div
              key={i}
              className={`flex items-start gap-4 p-5 rounded-xl border transition-all duration-300 hover:shadow-md hover:-translate-y-0.5 ${
                isHighlight
                  ? "bg-success/10 border-success/25 border-2 lg:col-span-2 xl:col-span-1"
                  : "bg-card border-border/50 hover:border-primary/20"
              }`}
            >
              <div
                className={`flex-shrink-0 mt-1 w-10 h-10 rounded-lg flex items-center justify-center ${
                  isHighlight ? "bg-success/15" : "bg-primary/10"
                }`}
              >
                <Icon className={`w-5 h-5 ${isHighlight ? "text-success" : "text-primary"}`} />
              </div>
              <div>
                {/* Header bold; body regular per dealer's spec. */}
                <h3 className="text-base font-bold mb-1 text-card-foreground">
                  {item.title}
                </h3>
                <p className="text-sm font-normal text-foreground/70 leading-relaxed">
                  {item.body}
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
};

export default ValueProps;
