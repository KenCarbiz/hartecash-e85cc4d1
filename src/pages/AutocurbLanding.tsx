import { useEffect } from "react";
import { Link } from "react-router-dom";
import SEO from "@/components/SEO";

/**
 * AutocurbLanding — marketing site served on autocurb.io.
 *
 * Drop-in logo replacement: put your file at
 *   public/brand/autocurb/logo-mark.svg   (square mark, ~32×32 viewBox)
 *   public/brand/autocurb/logo-wordmark.svg (optional wide wordmark)
 * The page falls back to the inline SVG mark if neither file exists,
 * so it won't break before the assets land.
 */
const LIME = "#C7FF1A";
const LIME_DARK = "#A8DC10";
const INK = "#0A0A0A";

const LogoMark = ({ size = 28 }: { size?: number }) => (
  <img
    src="/brand/autocurb/logo-mark.svg"
    alt="AutoCurb"
    width={size}
    height={size}
    onError={(e) => {
      // Fallback to inline SVG if the brand asset isn't uploaded yet.
      const img = e.currentTarget;
      const fallback = document.createElement("span");
      fallback.innerHTML = `
        <svg width="${size}" height="${size}" viewBox="0 0 32 32" fill="none" aria-label="AutoCurb">
          <path d="M4 22 Q4 14 12 12 L22 12 Q28 12 28 18 L28 22 Q28 24 26 24 L6 24 Q4 24 4 22 Z"
                stroke="${LIME}" stroke-width="2.5" stroke-linejoin="round" fill="rgba(199,255,26,0.12)"/>
          <circle cx="11" cy="24" r="3" fill="${INK}" stroke="${LIME}" stroke-width="2"/>
          <circle cx="22" cy="24" r="3" fill="${INK}" stroke="${LIME}" stroke-width="2"/>
        </svg>`;
      img.replaceWith(fallback.firstElementChild as Node);
    }}
    style={{ display: "inline-block" }}
  />
);

