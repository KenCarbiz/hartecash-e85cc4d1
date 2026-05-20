// Sign-in / customer-portal-entry page.
//
// Overhauled to match the Moto landing's clean-contemporary aesthetic
// per product-owner direction. Same design language as the new
// landing chrome (PRs #263–#274):
//
//   * Single soft-gray bg surface (hsl 220 14% 98%) flowing into the
//     BrandFooter — no separate hero block, no navy slab break
//   * Centered single-column card, rounded-3xl, hairline border,
//     soft shadow (matches ValueTrackerCard's outer shell language)
//   * One primary accent (the dealer's --primary), no gradients, no
//     trust-badge strip, no "Sell Another Vehicle" tinted CTA card
//   * Inputs use the same h-12 / rounded-xl pattern as the Moto form
//   * BrandFooter at the bottom (Moto template uses it via Index.tsx
//     but this page is a standalone route, so we mount it inline)
//
// Behavior unchanged: customer enters email + phone, lookup RPC
// returns matching submissions, click → /my-submission/:token.
// Empty-state offers a return-to-form path; results list each
// vehicle as a clickable card.
import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Search, Car, ChevronRight, ArrowRight, LogIn } from "lucide-react";
import SiteHeader from "@/components/SiteHeader";
import BrandFooter from "@/components/BrandFooter";
import SEO from "@/components/SEO";
import { useSiteConfig } from "@/hooks/useSiteConfig";

interface FoundSubmission {
  token: string;
  vehicle_year: string | null;
  vehicle_make: string | null;
  vehicle_model: string | null;
  name: string | null;
}

const CustomerLookup = () => {
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [results, setResults] = useState<FoundSubmission[]>([]);
  const [searched, setSearched] = useState(false);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { config } = useSiteConfig();

  const dealerName = (config.dealership_name || "").trim();
  const shortName = dealerName && dealerName !== "Our Dealership"
    ? dealerName.split(/\s+/)[0]
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

  return (
    <div
      className="min-h-screen flex flex-col"
      style={{ background: "hsl(220 14% 98%)" }}
    >
      <SEO
        title={`Sign in${shortName ? ` to ${shortName}` : ""} — Find your offer`}
        description="Sign in to view your offer, upload documents, or schedule your visit."
        path="/my-submission"
        noindex
      />

      <SiteHeader />

      <main className="flex-1 px-5 py-16 lg:py-24">
        <div className="max-w-md mx-auto">
          {/* Page heading — minimal, brand-voice, present tense. */}
          <div className="text-center mb-10">
            <div
              className="inline-flex items-center justify-center w-12 h-12 rounded-2xl mb-5"
              style={{ background: "hsl(220 100% 96%)" }}
            >
              <LogIn className="w-5 h-5 text-primary" strokeWidth={1.75} />
            </div>
            <h1 className="text-3xl lg:text-[40px] font-bold text-foreground leading-[1.15] tracking-tight mb-3">
              Find your offer
            </h1>
            <p className="text-base text-foreground/65 leading-relaxed">
              Enter the email and phone you used when you submitted your vehicle.
            </p>
          </div>

          {/* Lookup card — same shell language as ValueTrackerCard's
              inner card. White, hairline border, soft shadow. */}
          <form
            onSubmit={handleSearch}
            className="bg-white rounded-3xl border border-border/60 shadow-[0_8px_32px_-12px_rgb(15_23_42_/_0.08)] p-7 lg:p-8 space-y-5"
          >
            <div>
              <label
                htmlFor="signin-email"
                className="text-sm font-semibold text-foreground mb-2 block"
              >
                Email
              </label>
              <input
                id="signin-email"
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
                htmlFor="signin-phone"
                className="text-sm font-semibold text-foreground mb-2 block"
              >
                Phone
              </label>
              <input
                id="signin-phone"
                type="tel"
                autoComplete="tel"
                inputMode="tel"
                placeholder="(555) 123-4567"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                required
                className="w-full h-12 px-4 rounded-xl border border-border/70 bg-white text-base text-foreground placeholder:text-foreground/40 focus:outline-none focus:border-primary/60 focus:ring-2 focus:ring-primary/15 transition-colors"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-xl py-3.5 text-base font-semibold tracking-wide bg-[hsl(var(--cta-offer))] text-[color:var(--cta-offer-text)] hover:opacity-95 active:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-opacity focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[hsl(var(--cta-offer))]"
            >
              {loading ? "Searching…" : "Find my offer"}
            </button>
          </form>

          {/* Empty state — no results match. Soft tone, single recovery
              link back to the landing form. */}
          {searched && results.length === 0 && (
            <div className="mt-8 rounded-3xl border border-border/60 bg-white p-7 text-center">
              <p className="text-base font-semibold text-foreground mb-2">
                We couldn't find an offer with that info.
              </p>
              <p className="text-sm text-foreground/65 leading-relaxed mb-5">
                Double-check the email and phone — they need to match exactly
                what you used when you submitted.
              </p>
              <Link
                to="/"
                onClick={() => window.scrollTo(0, 0)}
                className="inline-flex items-center gap-2 text-sm font-semibold text-primary underline-offset-4 hover:underline"
              >
                Or start a new offer
                <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
          )}

          {/* Results list — one card per matching submission. Same
              card token as the form above so the page reads as one
              continuous system. */}
          {results.length > 0 && (
            <div className="mt-8 space-y-3">
              <p className="text-xs uppercase tracking-[0.12em] font-semibold text-foreground/55 px-1 mb-1">
                Your offers
              </p>
              {results.map((r) => {
                const vehicleLine =
                  [r.vehicle_year, r.vehicle_make, r.vehicle_model]
                    .filter(Boolean)
                    .join(" ") || "Vehicle";
                return (
                  <button
                    key={r.token}
                    type="button"
                    onClick={() => navigate(`/my-submission/${r.token}`)}
                    className="w-full rounded-2xl border border-border/60 bg-white p-5 hover:border-primary/40 hover:shadow-[0_8px_24px_-12px_rgb(15_23_42_/_0.1)] transition-all text-left flex items-center gap-4 group focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
                  >
                    <div
                      className="shrink-0 w-12 h-12 rounded-xl flex items-center justify-center"
                      style={{ background: "hsl(220 14% 96%)" }}
                    >
                      <Car
                        className="w-5 h-5"
                        strokeWidth={1.5}
                        style={{ color: "hsl(220 13% 35%)" }}
                      />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-base font-semibold text-foreground truncate">
                        {vehicleLine}
                      </p>
                      {r.name && (
                        <p className="text-sm text-foreground/60 truncate">
                          {r.name}
                        </p>
                      )}
                    </div>
                    <ChevronRight
                      className="w-4 h-4 text-foreground/40 group-hover:text-primary transition-colors shrink-0"
                      strokeWidth={2}
                    />
                  </button>
                );
              })}
            </div>
          )}

          {/* New-customer link — quiet text link to the form, not a
              bright tinted CTA card. Matches the calm closing-slab
              voice from the rest of the landing. */}
          {!searched && (
            <p className="text-center mt-10 text-sm text-foreground/60">
              First time here?{" "}
              <Link
                to="/"
                onClick={() => window.scrollTo(0, 0)}
                className="font-semibold text-primary underline-offset-4 hover:underline"
              >
                Get an offer
              </Link>
            </p>
          )}
        </div>
      </main>

      <BrandFooter />
    </div>
  );
};

export default CustomerLookup;
