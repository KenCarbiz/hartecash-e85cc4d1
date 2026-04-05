import { motion } from "framer-motion";
import {
  Handshake, ArrowRight, CheckCircle2, Car, Users, Smartphone,
  Clock, Shield, Send, UserCheck, Camera, LayoutDashboard,
  Star, ArrowUpRight, MessageSquare, Zap, ChevronUp,
  TrendingUp, DollarSign, AlertTriangle
} from "lucide-react";
import SourceTip from "./SourceTip";
import screenshotDashboard from "@/assets/pitch/screenshot-dashboard.jpg";

const fadeUp = {
  hidden: { opacity: 0, y: 40 },
  visible: (i: number) => ({
    opacity: 1, y: 0,
    transition: { delay: i * 0.12, duration: 0.7, ease: "easeOut" as const },
  }),
};

function GlowBadge({ label, color = "amber" }: { label: string; color?: string }) {
  const colors: Record<string, string> = {
    amber: "border-amber-500/30 text-amber-400 bg-amber-500/10",
    blue: "border-blue-500/30 text-blue-400 bg-blue-500/10",
    emerald: "border-emerald-500/30 text-emerald-400 bg-emerald-500/10",
  };
  const dotColors: Record<string, string> = {
    amber: "bg-amber-400",
    blue: "bg-blue-400",
    emerald: "bg-emerald-400",
  };
  return (
    <div className={`inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-bold tracking-widest uppercase mb-8 border ${colors[color]} backdrop-blur-sm`}>
      <span className={`w-1.5 h-1.5 rounded-full ${dotColors[color]} animate-pulse`} />
      {label}
    </div>
  );
}