const Check = ({ size = 16 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 20 20" fill={LIME} aria-hidden>
    <path d="M16.7 5.3a1 1 0 010 1.4l-8 8a1 1 0 01-1.4 0l-4-4a1 1 0 111.4-1.4L8 12.6l7.3-7.3a1 1 0 011.4 0z" />
  </svg>
);

const ArrowRight = ({ size = 18 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 20 20" fill="none" aria-hidden>
    <path d="M3 10h13m0 0l-5-5m5 5l-5 5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const AutocurbLanding = () => {
  useEffect(() => {
    // Load Inter + Space Grotesk for this page only — the rest of
    // the app uses the system stack, and we don't want to ship these
    // globally just for the marketing route.
    const links = [
      "https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Space+Grotesk:wght@500;600;700&display=swap",
    ];
    const tags: HTMLLinkElement[] = links.map((href) => {
      const l = document.createElement("link");
      l.rel = "stylesheet";
      l.href = href;
      document.head.appendChild(l);
      return l;
    });
    return () => tags.forEach((t) => t.remove());
  }, []);

  return (
    <div
      className="min-h-screen text-[#FAFAFA] antialiased"
      style={{
        background: INK,
        fontFamily: "Inter, system-ui, sans-serif",
      }}
    >
      <SEO
        title="AutoCurb — The AI Acquisition OS for Dealers"
        description="AutoCurb turns every web click, service write-up, and walk-in into your next deal — under your brand, for a fraction of what AccuTrade and KBB ICO charge."
        path="/"
        siteName="AutoCurb"
      />

      <style>{`
        .ac-display { font-family: 'Space Grotesk', 'Inter', sans-serif; letter-spacing: -0.02em; }
        .ac-lime-glow { background: radial-gradient(ellipse at center, rgba(199,255,26,0.20) 0%, transparent 60%); }
        .ac-grid-bg {
          background-image:
            linear-gradient(rgba(199,255,26,0.07) 1px, transparent 1px),
            linear-gradient(90deg, rgba(199,255,26,0.07) 1px, transparent 1px);
          background-size: 48px 48px;
        }
        .ac-pulse { animation: ac-pulse 2.2s cubic-bezier(0.4,0,0.6,1) infinite; }
        @keyframes ac-pulse { 0%,100% { opacity:1; transform:scale(1);} 50% { opacity:.6; transform:scale(.85);} }
        .ac-marquee { animation: ac-scroll 40s linear infinite; }
        @keyframes ac-scroll { 0% { transform: translateX(0);} 100% { transform: translateX(-50%);} }
        .ac-shadow-lime { box-shadow: 0 0 0 1px rgba(199,255,26,.4), 0 8px 32px -4px rgba(199,255,26,.35); }
        .ac-strike { position: relative; }
        .ac-strike::after { content:''; position:absolute; inset:50% 0 auto 0; height:2px; background:#ef4444; transform: rotate(-4deg); }
        .ac-gradient-border { background: linear-gradient(180deg, rgba(199,255,26,.4), rgba(199,255,26,0)); padding:1px; border-radius:16px; }
        .ac-gradient-border > div { background:${INK}; border-radius:15px; }
      `}</style>

      {/* ============== TOP NAV ============== */}
      <nav className="fixed top-0 inset-x-0 z-50 backdrop-blur-xl border-b border-white/5" style={{ background: "rgba(10,10,10,0.8)" }}>
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-10">
            <a href="#" className="flex items-center gap-2">
              <LogoMark size={28} />
              <span className="ac-display font-bold text-lg tracking-tight">AutoCurb</span>
            </a>
            <div className="hidden md:flex items-center gap-7 text-sm text-white/70">
              <a href="#platform" className="hover:text-white transition-colors">Platform</a>
              <a href="#compare" className="hover:text-white transition-colors">vs Competitors</a>
              <a href="#pricing" className="hover:text-white transition-colors">Pricing</a>
              <a href="#customers" className="hover:text-white transition-colors">Customers</a>
              <a href="/docs" className="hover:text-white transition-colors">Docs</a>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <a href="/admin" className="hidden md:block text-sm text-white/70 hover:text-white">Sign in</a>
            <a href="#demo" className="font-semibold text-sm px-4 py-2 rounded-lg transition" style={{ background: LIME, color: INK }}>
              Book demo
            </a>
          </div>
        </div>
      </nav>

      {/* ============== HERO ============== */}
      <section className="relative pt-32 pb-24 overflow-hidden">
        <div className="absolute inset-0 ac-grid-bg opacity-40" />
        <div className="absolute inset-x-0 top-0 h-[600px] ac-lime-glow" />

        <div className="relative max-w-7xl mx-auto px-6 grid lg:grid-cols-2 gap-12 items-center">
          <div>
            <div className="inline-flex items-center gap-2 bg-white/5 border border-white/10 rounded-full px-3 py-1 text-xs text-white/80 mb-8">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full rounded-full ac-pulse opacity-75" style={{ background: LIME }} />
                <span className="relative inline-flex rounded-full h-2 w-2" style={{ background: LIME }} />
              </span>
              Now live at 200+ rooftops nationwide
            </div>

            <h1 className="ac-display font-bold text-6xl lg:text-7xl leading-[0.95]">
              Stop renting<br />
              <span style={{ color: LIME }}>your customers.</span>
            </h1>

            <p className="mt-6 text-xl text-white/70 max-w-xl leading-relaxed">
              AutoCurb is the AI acquisition OS that turns every web click, service write-up, and walk-in into your next deal — under <span className="text-white font-medium">your brand</span>, for a fraction of what AccuTrade and KBB ICO charge.
            </p>

            <div className="mt-10 flex flex-wrap items-center gap-4">
              <a href="#demo" className="font-semibold px-6 py-3.5 rounded-lg transition ac-shadow-lime flex items-center gap-2" style={{ background: LIME, color: INK }}>
                Get your numbers
                <ArrowRight />
              </a>
              <a href="#platform" className="text-white/90 font-medium px-6 py-3.5 rounded-lg border border-white/15 hover:border-white/30 hover:bg-white/5 transition">
                Watch 90-sec tour
              </a>
            </div>

            <div className="mt-10 flex flex-wrap items-center gap-6 text-sm text-white/50">
              <div className="flex items-center gap-2"><Check /> No per-lead fees</div>
              <div className="flex items-center gap-2"><Check /> 30-day money back</div>
              <div className="flex items-center gap-2"><Check /> Onboard in 7 days</div>
            </div>
          </div>

          {/* right: product peek + brand panel */}
          <div className="relative">
            <div className="absolute -top-4 right-0 w-72 border border-white/10 rounded-2xl p-5 shadow-2xl rotate-3 z-10" style={{ background: "#1A1A1A" }}>
              <div className="flex items-center gap-2 mb-3">
                <div className="w-2 h-2 rounded-full ac-pulse" style={{ background: LIME }} />
                <span className="text-xs text-white/60 uppercase tracking-wider">Live deal · #4421</span>
              </div>
              <div className="text-sm text-white/80 mb-1">Sarah K. — 2019 Honda CR-V</div>
              <div className="ac-display text-3xl font-bold" style={{ color: LIME }}>$18,400</div>
              <div className="text-xs text-white/50 mt-1">Offer accepted · 2 min ago</div>
              <div className="mt-3 pt-3 border-t border-white/10 grid grid-cols-5 gap-1">
                <div className="h-1 rounded-full" style={{ background: LIME }} />
                <div className="h-1 rounded-full" style={{ background: LIME }} />
                <div className="h-1 rounded-full" style={{ background: LIME }} />
                <div className="h-1 rounded-full bg-white/15" />
                <div className="h-1 rounded-full bg-white/15" />
              </div>
            </div>

            {/* Large brand tile — accepts the user's logo via /brand/autocurb/hero.svg|png */}
            <div className="relative aspect-square max-w-md mx-auto rounded-3xl overflow-hidden border border-lime/30" style={{ background: LIME }}>
              <img
                src="/brand/autocurb/hero.svg"
                alt=""
                className="absolute inset-0 w-full h-full object-contain p-12"
                onError={(e) => {
                  // Fallback: oversized brand mark drawn inline.
                  const img = e.currentTarget;
                  const wrap = document.createElement("div");
                  wrap.style.cssText = "position:absolute;inset:0;display:flex;align-items:center;justify-content:center;padding:48px;";
                  wrap.innerHTML = `
                    <svg viewBox="0 0 200 200" style="width:100%;height:100%;">
                      <path d="M30 130 Q30 80 80 70 L140 70 Q180 70 180 110 L180 130 Q180 145 165 145 L45 145 Q30 145 30 130 Z"
                            fill="${INK}" stroke="${INK}" stroke-width="3"/>
                      <circle cx="70" cy="145" r="18" fill="${INK}" stroke="${LIME}" stroke-width="4"/>
                      <circle cx="70" cy="145" r="8" fill="${LIME}"/>
                      <circle cx="140" cy="145" r="18" fill="${INK}" stroke="${LIME}" stroke-width="4"/>
                      <circle cx="140" cy="145" r="8" fill="${LIME}"/>
                      <text x="100" y="115" text-anchor="middle" fill="${LIME}" font-family="Space Grotesk, sans-serif" font-weight="700" font-size="22">AutoCurb</text>
                    </svg>`;
                  img.replaceWith(wrap);
                }}
              />
            </div>

            <div className="absolute -bottom-4 -left-4 border rounded-2xl p-4 ac-shadow-lime" style={{ background: INK, borderColor: "rgba(199,255,26,0.4)" }}>
              <div className="text-xs text-white/60 uppercase tracking-wider mb-1">This month</div>
              <div className="ac-display text-2xl font-bold">+47 deals</div>
              <div className="text-xs" style={{ color: LIME }}>↑ 23% vs last month</div>
            </div>
          </div>
        </div>
      </section>

      {/* ============== LOGO STRIP ============== */}
      <section className="border-y border-white/5 py-10 overflow-hidden" style={{ background: "rgba(26,26,26,0.5)" }}>
        <p className="text-center text-xs uppercase tracking-[0.2em] text-white/40 mb-8">Trusted by franchise & independent rooftops</p>
        <div className="flex ac-marquee gap-16 whitespace-nowrap">
          {[0, 1].map((i) => (
            <div key={i} className="flex gap-16 shrink-0 items-center text-white/30 ac-display font-semibold text-2xl">
              <span>KOONS</span><span>•</span>
              <span>HARTE NISSAN</span><span>•</span>
              <span>INFINITI OF MANHATTAN</span><span>•</span>
              <span>HENDRICK</span><span>•</span>
              <span>GARBER AUTOMOTIVE</span><span>•</span>
              <span>LITHIA</span><span>•</span>
              <span>SUBURBAN COLLECTION</span><span>•</span>
              <span>FERMAN MOTORS</span>
            </div>
          ))}
        </div>
      </section>

      {/* ============== STATS ============== */}
      <section className="py-20" id="customers">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center mb-12">
            <p className="text-xs uppercase tracking-[0.2em] mb-3" style={{ color: LIME }}>The numbers</p>
            <h2 className="ac-display text-4xl lg:text-5xl font-bold">What one rooftop did in 30 days.</h2>
          </div>
          <div className="grid md:grid-cols-4 gap-px bg-white/10 rounded-2xl overflow-hidden">
            {[
              { v: "47+", l: "acquisitions / mo" },
              { v: "$214K", l: "gross / month one" },
              { v: "0", l: "BDC headcount added" },
            ].map((s) => (
              <div key={s.l} className="p-8 text-center" style={{ background: INK }}>
                <div className="ac-display text-5xl lg:text-6xl font-bold" style={{ color: LIME }}>{s.v}</div>
                <div className="text-sm text-white/60 mt-2">{s.l}</div>
              </div>
            ))}
            <div className="p-8 text-center relative" style={{ background: INK }}>
              <div className="absolute top-3 right-3 text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full font-semibold" style={{ background: "rgba(199,255,26,0.2)", color: LIME }}>Ours</div>
              <div className="ac-display text-5xl lg:text-6xl font-bold flex items-center justify-center gap-2" style={{ color: LIME }}>
                <Check size={48} /> 1
              </div>
              <div className="text-sm text-white/60 mt-2">platform — not 5</div>
            </div>
          </div>
          <p className="text-center text-xs text-white/40 mt-6">Anonymized 30-day results from a single-rooftop Honda store, March 2026. Your mileage may vary.</p>
        </div>
      </section>

      {/* ============== BEFORE / AFTER ============== */}
      <section className="py-24 border-y border-white/5" style={{ background: "rgba(26,26,26,0.4)" }} id="compare">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center mb-16">
            <p className="text-xs uppercase tracking-[0.2em] mb-3" style={{ color: LIME }}>The honest picture</p>
            <h2 className="ac-display text-4xl lg:text-5xl font-bold">Your stack today vs.<br />your stack on AutoCurb.</h2>
          </div>

          <div className="grid lg:grid-cols-2 gap-8">
            <div className="border border-red-500/30 bg-red-500/5 rounded-2xl p-8">
              <div className="flex items-center gap-2 mb-6">
                <div className="text-xs uppercase tracking-wider text-red-400 bg-red-500/10 px-2 py-1 rounded-full font-semibold">Before</div>
                <div className="text-sm text-white/70">Your stack today</div>
              </div>
              <div className="space-y-3">
                {[
                  { initials: "AT", name: "AccuTrade widget", cost: "$1,500/mo" },
                  { initials: "KB", name: "KBB ICO leads (shared)", cost: "per-lead" },
                  { initials: "vA", name: "vAuto Provision", cost: "$3,000/mo" },
                  { initials: "iR", name: "inride.ai BDC bot", cost: "$undisclosed" },
                  { initials: "📋", name: "Spreadsheets + Post-its", cost: "your sanity" },
                ].map((r) => (
                  <div key={r.name} className="flex items-center justify-between p-3 rounded-lg border border-white/5" style={{ background: "rgba(10,10,10,0.6)" }}>
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 bg-white/10 rounded flex items-center justify-center text-xs font-semibold">{r.initials}</div>
                      <span className="text-sm">{r.name}</span>
                    </div>
                    <span className="text-sm text-red-400 font-mono">{r.cost}</span>
                  </div>
                ))}
              </div>
              <div className="mt-6 pt-6 border-t border-white/10 flex items-center justify-between">
                <span className="text-sm text-white/60">Total monthly bleed</span>
                <span className="ac-display text-2xl font-bold text-red-400 ac-strike">$5,000+</span>
              </div>
              <p className="text-xs text-white/40 mt-3">Plus: leads dropped between tools, no single source of truth, customer thinks they're selling to KBB.</p>
            </div>

            <div className="ac-gradient-border">
              <div className="p-8">
                <div className="flex items-center gap-2 mb-6">
                  <div className="text-xs uppercase tracking-wider px-2 py-1 rounded-full font-semibold" style={{ background: LIME, color: INK }}>After</div>
                  <div className="text-sm text-white/70">Your stack on AutoCurb</div>
                </div>
                <div className="border rounded-xl p-6" style={{ background: "rgba(199,255,26,0.05)", borderColor: "rgba(199,255,26,0.3)" }}>
                  <div className="flex items-center gap-3 mb-4">
                    <LogoMark size={40} />
                    <div>
                      <div className="ac-display font-bold text-xl">AutoCurb</div>
                      <div className="text-xs text-white/50">One platform · your brand on top</div>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    {[
                      "AI outreach + BDC",
                      "Instant offer widget",
                      "Service drive mining",
                      "Walk-in VIN scan",
                      "AI condition score",
                      "Inspection + appraisal",
                      "Check request gen",
                      "vAuto / DMS push",
                      "OBD-II diagnostics",
                      "Reporting + analytics",
                    ].map((f) => (
                      <div key={f} className="flex items-center gap-2 text-white/80">
                        <span style={{ color: LIME }}>✓</span> {f}
                      </div>
                    ))}
                  </div>
                </div>
                <div className="mt-6 pt-6 border-t border-white/10 flex items-center justify-between">
                  <span className="text-sm text-white/60">Monthly cost</span>
                  <div className="text-right">
                    <div className="ac-display text-2xl font-bold" style={{ color: LIME }}>From $299/mo</div>
                    <div className="text-xs text-white/50">Save 94% vs the stack above</div>
                  </div>
                </div>
                <p className="text-xs mt-3" style={{ color: "rgba(199,255,26,0.8)" }}>One login. One source of truth. Your name on every customer screen.</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ============== 3-PILLAR ============== */}
      <section className="py-24" id="platform">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center mb-16 max-w-2xl mx-auto">
            <p className="text-xs uppercase tracking-[0.2em] mb-3" style={{ color: LIME }}>How it works</p>
            <h2 className="ac-display text-4xl lg:text-5xl font-bold">Source. Score. Sign.</h2>
            <p className="text-white/60 mt-4">Every step from "I'm thinking about selling my car" to "here's your check" — under one roof.</p>
          </div>

          <div className="grid md:grid-cols-3 gap-6">
            {[
              {
                num: "01 · Source",
                title: "Every channel, one pipeline.",
                desc: "Web offer widget. Service-drive equity mining. Walk-in VIN scan. AI BDC outreach to your CRM. Each lead lands in the same branded pipeline — no cross-tool handoffs.",
                items: ["Web instant-offer form", "Service drive mining", "Walk-in VIN scan", "CRM AI outreach"],
              },
              {
                num: "02 · Score",
                title: "Know which deal to chase first.",
                desc: "AI photo damage detection. Live Black Book values. 0–100 lead score on 16 signals. Inspector-vs-AI disagreement flags. Stop chasing dead leads — let the score tell you who's hot.",
                items: ["AI condition scoring", "Black Book live tiers", "0–100 lead score", "OBD-II diagnostics"],
              },
              {
                num: "03 · Sign",
                title: "Click to check, in one tool.",
                desc: "Inspection → manager appraisal → customer accepts → check request generated → DMS push. The whole back half of acquisition lives where the front half started. No re-keying.",
                items: ["100+ inspection items", "Appraisal waterfall", "Check request gen", "vAuto / DMS push"],
              },
            ].map((p) => (
              <div key={p.num} className="rounded-2xl p-8 transition group border" style={{ background: "#1A1A1A", borderColor: "rgba(255,255,255,0.1)" }}>
                <div className="w-12 h-12 rounded-xl flex items-center justify-center mb-6 transition border" style={{ background: "rgba(199,255,26,0.1)", borderColor: "rgba(199,255,26,0.3)" }}>
                  <Check size={22} />
                </div>
                <div className="text-xs uppercase tracking-wider mb-2" style={{ color: LIME }}>{p.num}</div>
                <h3 className="ac-display text-2xl font-bold mb-3">{p.title}</h3>
                <p className="text-white/60 text-sm leading-relaxed">{p.desc}</p>
                <div className="mt-6 space-y-2 text-sm">
                  {p.items.map((it) => (
                    <div key={it} className="flex items-center gap-2 text-white/70">
                      <span style={{ color: LIME }}>→</span> {it}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ============== COMPARISON TABLE ============== */}
      <section className="py-24 border-y border-white/5" style={{ background: "rgba(26,26,26,0.4)" }}>
        <div className="max-w-6xl mx-auto px-6">
          <div className="text-center mb-12">
            <p className="text-xs uppercase tracking-[0.2em] mb-3" style={{ color: LIME }}>vs. the rest</p>
            <h2 className="ac-display text-4xl lg:text-5xl font-bold">No one else does the whole job.</h2>
          </div>

          <div className="overflow-x-auto rounded-2xl border border-white/10">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/10" style={{ background: "rgba(10,10,10,0.6)" }}>
                  <th className="text-left p-5 font-medium text-white/60"></th>
                  <th className="p-5 border-x" style={{ background: "rgba(199,255,26,0.1)", borderColor: "rgba(199,255,26,0.3)" }}>
                    <div className="ac-display font-bold text-base" style={{ color: LIME }}>AutoCurb</div>
                  </th>
                  <th className="p-5 font-medium text-white/60">inride.ai</th>
                  <th className="p-5 font-medium text-white/60">AccuTrade</th>
                  <th className="p-5 font-medium text-white/60">KBB ICO</th>
                  <th className="p-5 font-medium text-white/60">vAuto</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {[
                  { row: "AI outreach to your CRM", us: "✓", cells: ["✓", "—", "—", "—"] },
                  { row: "Instant offer widget", us: "✓", cells: ["—", "✓", "✓", "—"] },
                  { row: "Service drive equity mining", us: "✓", cells: ["—", "—", "—", "—"] },
                  { row: "Photo + doc + appointment flow", us: "✓", cells: ["—", "partial", "—", "—"] },
                  { row: "OBD-II diagnostics", us: "$80 1×", cells: ["—", "$1,500/mo", "—", "—"] },
                  { row: "Inspection → appraisal → check", us: "✓", cells: ["—", "—", "—", "post-buy"] },
                  { row: "Dealer-branded (not theirs)", us: "✓", cells: ["✓", "partial", "KBB owns lead", "✓"] },
                ].map((r) => (
                  <tr key={r.row}>
                    <td className="p-5 text-white/80">{r.row}</td>
                    <td className="text-center p-5 border-x" style={{ background: "rgba(199,255,26,0.05)", borderColor: "rgba(199,255,26,0.2)" }}>
                      <span className="text-lg" style={{ color: LIME }}>{r.us}</span>
                    </td>
                    {r.cells.map((c, i) => (
                      <td key={i} className={`text-center p-5 ${c === "✓" ? "" : c === "—" ? "text-white/30" : c.includes("$") || c.includes("KBB") ? "text-red-400 text-xs" : "text-white/40 text-xs"}`}>
                        {c === "✓" ? <span className="text-lg" style={{ color: LIME }}>✓</span> : c}
                      </td>
                    ))}
                  </tr>
                ))}
                <tr style={{ background: "rgba(10,10,10,0.4)" }}>
                  <td className="p-5 text-white font-semibold">Starting price</td>
                  <td className="text-center p-5 border-x ac-display font-bold" style={{ background: "rgba(199,255,26,0.05)", borderColor: "rgba(199,255,26,0.2)", color: LIME }}>$299/mo</td>
                  <td className="text-center p-5 text-white/60">undisclosed</td>
                  <td className="text-center p-5 text-red-400">$1,500/mo</td>
                  <td className="text-center p-5 text-white/60">per-lead</td>
                  <td className="text-center p-5 text-red-400">$1k–5k/mo</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* ============== TESTIMONIAL ============== */}
      <section className="py-24">
        <div className="max-w-4xl mx-auto px-6">
          <div className="border rounded-3xl p-12 text-center" style={{ background: "linear-gradient(135deg, rgba(199,255,26,0.1), transparent)", borderColor: "rgba(199,255,26,0.2)" }}>
            <svg className="mx-auto mb-6" width="48" height="48" viewBox="0 0 32 32" fill={LIME} opacity="0.4" aria-hidden>
              <path d="M0 16q0-7 4.5-11.5T16 0v4q-4 0-7 3t-3 7h6v12H0V16zm16 0q0-7 4.5-11.5T32 0v4q-4 0-7 3t-3 7h6v12H16V16z" />
            </svg>
            <p className="ac-display text-2xl lg:text-3xl text-white leading-snug">
              "We dropped AccuTrade and KBB ICO in week one. By month two we'd added <span style={{ color: LIME }}>23 acquisitions</span> we wouldn't have closed otherwise — same team, same headcount, one screen instead of five."
            </p>
            <div className="mt-8 flex items-center justify-center gap-4">
              <div className="w-12 h-12 rounded-full flex items-center justify-center ac-display font-bold border" style={{ background: "rgba(199,255,26,0.2)", borderColor: "rgba(199,255,26,0.4)", color: LIME }}>MK</div>
              <div className="text-left">
                <div className="font-semibold">Marcus Kennedy</div>
                <div className="text-sm text-white/50">GM · Koons Used Car Center</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ============== PRICING ============== */}
      <section className="py-24 border-y border-white/5" id="pricing" style={{ background: "rgba(26,26,26,0.4)" }}>
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center mb-16">
            <p className="text-xs uppercase tracking-[0.2em] mb-3" style={{ color: LIME }}>Pricing</p>
            <h2 className="ac-display text-4xl lg:text-5xl font-bold">No per-lead games. No surprise hikes.</h2>
            <p className="text-white/60 mt-4">All tiers include unlimited leads. Cancel anytime. 30-day money back.</p>
          </div>

          <div className="grid md:grid-cols-3 gap-6 max-w-5xl mx-auto">
            <PricingCard
              tier="Starter"
              price="$299"
              tagline="For single-rooftop independents."
              cta="Start free trial"
              ctaHref="#demo"
              features={[
                "Unlimited submissions",
                "Instant offer widget",
                "Pipeline + customer portal",
                "Photo + doc + appointment",
                "Email + SMS notifications",
              ]}
            />
            <PricingCard
              featured
              tier="Professional"
              price="$499"
              tagline="For franchise rooftops."
              cta="Book demo"
              ctaHref="#demo"
              features={[
                "Everything in Starter",
                "AI lead scoring",
                "AI photo damage scoring",
                "Service drive equity mining",
                "Multi-location",
                "Advanced analytics",
              ]}
            />
            <PricingCard
              tier="Enterprise"
              price="$999"
              tagline="For groups & captive finance."
              cta="Talk to sales"
              ctaHref="mailto:ken@ken.cc?subject=AutoCurb%20Enterprise"
              features={[
                "Everything in Professional",
                "API access + webhooks",
                "White-label removal",
                "vAuto / DMS push",
                "SSO + RBAC",
                "Priority support",
              ]}
            />
          </div>
        </div>
      </section>

      {/* ============== FINAL CTA ============== */}
      <section className="py-32 relative overflow-hidden" id="demo">
        <div className="absolute inset-0 ac-lime-glow" />
        <div className="relative max-w-4xl mx-auto px-6 text-center">
          <h2 className="ac-display text-5xl lg:text-7xl font-bold leading-[0.95]">
            Stop babysitting<br />
            <span style={{ color: LIME }}>your stack.</span>
          </h2>
          <p className="mt-6 text-xl text-white/70 max-w-2xl mx-auto">
            Run your rooftop on one platform. See your numbers in 24 hours.
          </p>
          <div className="mt-10 flex flex-wrap items-center justify-center gap-4">
            <a href="mailto:ken@ken.cc?subject=AutoCurb%20demo" className="font-semibold px-8 py-4 rounded-lg transition ac-shadow-lime text-lg flex items-center gap-2" style={{ background: LIME, color: INK }}>
              Get your numbers
              <ArrowRight size={20} />
            </a>
            <a href="#platform" className="text-white/90 font-medium px-8 py-4 rounded-lg border border-white/15 hover:border-white/30 hover:bg-white/5 transition text-lg">
              Watch 90-sec tour
            </a>
          </div>
          <p className="mt-6 text-sm text-white/40">No credit card. No installation. 7-day onboarding guarantee.</p>
        </div>
      </section>

      {/* ============== FOOTER ============== */}
      <footer className="border-t border-white/5 py-12">
        <div className="max-w-7xl mx-auto px-6">
          <div className="grid md:grid-cols-5 gap-8 mb-12">
            <div className="md:col-span-2">
              <div className="flex items-center gap-2 mb-4">
                <LogoMark size={28} />
                <span className="ac-display font-bold text-lg">AutoCurb</span>
              </div>
              <p className="text-sm text-white/50 max-w-xs">The AI acquisition OS for franchise & independent dealers.</p>
            </div>
            <FooterCol title="Product" items={[
              { label: "Platform", href: "#platform" },
              { label: "Pricing", href: "#pricing" },
              { label: "vs Competitors", href: "#compare" },
              { label: "Changelog", href: "/admin?section=changelog" },
            ]} />
            <FooterCol title="Company" items={[
              { label: "About", href: "/about" },
              { label: "Customers", href: "#customers" },
              { label: "Careers", href: "mailto:ken@ken.cc" },
              { label: "Press", href: "mailto:ken@ken.cc" },
            ]} />
            <FooterCol title="Resources" items={[
              { label: "Docs", href: "/docs" },
              { label: "API", href: "/docs" },
              { label: "Status", href: "/status" },
              { label: "Contact", href: "mailto:ken@ken.cc" },
            ]} />
          </div>
          <div className="pt-8 border-t border-white/5 flex flex-wrap items-center justify-between gap-4">
            <div className="text-sm text-white/40">© {new Date().getFullYear()} AutoCurb. All rights reserved.</div>
            <div className="flex items-center gap-6 text-sm text-white/40">
              <Link to="/privacy" className="hover:text-white">Privacy</Link>
              <Link to="/terms" className="hover:text-white">Terms</Link>
              <a href="/tcpa" className="hover:text-white">TCPA</a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
};

const PricingCard = ({
  tier,
  price,
  tagline,
  cta,
  ctaHref,
  features,
  featured,
}: {
  tier: string;
  price: string;
  tagline: string;
  cta: string;
  ctaHref: string;
  features: string[];
  featured?: boolean;
}) => {
  if (featured) {
    return (
      <div className="rounded-2xl p-8 relative ac-shadow-lime border-2" style={{ background: "linear-gradient(180deg, rgba(199,255,26,0.15), transparent)", borderColor: LIME }}>
        <div className="absolute -top-3 left-1/2 -translate-x-1/2 text-xs font-bold px-3 py-1 rounded-full uppercase tracking-wider" style={{ background: LIME, color: INK }}>
          Most popular
        </div>
        <div className="text-xs uppercase tracking-wider mb-2" style={{ color: LIME }}>{tier}</div>
        <div className="ac-display text-5xl font-bold mb-1">
          {price}<span className="text-lg text-white/50 font-normal">/mo</span>
        </div>
        <p className="text-sm text-white/60 mb-6">{tagline}</p>
        <a href={ctaHref} className="block text-center rounded-lg py-3 font-semibold mb-6 transition" style={{ background: LIME, color: INK }}>{cta}</a>
        <ul className="space-y-3 text-sm text-white/80">
          {features.map((f) => (
            <li key={f} className="flex gap-2"><span style={{ color: LIME }}>✓</span> {f}</li>
          ))}
        </ul>
      </div>
    );
  }
  return (
    <div className="rounded-2xl p-8 border" style={{ background: INK, borderColor: "rgba(255,255,255,0.1)" }}>
      <div className="text-xs uppercase tracking-wider text-white/50 mb-2">{tier}</div>
      <div className="ac-display text-5xl font-bold mb-1">
        {price}<span className="text-lg text-white/50 font-normal">/mo</span>
      </div>
      <p className="text-sm text-white/60 mb-6">{tagline}</p>
      <a href={ctaHref} className="block text-center bg-white/5 border border-white/10 hover:bg-white/10 rounded-lg py-3 font-semibold mb-6 transition">{cta}</a>
      <ul className="space-y-3 text-sm text-white/70">
        {features.map((f) => (
          <li key={f} className="flex gap-2"><span style={{ color: LIME }}>✓</span> {f}</li>
        ))}
      </ul>
    </div>
  );
};

const FooterCol = ({ title, items }: { title: string; items: { label: string; href: string }[] }) => (
  <div>
    <div className="text-xs uppercase tracking-wider text-white/40 mb-4">{title}</div>
    <ul className="space-y-2 text-sm text-white/70">
      {items.map((it) => (
        <li key={it.label}>
          <a href={it.href} className="hover:text-[color:var(--lime,#C7FF1A)] transition-colors" style={{ ["--lime" as never]: LIME }}>
            {it.label}
          </a>
        </li>
      ))}
    </ul>
  </div>
);

export default AutocurbLanding;
