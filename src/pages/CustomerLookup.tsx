// Portal entry / transaction continuation page.
//
// Redesigned (Dec 2026) to feel like a premium secure transaction
// continuation experience rather than a generic login form. Mirrors
// the visual language of the customer portal (PaymentsPage, sidebar)
// — indigo→violet gradient CTA, soft shadows, restrained chrome.
//
// Behavior unchanged: customer enters email + phone, lookup RPC returns
// matching submissions, click → /my-submission/:token. Optional
// "welcome back" card surfaces if a recently-tracked vehicle exists in
// localStorage (written by MotoTrackValueBlock).
import { useEffect, useMemo, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import {
  Search, Car, ChevronRight, ArrowRight, ShieldCheck,
  FileText, Upload, DollarSign, Truck, HelpCircle, LifeBuoy, Mail,
  LockKeyhole, Sparkles, Phone as PhoneIcon,
} from "lucide-react";
import SEO from "@/components/SEO";
import { useSiteConfig } from "@/hooks/useSiteConfig";

interface FoundSubmission {
  token: string;
  vehicle_year: string | null;
  vehicle_make: string | null;
  vehicle_model: string | null;
  name: string | null;
}

// Match key written by MotoTrackValueBlock.
const SUB_STORAGE_PREFIX = "moto.watched_token.";

interface LastSession {
  token: string;
  label: string;
}

const readLastSession = (): LastSession | null => {
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (!k || !k.startsWith(SUB_STORAGE_PREFIX)) continue;
      const token = localStorage.getItem(k);
      if (!token) continue;
      const suffix = k.slice(SUB_STORAGE_PREFIX.length);
      // suffix is either a VIN (17 chars, no dashes in the YMM form)
      // or `${year}-${make}-${model}`
      const label = suffix.includes("-")
        ? suffix.split("-").join(" ")
        : "Your saved vehicle";
      return { token, label };
    }
  } catch { /* localStorage blocked */ }
  return null;
};

