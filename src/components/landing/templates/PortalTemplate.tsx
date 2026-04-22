import { motion } from "framer-motion";
import { DollarSign, Wrench, Repeat, Search, Car, ArrowRight } from "lucide-react";
import { useSiteConfig } from "@/hooks/useSiteConfig";
import SellCarForm from "@/components/SellCarForm";
import { DefaultBelowFold } from "../sharedSections";

/**
 * PORTAL — OEM brand-portal split (Dealer.com / Ansira / GM iMR style).
 * White-dominant. Left half: a single hero photo placeholder of "the model
 * line." Right half: a stacked grid of action cards (Sell / Trade / Service
 * / Browse). Looks like the manufacturer's national site at dealer scale.
 */
const PortalTemplate = () => {
  const { config } = useSiteConfig();

  const cards = [
    { icon: DollarSign, label: "Sell My Car",  desc: "Get a real cash offer in 2 minutes",     anchor: "sell-car-form" },
    { icon: Repeat,    label: "Trade-In",     desc: "Apply your trade toward your next car",  href: "/trade" },
    { icon: Wrench,    label: "Service",      desc: "Schedule maintenance or repair",         href: "/service" },
    { icon: Search,    label: "Browse Cars",  desc: "See current inventory",                  href: config.website_url || "#" },
  ];

  return (
    <>
      <section className="relative bg-background overflow-hidden">
        <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-8 px-5 py-14 lg:py-20">
          {/* Left: hero photo placeholder */}
          <motion.div
            initial={{ opacity: 0, x: -16 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.55 }}
            className="lg:col-span-7"
          >
            <div className="relative aspect-[16/11] rounded-2xl overflow-hidden bg-gradient-to-br from-primary/85 via-[hsl(220,30%,18%)] to-[hsl(220,40%,8%)]">
              <div className="absolute inset-0 flex items-end justify-center pb-12 opacity-40">
                <Car className="w-3/4 h-3/4 text-primary-foreground" strokeWidth={0.8} />
              </div>
              <div className="absolute top-5 left-5 text-primary-foreground">
                <div className="text-[10px] font-bold tracking-[0.25em] uppercase opacity-80">{config.dealership_name}</div>
                <div className="font-display text-3xl lg:text-4xl font-extrabold mt-1">The model line</div>
              </div>
            </div>
          </motion.div>

          {/* Right: stacked CTA cards */}
          <motion.div
            initial={{ opacity: 0, x: 16 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.55, delay: 0.1 }}
            className="lg:col-span-5 grid grid-cols-2 gap-3 self-center"
          >
            {cards.map((c) => {
              const Icon = c.icon;
              const inner = (
                <div className="h-full rounded-xl border border-border bg-card hover:border-primary/40 hover:shadow-md transition-all p-4 flex flex-col items-start gap-2 cursor-pointer group">
                  <div className="w-9 h-9 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
                    <Icon className="w-4.5 h-4.5" />
                  </div>
                  <div className="font-bold text-card-foreground">{c.label}</div>
                  <div className="text-xs text-muted-foreground leading-snug flex-1">{c.desc}</div>
                  <ArrowRight className="w-4 h-4 text-primary opacity-0 group-hover:opacity-100 transition-opacity self-end" />
                </div>
              );
              if (c.anchor) {
                return (
                  <button
                    key={c.label}
                    type="button"
                    onClick={() => document.getElementById(c.anchor!)?.scrollIntoView({ behavior: "smooth" })}
                    className="text-left"
                  >
                    {inner}
                  </button>
                );
              }
              return (
                <a key={c.label} href={c.href} className="block">
                  {inner}
                </a>
              );
            })}
          </motion.div>
        </div>
      </section>

      <section id="sell-car-form" className="bg-muted/30 py-16 px-5">
        <div className="max-w-[560px] mx-auto rounded-2xl bg-card shadow border border-border overflow-hidden">
          <SellCarForm variant="split" />
        </div>
      </section>

      <DefaultBelowFold />
    </>
  );
};

export default PortalTemplate;