export default function TradePitchInlineContent({ onBackToTop }: { onBackToTop: () => void }) {
  return (
    <div className="bg-[hsl(220,25%,6%)] text-white">
      {/* Hero */}
      <section className="relative overflow-hidden px-6 py-20 md:py-28 text-center">
        <div className="absolute top-1/4 left-1/4 w-[600px] h-[600px] rounded-full bg-amber-600/10 blur-[150px] pointer-events-none" />
        <div className="absolute bottom-1/4 right-1/4 w-[400px] h-[400px] rounded-full bg-orange-600/10 blur-[120px] pointer-events-none" />
        <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} className="relative max-w-5xl mx-auto">
          <motion.div variants={fadeUp} custom={0.5}>
            <GlowBadge label="In-Store Trade Platform" />
          </motion.div>
          <motion.h1 variants={fadeUp} custom={1} className="text-4xl md:text-6xl lg:text-7xl font-black leading-[0.95] tracking-tight mb-8">
            Never Lose a{" "}
            <span className="bg-gradient-to-r from-amber-400 via-orange-400 to-amber-500 bg-clip-text text-transparent">
              Trade-In
            </span>
            <br />Again
          </motion.h1>
          <motion.p variants={fadeUp} custom={2} className="text-lg md:text-xl text-white/50 max-w-2xl mx-auto mb-12 leading-relaxed">
            Customers shopping your lot don't always have their trade with them. Now they can submit everything from home — before they arrive or after they leave.
          </motion.p>
          <motion.div variants={fadeUp} custom={3} className="flex flex-wrap items-center justify-center gap-8 text-sm text-white/40">
            {[
              { icon: Send, label: "Submit From Home" },
              { icon: UserCheck, label: "Linked to Sales Rep" },
              { icon: LayoutDashboard, label: "Feeds Your Dashboard" },
              { icon: Shield, label: "BDC Won't Touch It" },
            ].map(({ icon: I, label }) => (
              <span key={label} className="flex items-center gap-2">
                <I className="w-4 h-4 text-amber-400" />{label}
              </span>
            ))}
          </motion.div>
        </motion.div>
      </section>

      {/* The Problem */}
      <section className="px-6 py-20 md:py-28 relative">
        <div className="max-w-5xl mx-auto">
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }}>
            <GlowBadge label="The Problem" color="amber" />
            <motion.h2 variants={fadeUp} custom={0} className="text-3xl md:text-5xl font-black mb-6 leading-tight">
              Every Day, Trades <span className="text-amber-400">Fall Through the Cracks</span>
            </motion.h2>
            <motion.p variants={fadeUp} custom={1} className="text-lg text-white/50 max-w-2xl mb-14">
              A customer is excited about a new car but didn't bring their trade. They leave to "think about it." Days later, they bought somewhere else — or the deal just dies.
            </motion.p>
            <motion.div variants={fadeUp} custom={2} className="grid md:grid-cols-3 gap-6">
              {[
                { icon: Car, title: "Trade Not Present", desc: "Customer is shopping but their trade is at home, at work, or with a spouse. The deal stalls." },
                { icon: Clock, title: "Lost Momentum", desc: "Every hour between 'I'll come back' and actually returning, excitement fades and competitors close." },
                { icon: MessageSquare, title: "BDC Calls Kill It", desc: "If the lead goes to BDC, the customer gets cold-called and annoyed. They were already working with someone." },
              ].map(({ icon: I, title, desc }) => (
                <div key={title} className="rounded-2xl p-6 bg-white/5 border border-white/10">
                  <div className="w-12 h-12 rounded-xl bg-amber-500/20 flex items-center justify-center mb-4">
                    <I className="w-6 h-6 text-amber-400" />
                  </div>
                  <h3 className="font-bold text-lg mb-2">{title}</h3>
                  <p className="text-sm text-white/50 leading-relaxed">{desc}</p>
                </div>
              ))}
            </motion.div>
          </motion.div>
        </div>
      </section>

      {/* The Solution */}
      <section className="px-6 py-20 md:py-28 bg-[hsl(220,25%,8%)] relative">
        <div className="max-w-5xl mx-auto">
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }}>
            <GlowBadge label="The Solution" color="emerald" />
            <motion.h2 variants={fadeUp} custom={0} className="text-3xl md:text-5xl font-black mb-6 leading-tight">
              Give Them a Link.{" "}
              <span className="text-emerald-400">Keep the Deal.</span>
            </motion.h2>
            <motion.p variants={fadeUp} custom={1} className="text-lg text-white/50 max-w-2xl mb-14">
              Your salesperson texts or emails the customer a simple link. The customer fills in their trade info from anywhere — and the submission lands in your dashboard, tagged to the right rep.
            </motion.p>
          </motion.div>
        </div>
      </section>

      {/* How It Works - Steps */}
      <section className="px-6 py-20 md:py-28 relative">
        <div className="max-w-5xl mx-auto">
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }}>
            <GlowBadge label="How It Works" color="amber" />
            <motion.div variants={fadeUp} custom={0} className="grid md:grid-cols-2 gap-8">
              <div className="space-y-1">
                {[
                  { num: 1, icon: Send, title: "Customer Gets a Branded Link", desc: "The salesperson sends a quick text: 'Here's where you can submit your trade info.' The customer lands on a clean, branded page — your logo, your trust." },
                  { num: 2, icon: Car, title: "Guided Vehicle Details", desc: "The same best-in-class multi-step form you know from the main platform. VIN decode, condition assessment, damage checkboxes — everything your managers need." },
                  { num: 3, icon: UserCheck, title: "Tagged to Their Salesperson", desc: "The customer enters the name of the salesperson they're working with. BDC knows not to cold-call this lead." },
                  { num: 4, icon: Camera, title: "Photos & Instant Confirmation", desc: "After submitting, the customer gets a QR code to upload photos of their trade from their phone. Submission instantly in your dashboard." },
                ].map((step) => (
                  <div key={step.num} className="flex gap-4 pb-6">
                    <div className="flex flex-col items-center shrink-0">
                      <div className="w-11 h-11 rounded-xl flex items-center justify-center font-black text-base bg-amber-500/20 text-amber-400">
                        {step.num}
                      </div>
                      {step.num < 4 && <div className="w-0.5 flex-1 mt-2 bg-white/10" />}
                    </div>
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <step.icon className="w-4 h-4 text-amber-400" />
                        <h3 className="font-bold">{step.title}</h3>
                      </div>
                      <p className="text-sm text-white/50 leading-relaxed">{step.desc}</p>
                    </div>
                  </div>
                ))}
              </div>

              <div className="space-y-4">
                {["Dealer-branded landing page", "Mobile-optimized for on-the-go", "8-day price guarantee builds confidence", "Auto VIN decode pulls year, make, model", "Full condition & damage assessment", "5-step guided flow — takes 2 minutes", "Salesperson name captured on the form", "Lead tagged as 'trade' — BDC skips it"].map((item) => (
                  <div key={item} className="flex items-center gap-3">
                    <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
                    <span className="text-white/70">{item}</span>
                  </div>
                ))}
              </div>
            </motion.div>
          </motion.div>
        </div>
      </section>

      {/* Use Cases */}
      <section className="px-6 py-20 md:py-28 bg-[hsl(220,25%,8%)] relative">
        <div className="max-w-5xl mx-auto">
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }}>
            <GlowBadge label="Use Cases" color="amber" />
            <motion.h2 variants={fadeUp} custom={0} className="text-3xl md:text-5xl font-black mb-14 leading-tight text-center">
              Works for <span className="text-amber-400">Every Scenario</span>
            </motion.h2>
            <motion.div variants={fadeUp} custom={1} className="grid md:grid-cols-2 gap-6">
              {[
                { icon: Car, title: "Trade Not on the Lot", desc: "Customer is test driving but left their trade at home. Send them the link — they submit it tonight from the couch." },
                { icon: Users, title: "Spouse Has the Car", desc: "One spouse is at the dealership, the other has the trade. The link lets them submit from wherever they are." },
                { icon: Clock, title: "Coming In Tomorrow", desc: "Customer has an appointment tomorrow. Send the link now so you have the trade info before they walk in." },
                { icon: Zap, title: "Left Without Finishing", desc: "Customer left the store without completing the deal. The trade link keeps the conversation going." },
              ].map(({ icon: I, title, desc }) => (
                <div key={title} className="rounded-2xl p-6 bg-white/5 border border-white/10 hover:border-amber-400/30 transition-colors">
                  <div className="w-12 h-12 rounded-xl bg-amber-500/20 flex items-center justify-center mb-4">
                    <I className="w-6 h-6 text-amber-400" />
                  </div>
                  <h3 className="font-bold text-lg mb-2">{title}</h3>
                  <p className="text-sm text-white/50 leading-relaxed">{desc}</p>
                </div>
              ))}
            </motion.div>
          </motion.div>
        </div>
      </section>

      {/* Dashboard */}
      <section className="px-6 py-20 md:py-28 relative">
        <div className="max-w-6xl mx-auto">
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }}>
            <GlowBadge label="Your Team" color="blue" />
            <motion.h2 variants={fadeUp} custom={0} className="text-3xl md:text-5xl font-black mb-6 leading-tight text-center">
              Lands Right in Your{" "}
              <span className="text-blue-400">Command Center</span>
            </motion.h2>
            <motion.p variants={fadeUp} custom={1} className="text-lg text-white/50 max-w-2xl mx-auto mb-12 text-center">
              Every trade submission appears in the same admin dashboard as your off-street and service drive leads — with the "trade" tag and salesperson name clearly visible.
            </motion.p>
            <motion.div variants={fadeUp} custom={2} className="rounded-2xl overflow-hidden border border-white/10 shadow-2xl shadow-blue-500/10">
              <a href="/admin" target="_blank" rel="noopener noreferrer" className="block hover:opacity-90 transition-opacity">
                <img src={screenshotDashboard} alt="Admin dashboard showing trade submissions" className="w-full" />
              </a>
            </motion.div>
          </motion.div>
        </div>
      </section>

      {/* ROI — Recovered Deals */}
      <section className="px-6 py-20 md:py-28 relative">
        <div className="max-w-5xl mx-auto">
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }}>
            <GlowBadge label="ROI — Recovered Deals" color="emerald" />
            <motion.h2 variants={fadeUp} custom={0} className="text-3xl md:text-5xl font-black mb-6 leading-tight text-center">
              Every Stalled Trade Is a{" "}
              <span className="text-amber-400">Deal Walking Out the Door</span>
            </motion.h2>
            <motion.p variants={fadeUp} custom={1} className="text-lg text-white/50 max-w-3xl mx-auto mb-14 text-center leading-relaxed">
              Dealers{" "}
              <SourceTip source="Brian Kramer, EVP Cars Commerce" detail="Car Dealership Guy Podcast Jan 2025">
                lose 70% of trade-ins
              </SourceTip>
              {" "}for every new car sold. Many of those losses happen because the trade isn't present — customer left it at home, spouse has it, or they walked out to "think about it." This tool recovers those deals.
            </motion.p>

            {/* Funnel Visualization */}
            <motion.div variants={fadeUp} custom={2} className="max-w-2xl mx-auto mb-14">
              <div className="space-y-3">
                {[
                  { label: "Monthly Deals with a Trade-In", sublabel: "45% of new-vehicle purchases · Edmunds Q3 2024", width: "100%", color: "bg-white/10", textColor: "text-white/50", value: "45%" },
                  { label: "Trades That Stall (Vehicle Not Present)", sublabel: "~15% of trade deals · modeled estimate", width: "55%", color: "bg-amber-500/20", textColor: "text-amber-400/70", value: "~15%" },
                  { label: "Recovered via In-Store Trade Link", sublabel: "~50% recovery rate · modeled estimate", width: "25%", color: "bg-emerald-500/30", textColor: "text-emerald-400", value: "~50%" },
                ].map((step, i) => (
                  <div key={i}>
                    <div className="flex items-center justify-between text-sm mb-1">
                      <span className={step.textColor}>{step.label}</span>
                      <span className={`font-bold ${step.textColor}`}>{step.value}</span>
                    </div>
                    <div className="w-full bg-white/5 rounded-full h-4 overflow-hidden">
                      <div className={`${step.color} h-4 rounded-full transition-all duration-700`} style={{ width: step.width }} />
                    </div>
                    <div className="text-xs text-white/30 mt-0.5">{step.sublabel}</div>
                  </div>
                ))}
              </div>
            </motion.div>

            {/* ROI Tiers */}
            <motion.div variants={fadeUp} custom={3} className="bg-gradient-to-r from-amber-500/10 to-emerald-500/10 border border-amber-500/20 rounded-3xl p-8 md:p-10 max-w-5xl mx-auto">
              <div className="text-center mb-8">
                <div className="text-sm text-white/40 mb-1">Average total gross per recovered deal</div>
                <SourceTip source="Used PVR $1,528 + F&I $2,534" detail="Haig Report® Q3 2025">
                  <span className="text-3xl font-black text-amber-400">$4,062</span>
                </SourceTip>
                <div className="text-xs text-white/30 mt-1">Used PVR $1,528 + F&I $2,534 · Haig Report® Q3 2025</div>
              </div>

              <div className="grid md:grid-cols-3 gap-6 mb-8">
                <div className="rounded-2xl border border-white/10 bg-white/5 p-6 text-center">
                  <div className="text-xs font-bold uppercase tracking-widest text-white/40 mb-2">Small Dealer</div>
                  <div className="mb-4"><SourceTip source="NADA small franchise dealer benchmark" detail="NADA Data 2024"><span className="text-white/30 text-xs">~80 deals/mo</span></SourceTip></div>
                  <div className="space-y-1 text-sm text-white/40 mb-4">
                    <div>36 with trades → <span className="text-white/60">5 stall</span></div>
                    <div>Recover <strong className="text-emerald-400">3 deals</strong>/mo</div>
                  </div>
                  <div className="border-t border-white/10 pt-4">
                    <div className="text-xs text-white/40 mb-1">Monthly recovered revenue</div>
                    <div className="text-2xl font-black text-emerald-400 mb-2">$12.2K/mo</div>
                    <div className="text-5xl font-black text-emerald-400 mb-1">$146K</div>
                    <div className="text-xs text-emerald-400/70 font-bold">Recovered annual profit</div>
                  </div>
                </div>

                <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 p-6 text-center ring-1 ring-amber-500/20 relative">
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-0.5 rounded-full bg-amber-500 text-[10px] font-bold uppercase tracking-widest text-white">Most Common</div>
                  <div className="text-xs font-bold uppercase tracking-widest text-amber-400/70 mb-2">Mid-Size Dealer</div>
                  <div className="mb-4"><SourceTip source="NADA mid-size franchise dealer benchmark" detail="NADA Data 2024"><span className="text-white/30 text-xs">~200 deals/mo</span></SourceTip></div>
                  <div className="space-y-1 text-sm text-white/40 mb-4">
                    <div>90 with trades → <span className="text-white/60">14 stall</span></div>
                    <div>Recover <strong className="text-emerald-400">7 deals</strong>/mo</div>
                  </div>
                  <div className="border-t border-amber-500/20 pt-4">
                    <div className="text-xs text-white/40 mb-1">Monthly recovered revenue</div>
                    <div className="text-2xl font-black text-emerald-400 mb-2">$28.4K/mo</div>
                    <div className="text-5xl font-black text-emerald-400 mb-1">$341K</div>
                    <div className="text-xs text-emerald-400/70 font-bold">Recovered annual profit</div>
                  </div>
                </div>

                <div className="rounded-2xl border border-white/10 bg-white/5 p-6 text-center">
                  <div className="text-xs font-bold uppercase tracking-widest text-white/40 mb-2">High-Volume Dealer</div>
                  <div className="mb-4"><SourceTip source="NADA high-volume franchise dealer benchmark" detail="NADA Data 2024"><span className="text-white/30 text-xs">~500 deals/mo</span></SourceTip></div>
                  <div className="space-y-1 text-sm text-white/40 mb-4">
                    <div>225 with trades → <span className="text-white/60">34 stall</span></div>
                    <div>Recover <strong className="text-emerald-400">17 deals</strong>/mo</div>
                  </div>
                  <div className="border-t border-white/10 pt-4">
                    <div className="text-xs text-white/40 mb-1">Monthly recovered revenue</div>
                    <div className="text-2xl font-black text-emerald-400 mb-2">$69K/mo</div>
                    <div className="text-5xl font-black text-emerald-400 mb-1">$828K</div>
                    <div className="text-xs text-emerald-400/70 font-bold">Recovered annual profit</div>
                  </div>
                </div>
              </div>

              <div className="text-center text-sm text-white/40 border-t border-white/10 pt-6">
                Based on 45% of purchases involving a trade-in (Edmunds Q3 2024) · ~15% stall due to vehicle not present · ~50% recovery rate · $4,062 avg total gross (Haig Report®)
              </div>
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
