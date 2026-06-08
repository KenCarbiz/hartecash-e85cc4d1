// Inline "Find your offer" section for the Moto landing.
//
// Mirrors the lookup form on /my-submission (CustomerLookup) but
// embeds it directly in the landing page body so the header
// "Sign In" link can smooth-scroll here instead of triggering a
// route change / page refresh.
//
// On submit it still calls the lookup_submission_by_contact RPC,
// then either navigates to /my-submission/:token for a single hit
// or shows a result list for multiple hits. Empty result shows a
// gentle "we couldn't find that — try the form above" message.
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { LogIn, Search, Car, ChevronRight, ArrowUp } from "lucide-react";
import { useSiteConfig } from "@/hooks/useSiteConfig";
import { useTenant } from "@/contexts/TenantContext";

// Progressive (xxx) xxx-xxxx mask. We store digits; the lookup RPC
// strips non-digits on both sides, so formatting is display-only and
// never affects matching.
const formatPhone = (raw: string) => {
  const d = (raw || "").replace(/\D/g, "").slice(0, 10);
  if (!d) return "";
  if (d.length < 4) return `(${d}`;
  if (d.length < 7) return `(${d.slice(0, 3)}) ${d.slice(3)}`;
  return `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}`;
};

interface FoundSubmission {
  token: string;
  vehicle_year: string | null;
  vehicle_make: string | null;
  vehicle_model: string | null;
  name: string | null;
}

