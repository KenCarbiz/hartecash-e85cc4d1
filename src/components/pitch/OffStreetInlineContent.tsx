import { motion } from "framer-motion";
import {
  Car, ArrowRight, CheckCircle2, Globe, Smartphone,
  Clock, Shield, Camera, DollarSign, LayoutDashboard,
  Star, TrendingUp, ChevronUp, Zap, Users, FileText,
  MapPin, Award
} from "lucide-react";
import SourceTip from "./SourceTip";
import screenshotLanding from "@/assets/pitch/screenshot-landing.png";
import screenshotPortal from "@/assets/pitch/screenshot-portal.jpg";
import screenshotDashboard from "@/assets/pitch/screenshot-dashboard.jpg";

const fadeUp = {
  hidden: { opacity: 0, y: 40 },
  visible: (i: number) => ({
    opacity: 1, y: 0,
    transition: { delay: i * 0.12, duration: 0.7, ease: "easeOut" as const },
  }),
};

function GlowBadge({ label, color = "blue" }: { label: string; color?: string }) {
  const colors: Record<string, string> = {
    blue: "border-blue-500/30 text-blue-400 bg-blue-500/10",
    amber: "border-amber-500/30 text-amber-400 bg-amber-500/10",
    emerald: "border-emerald-500/30 text-emerald-400 bg-emerald-500/10",
  };
  const dotColors: Record<string, string> = {
    blue: "bg-blue-400",
    amber: "bg-amber-400",
    emerald: "bg-emerald-400",
  };
  return (
    <div className={`inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-bold tracking-widest uppercase mb-8 border ${colors[color]} backdrop-blur-sm`}>
      <span className={`w-1.5 h-1.5 rounded-full ${dotColors[color]} animate-pulse`} />
      {label}
    </div>
  );
}

