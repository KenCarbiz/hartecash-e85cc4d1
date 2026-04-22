import { motion } from "framer-motion";
import {
  ArrowRight, MessageSquare, Sprout, Shield, Clock,
  CheckCircle2, Eye, Heart, TrendingUp, Repeat, Target,
  Smartphone, CalendarDays, Car, Send, UserCheck, BarChart3,
  ChevronUp, XCircle
} from "lucide-react";
import SourceTip from "./SourceTip";
import screenshotDashboard from "@/assets/pitch/screenshot-dashboard.jpg";

const fadeUp = {
  hidden: { opacity: 0, y: 30 },
  visible: (i: number) => ({
    opacity: 1, y: 0,
    transition: { delay: i * 0.1, duration: 0.6, ease: "easeOut" as const },
  }),
};

export default function ServiceDriveInlineContent({ onBackToTop }: { onBackToTop: () => void }) {
  return (
    <div className="bg-[hsl(220,25%,6%)] text-white">
      {/* Hero */}
      <section className="relative overflow-hidden px-6 pt-20 pb-24">
        <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[700px] rounded-full bg-emerald-600/8 blur-[180px] pointer-events-none" />
        <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} className="relative max-w-4xl mx-auto text-center">
          <motion.div variants={fadeUp} custom={0} className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-bold tracking-widest uppercase mb-8 border border-emerald-500/30 text-emerald-400 bg-emerald-500/10 backdrop-blur-sm">
            <Sprout className="w-3.5 h-3.5" />
            The Soft Hand-Raise
          </motion.div>
          <motion.h1 variants={fadeUp} custom={1} className="text-4xl md:text-6xl lg:text-7xl font-black leading-[0.95] tracking-tight mb-8">
            Plant the Seed,{" "}
            <span className="bg-gradient-to-r from-emerald-400 via-emerald-500 to-teal-500 bg-clip-text text-transparent">
              Don't Push the Sale
            </span>
          </motion.h1>
          <motion.p variants={fadeUp} custom={2} className="text-lg md:text-xl text-white/50 max-w-3xl mx-auto leading-relaxed">
            A subtle, TCPA-compliant approach that turns every service appointment into a potential sale — without the pressure that drives customers away.
          </motion.p>
        </motion.div>
      </section>

      {/* The Problem */}
      <section className="px-6 py-20 border-t border-white/5">
        <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} className="max-w-5xl mx-auto">
          <motion.div variants={fadeUp} custom={0} className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-bold tracking-widest uppercase mb-8 border border-red-500/30 text-red-400 bg-red-500/10">
            <Eye className="w-3.5 h-3.5" />
            The Problem
          </motion.div>
          <motion.h2 variants={fadeUp} custom={1} className="text-3xl md:text-5xl font-black mb-6">
            Customers Feel <span className="text-red-400">Hounded</span>
          </motion.h2>
          <motion.p variants={fadeUp} custom={2} className="text-lg text-white/50 max-w-3xl mb-12 leading-relaxed">
            Every time a service customer walks in for an oil change, tire rotation, or recall, they brace themselves for the inevitable pitch: <em className="text-white/70">"Have you thought about trading in?"</em> It's aggressive. It's expected. And it pushes people away.
          </motion.p>
          <motion.div variants={fadeUp} custom={3} className="grid md:grid-cols-3 gap-6">
            {[
              { icon: Heart, title: "Erodes Trust", desc: "Customers start dreading service visits when they feel like every interaction is a sales opportunity." },
              { icon: Repeat, title: "Creates Resistance", desc: "The more you push, the harder they resist. It becomes a reflex to say 'no' before you even ask." },
              { icon: TrendingUp, title: "Missed Revenue", desc: "Ironically, high-pressure tactics result in fewer trades — not more. The dealership loses on both ends." },
            ].map((item, i) => (
              <div key={i} className="rounded-2xl p-6 bg-white/5 border border-white/10">
                <div className="w-12 h-12 rounded-xl flex items-center justify-center mb-4 bg-red-500/15">
                  <item.icon className="w-6 h-6 text-red-400" />
                </div>
                <h3 className="font-bold text-lg mb-2">{item.title}</h3>
                <p className="text-sm text-white/50 leading-relaxed">{item.desc}</p>
              </div>
            ))}
          </motion.div>
        </motion.div>
      </section>

      {/* The Solution */}
      <section className="px-6 py-20 border-t border-white/5 bg-emerald-500/[0.02]">
        <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} className="max-w-5xl mx-auto">
          <motion.div variants={fadeUp} custom={0} className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-bold tracking-widest uppercase mb-8 border border-emerald-500/30 text-emerald-400 bg-emerald-500/10">
            <Sprout className="w-3.5 h-3.5" />
            The Solution
          </motion.div>
          <motion.h2 variants={fadeUp} custom={1} className="text-3xl md:text-5xl font-black mb-6">
            The <span className="text-emerald-400">Soft Hand-Raise</span>
          </motion.h2>
          <motion.p variants={fadeUp} custom={2} className="text-lg text-white/50 max-w-3xl mb-6 leading-relaxed">
            Instead of cornering customers with a sales pitch, we embed a <strong className="text-white/80">subtle, value-driven invitation</strong> into their existing service communication. It arrives naturally — alongside their appointment confirmation — so it feels like a helpful suggestion, not a hard sell.
          </motion.p>
          <motion.p variants={fadeUp} custom={3} className="text-lg text-white/50 max-w-3xl mb-14 leading-relaxed">
            The customer <strong className="text-white/80">raises their own hand</strong>. They tap a link. They opt in. No pressure. No awkward conversation. And even if they don't bite the first time — <em className="text-emerald-400/80">the seed is planted</em>. Over months and years of service visits, that seed grows until the timing is right.
          </motion.p>

          <motion.div variants={fadeUp} custom={4} className="grid md:grid-cols-2 gap-8 mb-14">
            <div className="space-y-1">
              {[
                { num: 1, icon: CalendarDays, title: "Customer Books Service", desc: "They schedule an oil change, recall, or inspection through your DMS — business as usual." },
                { num: 2, icon: Send, title: "Automated SMS Goes Out", desc: "A TCPA-compliant text confirms their appointment and casually includes a personalized appraisal link — VIN, date, and time pre-filled." },
                { num: 3, icon: Smartphone, title: "Customer Taps the Link", desc: "They land on a branded page that already knows their car. No apps. No logins. Just enter mileage and contact info." },
                { num: 4, icon: UserCheck, title: "Lead Captured Automatically", desc: "Their submission flows into the admin dashboard. If they have an upcoming service appointment, the appraisal is scheduled during that visit." },
              ].map((step) => (
                <div key={step.num} className="flex gap-4 pb-6">
                  <div className="flex flex-col items-center shrink-0">
                    <div className="w-11 h-11 rounded-xl flex items-center justify-center font-black text-base bg-emerald-500/20 text-emerald-400">
                      {step.num}
                    </div>
                    {step.num < 4 && <div className="w-0.5 flex-1 mt-2 bg-white/10" />}
                  </div>
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <step.icon className="w-4 h-4 text-emerald-400" />
                      <h3 className="font-bold">{step.title}</h3>
                    </div>
                    <p className="text-sm text-white/50 leading-relaxed">{step.desc}</p>
                  </div>
                </div>
              ))}
            </div>

            <div className="rounded-2xl overflow-hidden border border-white/10 bg-white/5">
              <div className="flex items-center gap-2 px-4 py-2.5 border-b border-white/10 bg-white/5">
                <div className="flex gap-1.5">
                  <span className="w-3 h-3 rounded-full bg-red-400/60" />
                  <span className="w-3 h-3 rounded-full bg-yellow-400/60" />
                  <span className="w-3 h-3 rounded-full bg-emerald-400/60" />
                </div>
                <span className="text-xs font-mono ml-2 text-white/30">SMS Confirmation + Appraisal Link</span>
              </div>
              <div className="p-8 text-center">
                <div className="bg-white/5 border border-white/10 rounded-2xl p-6 max-w-sm mx-auto">
                  <div className="text-xs text-white/40 mb-4 uppercase tracking-wider">SMS Preview</div>
                  <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-4 text-left text-sm text-white/70 leading-relaxed">
                    <p>Hi Sarah! Your service appointment at <strong className="text-white/90">Your Dealership</strong> is confirmed for <strong className="text-white/90">Feb 21 at 9:30 AM</strong>.</p>
                    <p className="mt-3">💰 Curious what your 2021 RAV4 is worth? Get a no-obligation cash offer:</p>
                    <p className="mt-2 text-emerald-400 underline">yourdealership.com/service?vin=...</p>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        </motion.div>
      </section>

      {/* The Psychology */}
      <section className="px-6 py-20 border-t border-white/5">
        <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} className="max-w-5xl mx-auto">
          <motion.div variants={fadeUp} custom={0} className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-bold tracking-widest uppercase mb-8 border border-purple-500/30 text-purple-400 bg-purple-500/10">
            <Target className="w-3.5 h-3.5" />
            Why It Works
          </motion.div>
          <motion.h2 variants={fadeUp} custom={1} className="text-3xl md:text-5xl font-black mb-6">
            Planting Seeds,{" "}
            <span className="text-purple-400">Not Pushing Sales</span>
          </motion.h2>
          <motion.p variants={fadeUp} custom={2} className="text-lg text-white/50 max-w-3xl mb-14 leading-relaxed">
            The key insight: <strong className="text-white/80">people buy when they're ready, not when you're ready</strong>. By subtly exposing them to their vehicle's value at every service visit, you create a persistent awareness that eventually converts.
          </motion.p>

          <motion.div variants={fadeUp} custom={3} className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 mb-14">
            {[
              { title: "Visit 1", subtitle: "Oil Change", desc: "Customer sees link, ignores it. But now they know their car could be worth $24K.", color: "text-white/30" },
              { title: "Visit 2", subtitle: "Tire Rotation", desc: "They notice it again. Curiosity grows. 'Hmm, I wonder what mine's actually worth...'", color: "text-white/50" },
              { title: "Visit 3", subtitle: "30K Service", desc: "Big service bill hits. They tap the link. 'If I could sell this and lower my payment...'", color: "text-emerald-400/70" },
              { title: "Visit 4", subtitle: "The Deal", desc: "They walk in for service and ask to talk to sales. The seed has bloomed.", color: "text-emerald-400" },
            ].map((visit, i) => (
              <div key={i} className="rounded-2xl p-6 bg-white/5 border border-white/10 text-center">
                <div className={`text-3xl font-black mb-1 ${visit.color}`}>{visit.title}</div>
                <div className="text-xs text-white/40 uppercase tracking-wider mb-4">{visit.subtitle}</div>
                <p className="text-sm text-white/50 leading-relaxed">{visit.desc}</p>
              </div>
            ))}
          </motion.div>

          <motion.div variants={fadeUp} custom={4} className="bg-gradient-to-r from-emerald-500/10 to-teal-500/10 border border-emerald-500/20 rounded-2xl p-8 text-center max-w-3xl mx-auto">
            <Sprout className="w-8 h-8 text-emerald-400 mx-auto mb-4" />
            <h3 className="text-xl font-bold mb-3">The Compound Effect</h3>
            <p className="text-white/60 leading-relaxed">
              A service customer visits <SourceTip source="Cox Automotive 2024 Service Industry Study"><strong className="text-white/80">2-4 times per year</strong></SourceTip>. Over a 5-year ownership cycle, that's <SourceTip source="2-4 visits × 5 years" detail="Modeled from Cox Automotive data"><strong className="text-emerald-400">10-20 seed-planting opportunities</strong></SourceTip> — each one making the idea of trading in feel more natural and less pressured. By the time they decide to sell, <em>your dealership is the only one they think of</em>.
            </p>
          </motion.div>
        </motion.div>
      </section>

      {/* Key Differentiators */}
      <section className="px-6 py-20 border-t border-white/5 bg-emerald-500/[0.02]">
        <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} className="max-w-5xl mx-auto">
          <motion.h2 variants={fadeUp} custom={0} className="text-3xl md:text-5xl font-black mb-14 text-center">
            Why This <span className="text-emerald-400">Actually Works</span>
          </motion.h2>
          <motion.div variants={fadeUp} custom={1} className="grid md:grid-cols-3 gap-6">
            {[
              { icon: MessageSquare, title: "Rides the Service Thread", desc: "The appraisal offer arrives alongside the appointment confirmation — not as a cold sales text. It's contextual, relevant, and expected." },
              { icon: Shield, title: "100% TCPA Compliant", desc: "Customers consent when they provide their phone at your service drive. Every message includes opt-out. Managed on a registered 10DLC number." },
              { icon: Clock, title: "Zero Extra Work", desc: "Service advisors don't pitch. Sales staff don't cold-call. The system does the work. When a customer opts in, it's a warm lead delivered to the dashboard." },
              { icon: Car, title: "VIN Pre-Populated", desc: "The customer's vehicle info is pulled from your DMS and pre-filled. They don't type a single VIN digit — reducing friction to near zero." },
              { icon: Repeat, title: "Compounding Exposure", desc: "Every service visit is another touch. Over years, the cumulative effect makes trading in feel like their own idea — not yours." },
              { icon: CheckCircle2, title: "Customers Feel in Control", desc: "They tap a link or they don't. No sales floor ambush. No awkward 'let me get my manager.' The power is in their hands." },
            ].map((item, i) => (
              <div key={i} className="rounded-2xl p-6 bg-white/5 border border-white/10 hover:border-emerald-500/30 transition-colors">
                <div className="w-12 h-12 rounded-xl flex items-center justify-center mb-4 bg-emerald-500/15">
                  <item.icon className="w-6 h-6 text-emerald-400" />
                </div>
                <h3 className="font-bold text-lg mb-2">{item.title}</h3>
                <p className="text-sm text-white/50 leading-relaxed">{item.desc}</p>
              </div>
            ))}
          </motion.div>
        </motion.div>
      </section>

      {/* Admin View */}
      <section className="px-6 py-20 border-t border-white/5">
        <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} className="max-w-5xl mx-auto">
          <motion.div variants={fadeUp} custom={0} className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-bold tracking-widest uppercase mb-8 border border-emerald-500/30 text-emerald-400 bg-emerald-500/10">
            <BarChart3 className="w-3.5 h-3.5" />
            Staff Dashboard
          </motion.div>
          <motion.h2 variants={fadeUp} custom={1} className="text-3xl md:text-5xl font-black mb-6">
            Every Lead, <span className="text-emerald-400">Automatically Tracked</span>
          </motion.h2>
          <motion.p variants={fadeUp} custom={2} className="text-lg text-white/50 max-w-3xl mb-10 leading-relaxed">
            Service drive leads flow directly into the same admin dashboard as off-street and trade-in submissions — tagged with <code className="px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 text-sm">lead_source: service</code> so your team knows exactly where each opportunity came from.
          </motion.p>
          <motion.div variants={fadeUp} custom={3} className="rounded-2xl overflow-hidden border border-white/10 bg-white/5">
            <div className="flex items-center gap-2 px-4 py-2.5 border-b border-white/10 bg-white/5">
              <div className="flex gap-1.5">
                <span className="w-3 h-3 rounded-full bg-red-400/60" />
                <span className="w-3 h-3 rounded-full bg-yellow-400/60" />
                <span className="w-3 h-3 rounded-full bg-emerald-400/60" />
              </div>
              <span className="text-xs font-mono ml-2 text-white/30">Admin Dashboard — Service Leads</span>
            </div>
            <img src={screenshotDashboard} alt="Admin dashboard with service leads" className="w-full" />
          </motion.div>
        </motion.div>
      </section>

      {/* Service Drive ROI */}
      <section className="px-6 py-20 border-t border-white/5">
        <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} className="max-w-5xl mx-auto">
          <motion.div variants={fadeUp} custom={0} className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-bold tracking-widest uppercase mb-8 border border-emerald-500/30 text-emerald-400 bg-emerald-500/10">
            <TrendingUp className="w-3.5 h-3.5" />
            Service Drive ROI
          </motion.div>
          <motion.h2 variants={fadeUp} custom={1} className="text-3xl md:text-5xl font-black mb-6">
            Your Service Lane is a{" "}
            <span className="text-emerald-400">Used Car Goldmine</span>
          </motion.h2>
          <motion.p variants={fadeUp} custom={2} className="text-lg text-white/50 max-w-3xl mb-14 leading-relaxed">
            Hundreds of retail-ready vehicles pass through your bays every month. Industry leaders now source <SourceTip source="Germain Toyota of Naples acquires 135/mo" detail="WardsAuto, March 2025"><strong className="text-white/80">350+ used cars/month</strong></SourceTip> exclusively from service lanes — zero auctions needed. Even a modest conversion rate generates significant incremental profit.
          </motion.p>

          {/* The Funnel */}
          <motion.div variants={fadeUp} custom={3} className="grid md:grid-cols-4 gap-4 mb-14">
            {[
              { label: "Monthly ROs", icon: Car, color: "text-white/60", bgColor: "bg-white/10", desc: "Vehicles flowing through service" },
              { label: "Receive Offer", icon: Send, color: "text-blue-400", bgColor: "bg-blue-500/15", desc: "Automated appraisal link sent via SMS" },
              { label: "Tap the Link", icon: Smartphone, color: "text-purple-400", bgColor: "bg-purple-500/15", desc: "~5–8% CTR (modeled estimate)" },
              { label: "Acquired", icon: CheckCircle2, color: "text-emerald-400", bgColor: "bg-emerald-500/15", desc: "Close rate on warm hand-raisers (modeled)" },
            ].map((step, i) => (
              <div key={i} className="rounded-2xl p-5 bg-white/5 border border-white/10 text-center relative">
                {i < 3 && <ArrowRight className="hidden md:block absolute -right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-white/20 z-10" />}
                <div className={`w-12 h-12 rounded-xl flex items-center justify-center mx-auto mb-3 ${step.bgColor}`}>
                  <step.icon className={`w-6 h-6 ${step.color}`} />
                </div>
                <div className="font-bold text-sm mb-1">{step.label}</div>
                <div className="text-xs text-white/40">{step.desc}</div>
              </div>
            ))}
          </motion.div>

          {/* Tier Cards */}
          <motion.div variants={fadeUp} custom={4} className="bg-gradient-to-r from-emerald-500/10 to-teal-500/10 border border-emerald-500/20 rounded-3xl p-8 md:p-10">
            <h3 className="text-2xl font-black text-white mb-3 text-center">Service Drive Acquisition ROI</h3>
            <p className="text-center text-white/40 text-sm mb-8">Conservative projection based on automated SMS appraisal offers at <SourceTip source="$1,000 buy fee + $550 transport + $450 recon" detail="NAAA / Cox Automotive 2024">+$2,000 PVR</SourceTip> per acquired unit</p>
            <div className="grid md:grid-cols-3 gap-6 mb-8">
              <div className="rounded-2xl border border-white/10 bg-white/5 p-6 text-center">
                <div className="text-xs font-bold uppercase tracking-widest text-white/40 mb-4">Small Dealer</div>
                <div className="mb-2"><SourceTip source="270M ROs ÷ 16,800 dealers = ~1,339 avg/mo" detail="NADA Data 2024"><span className="text-white/30 text-xs">~800 ROs/mo</span></SourceTip></div>
                <div className="flex items-baseline justify-center gap-1 mb-1">
                  <span className="text-3xl font-black text-white">4</span>
                  <span className="text-white/40 text-sm">acquisitions/mo</span>
                </div>
                <div className="text-white/30 text-xs mb-4">× <span className="text-emerald-400/60">$2,000 added PVR</span> × 12 mo</div>
                <div className="text-4xl font-black text-emerald-400 mb-1">$96K</div>
                <div className="text-xs text-emerald-400/70 font-bold">Additional annual profit</div>
                <div className="text-[11px] text-white/30 mt-3">~0.5% RO-to-acquisition rate <span className="italic text-white/20">(modeled)</span></div>
              </div>
              <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-6 text-center ring-1 ring-emerald-500/20 relative">
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-0.5 rounded-full bg-emerald-500 text-[10px] font-bold uppercase tracking-widest text-white">Most Common</div>
                <div className="text-xs font-bold uppercase tracking-widest text-emerald-400/70 mb-4">Mid-Size Dealer</div>
                <div className="mb-2"><SourceTip source="270M ROs ÷ 16,800 dealers = ~1,339 avg/mo" detail="NADA Data 2024"><span className="text-white/30 text-xs">~2,000 ROs/mo</span></SourceTip></div>
                <div className="flex items-baseline justify-center gap-1 mb-1">
                  <span className="text-3xl font-black text-white">10</span>
                  <span className="text-white/40 text-sm">acquisitions/mo</span>
                </div>
                <div className="text-white/30 text-xs mb-4">× <span className="text-emerald-400/60">$2,000 added PVR</span> × 12 mo</div>
                <div className="text-5xl font-black text-emerald-400 mb-1">$240K</div>
                <div className="text-xs text-emerald-400/70 font-bold">Additional annual profit</div>
                <div className="text-[11px] text-white/30 mt-3">~0.5% RO-to-acquisition rate <span className="italic text-white/20">(modeled)</span></div>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/5 p-6 text-center">
                <div className="text-xs font-bold uppercase tracking-widest text-white/40 mb-4">High-Volume Dealer</div>
                <div className="mb-2"><SourceTip source="Sutherlin Toyota: 3,000+ ROs/mo" detail="DealershipGuy, May 2025"><span className="text-white/30 text-xs">~3,000+ ROs/mo</span></SourceTip></div>
                <div className="flex items-baseline justify-center gap-1 mb-1">
                  <span className="text-3xl font-black text-white">20</span>
                  <span className="text-white/40 text-sm">acquisitions/mo</span>
                </div>
                <div className="text-white/30 text-xs mb-4">× <span className="text-emerald-400/60">$2,000 added PVR</span> × 12 mo</div>
                <div className="text-4xl font-black text-emerald-400 mb-1">$480K</div>
                <div className="text-xs text-emerald-400/70 font-bold">Additional annual profit</div>
                <div className="text-[11px] text-white/30 mt-3">~0.7% RO-to-acquisition rate <span className="italic text-white/20">(modeled)</span></div>
              </div>
            </div>
            <div className="text-center text-sm text-white/40 border-t border-white/10 pt-6">
              Based on industry RO volumes and service-to-sale conversion · $2,000 PVR advantage from direct acquisition vs. auction sourcing.
            </div>
          </motion.div>
        </motion.div>
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
