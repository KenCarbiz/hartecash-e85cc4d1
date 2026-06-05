// /sub-processors — public, dated list of the vendors AutoCurb uses to
// process dealer/customer data. A standard trust artifact referenced by
// the DPA (Schedule 1) and the Privacy Policy.

import { Link } from "react-router-dom";
import { ArrowLeft, Network } from "lucide-react";
import SEO from "@/components/SEO";

const ROWS: { name: string; purpose: string; data: string; location: string }[] = [
  { name: "Supabase / AWS", purpose: "Hosting, database, authentication, file storage", data: "All platform data (encrypted)", location: "United States" },
  { name: "Twilio", purpose: "SMS/MMS and voice telephony", data: "Phone number, message content", location: "United States" },
  { name: "Bland AI", purpose: "Outbound AI voice calls", data: "Phone number, call audio/transcript", location: "United States" },
  { name: "Anthropic", purpose: "AI call grading / sentiment (text)", data: "Call transcript text (no model training)", location: "United States" },
  { name: "OpenAI", purpose: "Speech‑to‑text transcription", data: "Call audio (no model training)", location: "United States" },
  { name: "Resend / SendGrid", purpose: "Transactional & notification email", data: "Email address, message content", location: "United States" },
  { name: "DealerTrack / RouteOne", purpose: "Loan payoff verification (only when authorized)", data: "Lender + payoff details", location: "United States" },
  { name: "Stripe", purpose: "Dealer billing", data: "Dealer billing details only — no consumer data", location: "United States" },
];

const SubProcessors = () => (
  <div className="min-h-screen flex flex-col" style={{ background: "hsl(220 14% 98%)" }}>
    <SEO title="Sub-processors | AutoCurb" description="The vendors AutoCurb uses to process dealership and customer data, each bound to no-sale and no-secondary-use terms." path="/sub-processors" />
    <main className="flex-1 px-5 py-12 lg:py-16">
      <div className="max-w-3xl mx-auto">
        <Link to="/" onClick={() => window.scrollTo(0, 0)} className="inline-flex items-center gap-2 text-sm font-semibold text-foreground/70 hover:text-foreground transition-colors mb-8">
          <ArrowLeft className="w-4 h-4" /> Back
        </Link>
        <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-primary/10 mb-4">
          <Network className="w-6 h-6 text-primary" />
        </div>
        <h1 className="text-3xl lg:text-[40px] font-bold text-foreground leading-tight tracking-tight mb-3">Sub‑processors</h1>
        <p className="text-[15px] text-foreground/70 leading-relaxed mb-8">
          AutoCurb engages the vendors below to help deliver the service. Each is bound by written contract
          to data‑protection and security obligations no less protective than our{" "}
          <Link to="/dpa" className="text-primary underline-offset-4 hover:underline">Data Processing Agreement</Link>,
          including no sale and no secondary use of your customers' data. We give dealers at least 30 days'
          notice before adding or replacing a sub‑processor.
        </p>

        <div className="bg-white rounded-3xl border border-border/60 shadow-[0_8px_32px_-12px_rgb(15_23_42_/_0.08)] overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-[hsl(220_14%_96%)] text-foreground/70">
              <tr>
                <th className="text-left font-semibold px-4 py-3">Sub‑processor</th>
                <th className="text-left font-semibold px-4 py-3">Purpose</th>
                <th className="text-left font-semibold px-4 py-3 hidden sm:table-cell">Data</th>
                <th className="text-left font-semibold px-4 py-3 hidden md:table-cell">Location</th>
              </tr>
            </thead>
            <tbody className="text-foreground/75">
              {ROWS.map((r) => (
                <tr key={r.name} className="border-t border-border/50 align-top">
                  <td className="px-4 py-3 font-medium text-foreground">{r.name}</td>
                  <td className="px-4 py-3">{r.purpose}</td>
                  <td className="px-4 py-3 hidden sm:table-cell">{r.data}</td>
                  <td className="px-4 py-3 hidden md:table-cell">{r.location}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-4 text-xs text-foreground/45">Last updated: {new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}.</p>
      </div>
    </main>
  </div>
);

export default SubProcessors;