const CustomerLookup = () => {
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [results, setResults] = useState<FoundSubmission[]>([]);
  const [searched, setSearched] = useState(false);
  const [loading, setLoading] = useState(false);
  const [lastSession, setLastSession] = useState<LastSession | null>(null);
  const navigate = useNavigate();
  const { config } = useSiteConfig();

  useEffect(() => { setLastSession(readLastSession()); }, []);

  const dealerName = (config.dealership_name || "").trim();
  const shortName = dealerName && dealerName !== "Our Dealership"
    ? dealerName.split(/\s+/)[0]
    : null;
  const logoUrl = (config as { logo_url?: string }).logo_url || null;

  // Header links resolve to the tenant's real contact channels. Support
  // dials the dealer; Contact opens email (falling back to phone); FAQ
  // uses a full-page anchor so it actually scrolls to the landing's #faq
  // section (a React-Router <Link> to a hash does not scroll).
  const phoneDigits = (config.phone || "").replace(/\D/g, "");
  const contactHref = config.email
    ? `mailto:${config.email}`
    : phoneDigits
      ? `tel:${phoneDigits}`
      : null;

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !phone.trim()) return;
    setLoading(true);
    const { data } = await supabase.rpc("lookup_submission_by_contact", {
      _email: email.trim(),
      _phone: phone.trim(),
    });
    setResults((data as FoundSubmission[]) || []);
    setSearched(true);
    setLoading(false);
  };

  const handoffLabel = ((): string => {
    switch (config.handoff_type) {
      case "pickup":
        return "Schedule Pickup";
      case "dropoff":
        return "Schedule Drop Off";
      case "both":
      default:
        return "Schedule Pickup / Drop Off";
    }
  })();

  const reassurance = useMemo(() => ([
    { icon: FileText, title: "View Offer" },
    { icon: Upload, title: "Upload Documents" },
    { icon: DollarSign, title: "Track Payout" },
    { icon: Truck, title: handoffLabel },
  ]), [handoffLabel]);


  return (
    <div
      className="min-h-screen flex flex-col"
      style={{ background: "hsl(220 20% 97%)" }}
    >
      <SEO
        title={`Continue your vehicle sale${shortName ? ` — ${shortName}` : ""}`}
        description="Securely continue your vehicle transaction — view your offer, upload documents, track payout, and schedule pickup."
        path="/my-submission"
        noindex
      />

      {/* Slim portal-style header — logo + lightweight support links. */}
      <header className="border-b border-border/40 bg-white/70 backdrop-blur-md sticky top-0 z-30">
        <div className="max-w-6xl mx-auto px-5 h-16 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2.5 group">
            {logoUrl ? (
              <img src={logoUrl} alt={dealerName || "Home"} className="h-10 w-auto" />
            ) : (
              <span className="text-base font-bold tracking-tight text-foreground">
                {dealerName || "Customer Portal"}
              </span>
            )}
          </Link>
          <nav className="flex items-center gap-1 sm:gap-2 text-sm">
            {phoneDigits && (
              <a href={`tel:${phoneDigits}`} className="hidden sm:inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-foreground/70 hover:text-foreground hover:bg-foreground/5 transition-colors">
                <LifeBuoy className="w-4 h-4" /> Support
              </a>
            )}
            <a href="/#faq" className="hidden sm:inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-foreground/70 hover:text-foreground hover:bg-foreground/5 transition-colors">
              <HelpCircle className="w-4 h-4" /> FAQ
            </a>
            {contactHref ? (
              <a href={contactHref} className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-foreground/70 hover:text-foreground hover:bg-foreground/5 transition-colors">
                <Mail className="w-4 h-4" /> Contact
              </a>
            ) : (
              <Link to="/about" className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-foreground/70 hover:text-foreground hover:bg-foreground/5 transition-colors">
                <Mail className="w-4 h-4" /> Contact
              </Link>
            )}
            <span className="hidden md:inline-flex items-center gap-1.5 ml-2 px-3 py-1.5 rounded-full bg-[#EEF0FF] text-[#6D28D9] text-xs font-semibold">
              <ShieldCheck className="w-3.5 h-3.5" /> Secure Login
            </span>
          </nav>
        </div>
      </header>

      <main className="flex-1 flex items-center px-5 py-10 lg:py-16">
        <div className="w-full max-w-[34rem] mx-auto">
          {/* Heading — emotional continuity with the transaction. */}
          <div className="text-center mb-8">
            <div className="relative inline-flex items-center justify-center mb-5">
              <span
                aria-hidden
                className="absolute inset-0 -m-3 rounded-full blur-2xl opacity-70"
                style={{ background: "radial-gradient(closest-side, rgba(124,58,237,0.35), rgba(79,70,229,0.15), transparent 70%)" }}
              />
              <span className="relative inline-flex items-center justify-center w-[58px] h-[58px] rounded-2xl bg-gradient-to-br from-[#6D28D9] to-[#6D28D9] shadow-[0_14px_32px_-12px_rgba(124,58,237,0.6)] ring-4 ring-white">
                <LockKeyhole className="w-7 h-7 text-white" strokeWidth={2} />
              </span>
            </div>
            <h1 className="text-3xl lg:text-[38px] font-bold text-foreground leading-[1.15] tracking-tight mb-3">
              Continue Your Vehicle Sale
            </h1>
            <p className="text-base text-foreground/65 leading-relaxed max-w-[520px] mx-auto">
              Access your vehicle dashboard, documents, payout details, and next steps.
            </p>
          </div>

          {/* Session continuity — only if a saved vehicle exists. */}
          {lastSession && !searched && (
            <button
              type="button"
              onClick={() => navigate(`/my-submission/${lastSession.token}`)}
              className="w-full mb-5 rounded-2xl border border-[#C7D2FE] bg-gradient-to-br from-[#EEF0FF] via-white to-white p-5 text-left flex items-center gap-4 hover:shadow-[0_12px_28px_-14px_rgba(79,70,229,0.35)] hover:border-[#6D28D9]/30 transition-all group focus:outline-none focus-visible:ring-2 focus-visible:ring-[#6D28D9]/40"
            >
              <div className="shrink-0 w-12 h-12 rounded-xl bg-gradient-to-br from-[#6D28D9] to-[#6D28D9] shadow-[0_6px_16px_-6px_rgba(79,70,229,0.45)] grid place-items-center">
                <Car className="w-5 h-5 text-white" strokeWidth={2} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold uppercase tracking-[0.1em] text-[#6D28D9] mb-1">
                  Welcome back
                </p>
                <p className="text-sm font-semibold text-foreground truncate capitalize">
                  {lastSession.label}
                </p>
                <p className="text-xs text-foreground/55">Continue where you left off</p>
              </div>
              <ChevronRight className="w-5 h-5 text-[#6D28D9] shrink-0 group-hover:translate-x-0.5 transition-transform" />
            </button>
          )}

          {/* Lookup card — larger, softer, more premium. */}
          <form
            onSubmit={handleSearch}
            className="bg-white rounded-3xl border border-border/50 shadow-[0_20px_50px_-20px_rgb(15_23_42_/_0.12),0_8px_20px_-12px_rgb(15_23_42_/_0.06)] p-7 lg:p-9 space-y-6"
          >
            <div>
              <label htmlFor="signin-email" className="text-sm font-semibold text-foreground mb-2 block">
                Email
              </label>
              <div className="relative">
                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-foreground/40 pointer-events-none" strokeWidth={2} />
                <input
                  id="signin-email"
                  type="email"
                  autoComplete="email"
                  inputMode="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="w-full h-12 pl-11 pr-4 rounded-xl border border-border/70 bg-white text-base text-foreground placeholder:text-foreground/40 focus:outline-none focus:border-[#6D28D9]/60 focus:ring-2 focus:ring-[#6D28D9]/15 transition-colors"
                />
              </div>
            </div>

            <div>
              <label htmlFor="signin-phone" className="text-sm font-semibold text-foreground mb-2 block">
                Phone
              </label>
              <div className="relative">
                <PhoneIcon className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-foreground/40 pointer-events-none" strokeWidth={2} />
                <input
                  id="signin-phone"
                  type="tel"
                  autoComplete="tel"
                  inputMode="tel"
                  placeholder="(555) 123-4567"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  required
                  className="w-full h-12 pl-11 pr-4 rounded-xl border border-border/70 bg-white text-base text-foreground placeholder:text-foreground/40 focus:outline-none focus:border-[#6D28D9]/60 focus:ring-2 focus:ring-[#6D28D9]/15 transition-colors"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-xl py-3.5 text-base font-semibold tracking-wide text-white bg-gradient-to-r from-[#6D28D9] to-[#6D28D9] hover:from-[#4338CA] hover:to-[#6D28D9] shadow-[0_10px_24px_-10px_rgba(79,70,229,0.55)] hover:shadow-[0_14px_32px_-12px_rgba(79,70,229,0.65)] disabled:opacity-60 disabled:cursor-not-allowed transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[#6D28D9] flex items-center justify-center gap-2"
            >
              {loading ? "Searching…" : (<><Search className="w-4 h-4" /> Access My Transaction</>)}
            </button>

            <p className="flex items-center justify-center gap-1.5 text-xs text-foreground/55">
              <LockKeyhole className="w-3.5 h-3.5 text-[#6D28D9]" strokeWidth={2} />
              Secure access · Your info is never shared
            </p>
          </form>

          {/* Portal benefits — informational tiles, not buttons. */}
          <div className="mt-5 lg:mt-6">
            <div className="flex items-center justify-center gap-3 mb-4" aria-hidden>
              <span className="h-px flex-1 bg-gradient-to-r from-transparent via-border to-border/50" />
              <Sparkles className="w-3 h-3 text-[#6D28D9]/60" strokeWidth={2} />
              <p className="text-[11px] uppercase tracking-[0.14em] font-semibold text-foreground/50">
                Inside your portal
              </p>
              <Sparkles className="w-3 h-3 text-[#6D28D9]/60" strokeWidth={2} />
              <span className="h-px flex-1 bg-gradient-to-l from-transparent via-border to-border/50" />
            </div>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-5">
              {reassurance.map(({ icon: Icon, title }) => (
                <div
                  key={title}
                  className="rounded-2xl border border-border/25 bg-white px-6 py-7 text-center shadow-[0_2px_12px_-6px_rgba(15,23,42,0.06)] flex flex-col items-center justify-center gap-3.5"
                >
                  <div className="w-[62px] h-[62px] rounded-full bg-[#F5F3FF] grid place-items-center">
                    <Icon className="w-[22px] h-[22px] text-[#6D28D9]" strokeWidth={2} />
                  </div>
                  <p className="text-[15px] font-extrabold text-foreground leading-tight">
                    {title}
                  </p>
                </div>
              ))}
            </div>
          </div>

          {/* Empty state. */}
          {searched && results.length === 0 && (
            <div className="mt-6 rounded-2xl border border-border/60 bg-white p-6 text-center">
              <p className="text-base font-semibold text-foreground mb-2">
                We couldn't find a transaction with that info.
              </p>
              <p className="text-sm text-foreground/65 leading-relaxed mb-5">
                Double-check the email and phone — they need to match exactly
                what you used when you submitted.
              </p>
              <Link
                to="/"
                onClick={() => window.scrollTo(0, 0)}
                className="inline-flex items-center gap-2 text-sm font-semibold text-[#6D28D9] underline-offset-4 hover:underline"
              >
                Start a new offer
                <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
          )}

          {/* Results. */}
          {results.length > 0 && (
            <div className="mt-6 space-y-3">
              <p className="text-xs uppercase tracking-[0.12em] font-semibold text-foreground/55 px-1 mb-1">
                Your transactions
              </p>
              {results.map((r) => {
                const vehicleLine =
                  [r.vehicle_year, r.vehicle_make, r.vehicle_model]
                    .filter(Boolean).join(" ") || "Vehicle";
                return (
                  <button
                    key={r.token}
                    type="button"
                    onClick={() => navigate(`/my-submission/${r.token}`)}
                    className="w-full rounded-2xl border border-border/60 bg-white p-5 hover:border-[#6D28D9]/40 hover:shadow-[0_12px_28px_-14px_rgba(79,70,229,0.25)] transition-all text-left flex items-center gap-4 group focus:outline-none focus-visible:ring-2 focus-visible:ring-[#6D28D9]/30"
                  >
                    <div className="shrink-0 w-12 h-12 rounded-xl bg-gradient-to-br from-[#6D28D9] to-[#6D28D9] shadow-[0_6px_16px_-6px_rgba(79,70,229,0.45)] grid place-items-center">
                      <Car className="w-5 h-5 text-white" strokeWidth={2} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-base font-semibold text-foreground truncate">
                        {vehicleLine}
                      </p>
                      {r.name && (
                        <p className="text-sm text-foreground/60 truncate">{r.name}</p>
                      )}
                    </div>
                    <ChevronRight className="w-4 h-4 text-foreground/40 group-hover:text-[#6D28D9] transition-colors shrink-0" strokeWidth={2} />
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </main>

      {/* Slim portal-style footer — no marketing CTA. */}
      <footer className="border-t border-border/40 bg-white/60">
        <div className="max-w-6xl mx-auto px-5 py-5 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-foreground/55">
          <span>© {new Date().getFullYear()} {dealerName || "Customer Portal"}</span>
          <span className="inline-flex items-center gap-1.5">
            <ShieldCheck className="w-3.5 h-3.5" />
            Secure transaction access
          </span>
        </div>
      </footer>
    </div>
  );
};

export default CustomerLookup;