export default function OffStreetInlineContent({ onBackToTop }: { onBackToTop: () => void }) {
  return (
    <div className="bg-[hsl(220,25%,6%)] text-white">
      {/* Hero */}
      <section className="relative overflow-hidden px-6 py-20 md:py-28 text-center">
        <div className="absolute top-1/4 left-1/4 w-[600px] h-[600px] rounded-full bg-blue-600/10 blur-[150px] pointer-events-none" />
        <div className="absolute bottom-1/4 right-1/4 w-[400px] h-[400px] rounded-full bg-indigo-600/10 blur-[120px] pointer-events-none" />
        <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} className="relative max-w-5xl mx-auto">
          <motion.div variants={fadeUp} custom={0.5}>
            <GlowBadge label="Off-Street Acquisition" color="blue" />
          </motion.div>
          <motion.h1 variants={fadeUp} custom={1} className="text-4xl md:text-6xl lg:text-7xl font-black leading-[0.95] tracking-tight mb-8">
            Buy Cars{" "}
            <span className="bg-gradient-to-r from-blue-400 via-indigo-400 to-blue-500 bg-clip-text text-transparent">
              Directly
            </span>
            <br />From Consumers
          </motion.h1>
          <motion.p variants={fadeUp} custom={2} className="text-lg md:text-xl text-white/50 max-w-2xl mx-auto mb-12 leading-relaxed">
            Your own branded platform where anyone can sell their car to your dealership — no trade-in required. Skip the auction, skip the middleman.
          </motion.p>
          <motion.div variants={fadeUp} custom={3} className="flex flex-wrap items-center justify-center gap-8 text-sm text-white/40">
            {[
              { icon: Globe, label: "Your Brand, Your Domain" },
              { icon: DollarSign, label: "Instant Offers" },
              { icon: Camera, label: "Guided Photo Upload" },
              { icon: Shield, label: "Full Deal Pipeline" },
            ].map(({ icon: I, label }) => (
              <span key={label} className="flex items-center gap-2">
                <I className="w-4 h-4 text-blue-400" />{label}
              </span>
            ))}
          </motion.div>
        </motion.div>
      </section>

      {/* Why Direct */}
      <section className="px-6 py-20 md:py-28 relative">
        <div className="max-w-5xl mx-auto">
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }}>
            <GlowBadge label="Why Direct?" color="blue" />
            <motion.h2 variants={fadeUp} custom={0} className="text-3xl md:text-5xl font-black mb-6 leading-tight">
              Auctions Are Expensive.{" "}
              <span className="text-blue-400">Consumers Are Not.</span>
            </motion.h2>
            <motion.p variants={fadeUp} custom={1} className="text-lg text-white/50 max-w-2xl mb-14">
              Every unit sourced at auction costs $1,000–$2,300 in fees, transport, and arbitration risk. Consumer-direct units arrive pre-inspected with full history — and they cost a fraction.
            </motion.p>
            <motion.div variants={fadeUp} custom={2} className="grid md:grid-cols-2 gap-6">
              <div className="rounded-2xl p-8 bg-red-500/5 border border-red-500/20">
                <h3 className="font-bold text-lg mb-4 text-red-400">❌ Auction Path</h3>
                <ul className="space-y-3 text-sm text-white/50">
                  {["$500–$1,200 buyer fees", "$300–$600 transport", "Unknown history & condition", "Arbitration risk & return costs", "3–7 day delivery delay", "Competing against 100+ dealers"].map(item => (
                    <li key={item} className="flex items-start gap-2"><span className="text-red-400 mt-0.5">•</span>{item}</li>
                  ))}
                </ul>
              </div>
              <div className="rounded-2xl p-8 bg-blue-500/5 border border-blue-500/20">
                <h3 className="font-bold text-lg mb-4 text-blue-400">✅ Consumer-Direct Path</h3>
                <ul className="space-y-3 text-sm text-white/50">
                  {["$0 buyer fees", "$0 transport — they drive it in", "Full owner history & disclosure", "Photos + condition before purchase", "Same-day acquisition possible", "You're the only buyer at the table"].map(item => (
                    <li key={item} className="flex items-start gap-2"><span className="text-blue-400 mt-0.5">•</span>{item}</li>
                  ))}
                </ul>
              </div>
            </motion.div>
          </motion.div>
        </div>
      </section>

      {/* Customer Journey */}
      <section className="px-6 py-20 md:py-28 bg-[hsl(220,25%,8%)] relative">
        <div className="max-w-5xl mx-auto">
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }}>
            <GlowBadge label="Customer Journey" color="emerald" />
            <motion.h2 variants={fadeUp} custom={0} className="text-3xl md:text-5xl font-black mb-14 leading-tight text-center">
              From <span className="text-emerald-400">Curiosity</span> to{" "}
              <span className="text-blue-400">Check</span> — in Minutes
            </motion.h2>
            <motion.div variants={fadeUp} custom={1} className="grid md:grid-cols-2 gap-8">
              <div className="space-y-1">
                {[
                  { num: 1, icon: Globe, title: "Lands on Your Branded Page", desc: "SEO, social ads, or word of mouth. They visit yourdealer.com/sell — your logo, your brand, your trust." },
                  { num: 2, icon: Car, title: "Enters Vehicle Info", desc: "VIN decode or Year/Make/Model. Mileage, condition checkboxes, and damage disclosure — all guided." },
                  { num: 3, icon: DollarSign, title: "Gets an Instant Offer", desc: "Powered by your pricing engine with Black Book data. Offer is displayed immediately with an 8-day guarantee." },
                  { num: 4, icon: Camera, title: "Uploads Photos", desc: "Ghost car overlay guides them through every angle. AI damage detection flags issues before you even look." },
                  { num: 5, icon: FileText, title: "Uploads Documents", desc: "Driver's license, title, and registration — with OCR auto-fill. Everything your title clerk needs." },
                  { num: 6, icon: Star, title: "Accepts & Schedules", desc: "Customer accepts the offer on their portal, picks a location and time, and shows up ready to sign." },
                ].map((step) => (
                  <div key={step.num} className="flex gap-4 pb-6">
                    <div className="flex flex-col items-center shrink-0">
                      <div className="w-11 h-11 rounded-xl flex items-center justify-center font-black text-base bg-blue-500/20 text-blue-400">
                        {step.num}
                      </div>
                      {step.num < 6 && <div className="w-0.5 flex-1 mt-2 bg-white/10" />}
                    </div>
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <step.icon className="w-4 h-4 text-blue-400" />
                        <h3 className="font-bold">{step.title}</h3>
                      </div>
                      <p className="text-sm text-white/50 leading-relaxed">{step.desc}</p>
                    </div>
                  </div>
                ))}
              </div>

              <div className="space-y-4">
                <div className="rounded-2xl overflow-hidden border border-white/10 shadow-2xl shadow-blue-500/10">
                  <img src={screenshotLanding} alt="Branded landing page" className="w-full" />
                </div>
                <div className="rounded-2xl overflow-hidden border border-white/10 shadow-2xl shadow-blue-500/10">
                  <img src={screenshotPortal} alt="Customer portal" className="w-full" />
                </div>
              </div>
            </motion.div>
          </motion.div>
        </div>
      </section>

      {/* Platform Features */}
      <section className="px-6 py-20 md:py-28 relative">
        <div className="max-w-5xl mx-auto">
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }}>
            <GlowBadge label="Platform Strengths" color="blue" />
            <motion.h2 variants={fadeUp} custom={0} className="text-3xl md:text-5xl font-black mb-14 leading-tight text-center">
              Everything You Need.{" "}
              <span className="text-blue-400">Nothing You Don't.</span>
            </motion.h2>
            <motion.div variants={fadeUp} custom={1} className="grid md:grid-cols-3 gap-6">
              {[
                { icon: Globe, title: "100% White-Label", desc: "Your domain, your logo, your colors. Customers never see our brand — only yours." },
                { icon: Zap, title: "Instant Offers", desc: "Black Book integration with configurable pricing models. Offer calculated in real-time." },
                { icon: Camera, title: "AI Damage Detection", desc: "Computer vision analyzes every photo and flags dents, scratches, and paint issues automatically." },
                { icon: MapPin, title: "Multi-Location Routing", desc: "ZIP-code and OEM brand matching routes every submission to the right store automatically." },
                { icon: Users, title: "Role-Based Access", desc: "Managers, appraisers, and BDC staff each see exactly what they need — nothing more." },
                { icon: Award, title: "Referral Program", desc: "Built-in referral tracking with unique codes. Reward customers who send you more inventory." },
              ].map(({ icon: I, title, desc }) => (
                <div key={title} className="rounded-2xl p-6 bg-white/5 border border-white/10 hover:border-blue-400/30 transition-colors">
                  <div className="w-12 h-12 rounded-xl bg-blue-500/20 flex items-center justify-center mb-4">
                    <I className="w-6 h-6 text-blue-400" />
                  </div>
                  <h3 className="font-bold text-lg mb-2">{title}</h3>
                  <p className="text-sm text-white/50 leading-relaxed">{desc}</p>
                </div>
              ))}
            </motion.div>
          </motion.div>
        </div>
      </section>

      {/* ROI */}
      <section className="px-6 py-20 md:py-28 bg-[hsl(220,25%,8%)] relative">
        <div className="max-w-5xl mx-auto">
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }}>
            <GlowBadge label="Bottom Line Impact" color="emerald" />
            <motion.h2 variants={fadeUp} custom={0} className="text-3xl md:text-5xl font-black mb-6 leading-tight text-center">
              Every Direct Unit Saves{" "}
              <span className="text-emerald-400">~$2,000</span>
            </motion.h2>
            <motion.p variants={fadeUp} custom={1} className="text-lg text-white/50 max-w-3xl mx-auto mb-14 text-center leading-relaxed">
              <SourceTip source="Carvana Q3 2019 earnings" detail="31% of units sourced from consumers">
                Carvana sources 31%
              </SourceTip>{" "}of inventory directly from consumers.{" "}
              <SourceTip source="CarMax FY26 10-Q" detail="87% of units sourced from consumers">
                CarMax sources 87%
              </SourceTip>. The off-street channel is your largest volume opportunity.
            </motion.p>

            <motion.div variants={fadeUp} custom={2} className="grid md:grid-cols-3 gap-6">
              {[
                { size: "Small Dealer", units: "~50 used/mo", direct: "16", monthly: "$32K", annual: "$384K" },
                { size: "Mid-Size Dealer", units: "~150 used/mo", direct: "47", monthly: "$94K", annual: "$1.13M", highlight: true },
                { size: "High-Volume Group", units: "~400 used/mo", direct: "124", monthly: "$248K", annual: "$2.98M" },
              ].map((tier) => (
                <div key={tier.size} className={`rounded-2xl p-6 text-center ${tier.highlight ? "bg-emerald-500/10 border-2 border-emerald-500/30 relative" : "bg-white/5 border border-white/10"}`}>
                  {tier.highlight && <span className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-0.5 rounded-full bg-emerald-500 text-[10px] font-bold uppercase tracking-widest text-white">Most Common</span>}
                  <div className="text-xs font-bold uppercase tracking-widest text-white/40 mb-2">{tier.size}</div>
                  <div className="text-white/30 text-xs mb-4">{tier.units}</div>
                  <div className="text-sm text-white/40 mb-4">~{tier.direct} direct/mo × $2K saved</div>
                  <div className="border-t border-white/10 pt-4">
                    <div className="text-2xl font-black text-emerald-400 mb-1">{tier.monthly}/mo</div>
                    <div className="text-4xl font-black text-emerald-400">{tier.annual}</div>
                    <div className="text-xs text-emerald-400/70 font-bold mt-1">Additional annual profit</div>
                  </div>
                </div>
              ))}
            </motion.div>
          </motion.div>
        </div>
      </section>

      {/* Back to Top */}
      <section className="px-6 py-16 text-center border-t border-white/5">
        <button
          onClick={onBackToTop}
          className="inline-flex items-center gap-2 px-8 py-4 rounded-full border border-white/20 text-white font-bold text-lg hover:bg-white/5 transition-colors"
        >
          <ChevronUp className="w-5 h-5" /> Back to All Three Channels
        </button>
      </section>
    </div>
  );
}