const FindOfferLean = () => {
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [results, setResults] = useState<FoundSubmission[]>([]);
  const [searched, setSearched] = useState(false);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { config } = useSiteConfig();
  const { tenant } = useTenant();

  const dealerName = (config.dealership_name || "").trim();
  const shortName =
    dealerName && dealerName !== "Our Dealership" ? dealerName.split(/\s+/)[0] : null;

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !phone.trim()) return;
    setLoading(true);
    // Scope the lookup to the current dealership so someone who sold to
    // several dealers doesn't surface another dealer's portal token from
    // this landing (mirrors CustomerLookup). On the default/marketing
    // context — no real tenant resolved — there's nothing to scope to, so
    // we stay on the unscoped 2-arg form. We also fall back to it if the
    // 3-arg overload errors (deploy-order safety). An empty *scoped* result
    // is left as-is — we never widen a real tenant's search.
    const scoped =
      tenant.dealership_id && tenant.dealership_id !== "default"
        ? await supabase.rpc("lookup_submission_by_contact", {
            _email: email.trim(),
            _phone: phone.trim(),
            _dealership_id: tenant.dealership_id,
          } as never)
        : null;
    let data = scoped && !scoped.error ? scoped.data : null;
    if (!scoped || scoped.error) {
      const fallback = await supabase.rpc("lookup_submission_by_contact", {
        _email: email.trim(),
        _phone: phone.trim(),
      });
      data = fallback.data;
    }
    const found = (data as FoundSubmission[]) || [];
    setResults(found);
    setSearched(true);
    setLoading(false);
    if (found.length === 1) {
      navigate(`/my-submission/${found[0].token}`);
    }
  };

  const scrollToTop = () =>
    window.scrollTo({ top: 0, behavior: "smooth" });

  return (
    <section
      id="find-offer"
      // Inherits the landing's white bg — FindOfferLean is rendered
      // inline via the landing's hash-swap (#find-offer), so a soft-
      // gray section bg read as "the page just changed color" under
      // the (now persistent) sticky header. The standalone Sign In
      // route at /my-submission keeps its soft-gray "single-card on
      // a tray" treatment via CustomerLookup; that's the page-system
      // rule — single-artifact pages = soft-gray tray, in-page
      // sections that swap inside the landing = inherit white.
      className="scroll-mt-24 px-5 py-16 lg:py-20"
    >
      <div className="max-w-md mx-auto">
        <div className="text-center mb-8">
          <div
            className="inline-flex items-center justify-center w-12 h-12 rounded-2xl mb-5"
            style={{ background: "hsl(220 100% 96%)" }}
          >
            <LogIn className="w-5 h-5 text-primary" strokeWidth={1.75} />
          </div>
          <h2 className="text-3xl lg:text-[36px] font-bold text-foreground leading-[1.15] tracking-tight mb-3">
            Find your offer
          </h2>
          <p className="text-base text-foreground/65 leading-relaxed">
            {shortName
              ? `Returning to ${shortName}? Enter the email and phone you used when you submitted your vehicle.`
              : "Enter the email and phone you used when you submitted your vehicle."}
          </p>
        </div>

        <form
          onSubmit={handleSearch}
          className="bg-white rounded-3xl border border-border/60 shadow-[0_8px_32px_-12px_rgb(15_23_42_/_0.08)] p-7 lg:p-8 space-y-5"
        >
          <div>
            <label
              htmlFor="find-offer-email"
              className="text-sm font-semibold text-foreground mb-2 block"
            >
              Email
            </label>
            <input
              id="find-offer-email"
              type="email"
              autoComplete="email"
              inputMode="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full h-12 px-4 rounded-xl border border-border/70 bg-white text-base text-foreground placeholder:text-foreground/40 focus:outline-none focus:border-primary/60 focus:ring-2 focus:ring-primary/15 transition-colors"
            />
          </div>

          <div>
            <label
              htmlFor="find-offer-phone"
              className="text-sm font-semibold text-foreground mb-2 block"
            >
              Phone
            </label>
            <input
              id="find-offer-phone"
              type="tel"
              autoComplete="tel"
              inputMode="tel"
              placeholder="(555) 123-4567"
              value={formatPhone(phone)}
              onChange={(e) => setPhone(e.target.value.replace(/\D/g, "").slice(0, 10))}
              required
              className="w-full h-12 px-4 rounded-xl border border-border/70 bg-white text-base text-foreground placeholder:text-foreground/40 focus:outline-none focus:border-primary/60 focus:ring-2 focus:ring-primary/15 transition-colors"
            />
          </div>

          <button
            type="submit"
            disabled={loading || !email.trim() || !phone.trim()}
            className="w-full h-12 rounded-xl bg-[hsl(var(--cta-offer))] text-[color:var(--cta-offer-text)] font-semibold text-base flex items-center justify-center gap-2 hover:opacity-95 active:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-opacity focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[hsl(var(--cta-offer))]"
          >
            {loading ? (
              "Searching…"
            ) : (
              <>
                <Search className="w-4 h-4" />
                Find my offer
              </>
            )}
          </button>
        </form>

        {/* Results list (only when >1 match — single match auto-redirects). */}
        {searched && results.length > 1 && (
          <div className="mt-8 space-y-3">
            <p className="text-sm text-foreground/65 px-2">
              We found {results.length} offers on file:
            </p>
            {results.map((r) => (
              <button
                key={r.token}
                onClick={() => navigate(`/my-submission/${r.token}`)}
                className="w-full bg-white rounded-2xl border border-border/60 p-4 flex items-center gap-3 hover:border-primary/40 transition-colors text-left"
              >
                <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
                  <Car className="w-5 h-5 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold text-foreground truncate">
                    {[r.vehicle_year, r.vehicle_make, r.vehicle_model]
                      .filter(Boolean)
                      .join(" ") || "Your vehicle"}
                  </div>
                  {r.name && (
                    <div className="text-xs text-foreground/55 truncate">{r.name}</div>
                  )}
                </div>
                <ChevronRight className="w-4 h-4 text-foreground/40 flex-shrink-0" />
              </button>
            ))}
          </div>
        )}

        {searched && results.length === 0 && !loading && (
          <div className="mt-8 text-center">
            <p className="text-sm text-foreground/65 mb-4">
              We couldn't find an offer with that email and phone.
            </p>
            <button
              onClick={scrollToTop}
              className="inline-flex items-center gap-2 text-sm font-semibold text-primary hover:underline"
            >
              <ArrowUp className="w-4 h-4" />
              Get a new offer
            </button>
          </div>
        )}
      </div>
    </section>
  );
};

export default FindOfferLean;
