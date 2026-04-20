import { Search, Car, DollarSign, Clock } from "lucide-react";
import { motion } from "framer-motion";
import { useSiteConfig } from "@/hooks/useSiteConfig";
import SellCarForm from "@/components/SellCarForm";
import { DefaultBelowFold } from "../sharedSections";

const quickStats = [
  { icon: Car, label: "Any Make, Any Model", desc: "We buy every brand" },
  { icon: DollarSign, label: "Top-Dollar Offers", desc: "Real-time market data" },
  { icon: Clock, label: "Offer in 2 Minutes", desc: "No callbacks, no wait" },
];

const InventoryTemplate = () => {
  const { config } = useSiteConfig();

  const scrollToForm = () => {
    document.getElementById("sell-car-form")?.scrollIntoView({ behavior: "smooth", block: "start" });
    const firstInput = document.querySelector<HTMLInputElement>("#sell-car-form input, #sell-car-form [role=combobox]");
    setTimeout(() => firstInput?.focus(), 400);
  };

  return (
    <>
      {/* Search-bar hero */}
      <section className="relative bg-gradient-to-b from-primary to-[hsl(210,100%,28%)] text-primary-foreground pt-14 pb-24 px-5">
        <div className="max-w-4xl mx-auto text-center">
          <motion.h1
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="font-display text-[32px] md:text-[44px] lg:text-[52px] font-extrabold tracking-tight leading-tight mb-4 uppercase"
          >
            {config.hero_headline || "What's Your Car Worth?"}
          </motion.h1>
          <p className="text-base md:text-lg opacity-90 mb-8 max-w-2xl mx-auto">
            {config.hero_subtext || "Enter your plate or VIN and get a guaranteed cash offer in two minutes."}
          </p>

          {/* Decorative "search" CTA — clicking focuses the real form below */}
          <motion.button
            initial={{ opacity: 0, scale: 0.97 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.1, duration: 0.45 }}
            onClick={scrollToForm}
            className="group relative w-full max-w-2xl mx-auto bg-white text-foreground rounded-full shadow-2xl px-6 py-5 flex items-center gap-4 text-left hover:shadow-[0_25px_60px_-15px_rgba(0,0,0,0.45)] transition-shadow"
          >
            <Search className="w-6 h-6 text-primary flex-shrink-0" />
            <div className="flex-1">
              <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">License plate or VIN</div>
              <div className="text-base md:text-lg text-muted-foreground">
                e.g. ABC 1234 &nbsp;·&nbsp; 1HGCM82633A123456
              </div>
            </div>
            <span className="hidden md:inline-flex items-center bg-accent text-accent-foreground font-bold px-6 py-2.5 rounded-full group-hover:bg-accent/90">
              Get My Cash Offer
            </span>
          </motion.button>

          <p className="text-xs opacity-75 mt-4">
            Or &nbsp;·&nbsp;
            <button onClick={scrollToForm} className="underline hover:opacity-100">
              Enter year / make / model instead
            </button>
          </p>
        </div>
      </section>

      {/* Quick stats strip — builds confidence between search and form */}
      <section className="bg-card border-b border-border py-8 px-5">
        <div className="max-w-5xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-6">
          {quickStats.map((s, i) => {
            const Icon = s.icon;
            return (
              <div key={i} className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-primary/10 text-primary flex items-center justify-center flex-shrink-0">
                  <Icon className="w-6 h-6" />
                </div>
                <div>
                  <div className="font-bold text-card-foreground">{s.label}</div>
                  <div className="text-sm text-muted-foreground">{s.desc}</div>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Full form */}
      <section id="sell-car-form" className="py-14 lg:py-20 px-5 bg-background">
        <div className="max-w-[560px] mx-auto">
          <div className="text-center mb-6">
            <h2 className="font-display text-2xl md:text-3xl font-extrabold">Start Your Appraisal</h2>
            <p className="text-sm text-muted-foreground mt-1">Takes less than two minutes.</p>
          </div>
          <div className="rounded-2xl shadow-lg">
            <SellCarForm variant="split" />
          </div>
        </div>
      </section>

      <DefaultBelowFold />
    </>
  );
};

export default InventoryTemplate;
