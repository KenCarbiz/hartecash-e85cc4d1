import { motion } from "framer-motion";
import { Car, ArrowRight, ShieldCheck } from "lucide-react";
import { useSiteConfig } from "@/hooks/useSiteConfig";
import SellCarForm from "@/components/SellCarForm";
import { DefaultBelowFold } from "../sharedSections";

/**
 * SHOWROOM — inventory grid behind a translucent form card. Frames the
 * dealer as a showroom you can both sell to AND shop from. Inspired by
 * CarMax / AutoNation flagship sites where vehicle imagery dominates.
 *
 * The grid is decorative and uses placeholder gradient cards so it works
 * for any dealer regardless of inventory plumbing. When the dealer has
 * inventory imagery wired up, the placeholder tiles can be swapped for
 * real <img>s in a future iteration.
 */
const ShowroomTemplate = () => {
  const { config } = useSiteConfig();

  // Six placeholder vehicle tiles — alternating gradients so the grid
  // doesn't read as monochromatic. The slight Ken Burns animation creates
  // depth without needing real photos.
  const tiles = [
    { from: "hsl(220, 70%, 35%)", to: "hsl(220, 50%, 20%)" },
    { from: "hsl(0, 50%, 35%)",   to: "hsl(0, 30%, 20%)"   },
    { from: "hsl(40, 30%, 30%)",  to: "hsl(40, 20%, 18%)"  },
    { from: "hsl(180, 40%, 30%)", to: "hsl(180, 30%, 18%)" },
    { from: "hsl(280, 30%, 30%)", to: "hsl(280, 20%, 18%)" },
    { from: "hsl(120, 25%, 28%)", to: "hsl(120, 20%, 18%)" },
  ];

  return (
    <>
      {/* Hero with inventory grid background + translucent form card */}
      <section className="relative min-h-[100vh] overflow-hidden flex items-center bg-[hsl(220,30%,8%)]">
        {/* Inventory grid behind everything */}
        <div aria-hidden className="absolute inset-0 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-3 gap-2 p-2 opacity-70">
          {tiles.map((t, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 0.95, scale: 1 }}
              transition={{ duration: 0.7, delay: i * 0.08 }}
              className="rounded-xl overflow-hidden relative"
              style={{
                background: `linear-gradient(135deg, ${t.from}, ${t.to})`,
                minHeight: "32vh",
              }}
            >
              {/* Faux vehicle silhouette */}
              <div className="absolute inset-0 flex items-end justify-center pb-6 opacity-40">
                <Car className="w-2/3 h-2/3 text-white/50" strokeWidth={0.6} />
              </div>
            </motion.div>
          ))}
        </div>

        {/* Dim overlay so the form card sits readable */}
        <div aria-hidden className="absolute inset-0 bg-gradient-to-b from-[hsl(220,30%,8%)]/70 via-[hsl(220,30%,8%)]/55 to-[hsl(220,30%,8%)]/85" />

        {/* Centered headline + form card */}
        <div className="relative z-10 max-w-6xl mx-auto px-5 py-16 grid grid-cols-1 lg:grid-cols-12 gap-8 items-center w-full">
          <div className="lg:col-span-7 text-primary-foreground">
            <motion.h1
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
              className="font-display text-[40px] md:text-[60px] lg:text-[72px] font-extrabold leading-[0.95] tracking-tight"
            >
              {config.hero_headline || (
                <>
                  We buy yours.
                  <br />
                  <span className="text-accent">Then browse ours.</span>
                </>
              )}
            </motion.h1>
            <p className="text-lg md:text-xl text-primary-foreground/85 mt-6 max-w-xl">
              {config.hero_subtext ||
                "Get a real cash offer in two minutes — and shop our inventory while you're here. One-stop trade-up, zero pressure."}
            </p>
            <div className="mt-7 flex items-center gap-2 text-sm text-primary-foreground/80">
              <ShieldCheck className="w-4 h-4 text-success" />
              {config.price_guarantee_days}-day price guarantee · free pickup
            </div>
          </div>

          {/* Translucent form card */}
          <motion.div
            id="sell-car-form"
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.15 }}
            className="lg:col-span-5"
          >
            <div className="bg-background/95 backdrop-blur-xl rounded-2xl shadow-[0_30px_80px_-20px_rgba(0,0,0,0.6)] border border-primary-foreground/15 overflow-hidden">
              <div className="px-5 pt-4 pb-2 border-b border-border/30">
                <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-primary">Start here</div>
                <div className="text-base font-bold text-foreground mt-1">Get my cash offer</div>
              </div>
              <SellCarForm variant="split" />
            </div>
          </motion.div>
        </div>
      </section>

      {/* CTA strip — "browse our inventory" hand-off (decorative) */}
      <section className="bg-card border-y border-border py-8 px-5">
        <div className="max-w-5xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          <div>
            <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Already got your offer?</div>
            <div className="font-bold text-card-foreground text-lg">Browse our current inventory</div>
          </div>
          <a
            href={config.website_url || "#"}
            className="inline-flex items-center gap-2 bg-foreground text-background hover:bg-foreground/90 font-semibold text-sm px-5 py-2.5 rounded-full transition-colors"
          >
            See cars for sale <ArrowRight className="w-4 h-4" />
          </a>
        </div>
      </section>

      <DefaultBelowFold />
    </>
  );
};

export default ShowroomTemplate;
