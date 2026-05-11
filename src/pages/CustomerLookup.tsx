import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Search, Car, Shield, ChevronRight, Clock, Star, ArrowRight } from "lucide-react";
import SiteHeader from "@/components/SiteHeader";
import SiteFooter from "@/components/SiteFooter";
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
    <div className="min-h-screen bg-background flex flex-col">
      <SiteHeader />

      {/* Hero Header */}
      <section className="bg-primary text-primary-foreground py-12 md:py-16 px-5">
        <div className="max-w-2xl mx-auto text-center">
          <div className="w-16 h-16 rounded-2xl bg-primary-foreground/10 flex items-center justify-center mx-auto mb-5">
            <Search className="w-8 h-8 text-primary-foreground" />
          </div>
          <h1 className="font-display text-3xl md:text-4xl font-extrabold tracking-[0.04em] mb-3">
            Find My Submission
          </h1>
          <p className="text-primary-foreground/70 text-base md:text-lg max-w-lg mx-auto">
            Already submitted your vehicle? Look up your submission to check your offer status, upload documents, or schedule your visit.
          </p>
        </div>
      </section>

      {/* Trust badges */}
      <div className="bg-card border-b border-border py-4 px-5">
        <div className="max-w-2xl mx-auto flex items-center justify-center gap-6 md:gap-10 text-xs text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <Shield className="w-3.5 h-3.5 text-primary" />
            Secure & Private
          </span>
          <span className="flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5 text-primary" />
            Instant Results
          </span>
          <span className="flex items-center gap-1.5">
            <Star className="w-3.5 h-3.5 text-primary" />
            {config.stats_rating || "4.9"}-Star Rated
          </span>
        </div>
      </div>

      {/* Main Content */}
      <main className="flex-1 py-10 md:py-14 px-5">
        <div className="max-w-lg mx-auto">
          {/* Search Form */}
          <form onSubmit={handleSearch} className="bg-card rounded-xl p-6 md:p-8 shadow-sm border border-border space-y-5">
            <div className="text-center mb-2">
              <h2 className="font-display text-xl font-bold text-foreground mb-1">Look Up Your Vehicle</h2>
              <p className="text-sm text-muted-foreground">
                Enter the email and phone you used when you submitted.
              </p>
            </div>
            <div>
              <label className="text-sm font-semibold text-foreground mb-1.5 block">Email Address</label>
              <Input
                type="email"
                placeholder="your@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="h-12"
              />
            </div>
            <div>
              <label className="text-sm font-semibold text-foreground mb-1.5 block">Phone Number</label>
              <Input
                type="tel"
                placeholder="(555) 123-4567"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                required
                className="h-12"
              />
            </div>
            <Button type="submit" disabled={loading} size="lg" className="w-full font-bold text-base gap-2">
              {loading ? "Searching..." : (
                <>
                  <Search className="w-4 h-4" />
                  Find My Submission
                </>
              )}
            </Button>
          </form>

          {/* Results */}
          {searched && results.length === 0 && (
            <div className="mt-8 text-center bg-card border border-border rounded-xl p-6">
              <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center mx-auto mb-3">
                <Search className="w-5 h-5 text-muted-foreground" />
              </div>
              <p className="font-semibold text-foreground mb-1">No Submissions Found</p>
              <p className="text-sm text-muted-foreground mb-4">
                We couldn't find any submissions matching that email and phone number. Double-check your info or start a new submission.
              </p>
              <Link to="/" onClick={() => window.scrollTo(0, 0)}>
                <Button variant="outline" className="gap-2">
                  Get Your Cash Offer <ArrowRight className="w-4 h-4" />
                </Button>
              </Link>
            </div>
          )}

          {results.length > 0 && (
            <div className="mt-8 space-y-3">
              <h3 className="font-display text-lg font-bold text-foreground">Your Submissions</h3>
              {results.map((r) => (
                <button
                  key={r.token}
                  onClick={() => navigate(`/my-submission/${r.token}`)}
                  className="w-full bg-card rounded-xl p-5 shadow-sm border border-border hover:border-primary/40 hover:shadow-md transition-all text-left flex items-center gap-4 group"
                >
                  <div className="shrink-0 w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
                    <Car className="w-6 h-6 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-foreground truncate">
                      {[r.vehicle_year, r.vehicle_make, r.vehicle_model].filter(Boolean).join(" ") || "Vehicle"}
                    </p>
                    {r.name && <p className="text-sm text-muted-foreground truncate">{r.name}</p>}
                  </div>
                  <ChevronRight className="w-5 h-5 text-muted-foreground group-hover:text-primary transition-colors shrink-0" />
                </button>
              ))}
            </div>
          )}

          {/* Sell Another CTA */}
          <div className="mt-10 bg-primary/5 border border-primary/20 rounded-xl p-6 text-center">
            <h3 className="font-display text-lg font-bold text-foreground mb-1">Have Another Vehicle?</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Get a cash offer in under 2 minutes — no obligation.
            </p>
            <Link to="/" onClick={() => window.scrollTo(0, 0)}>
              <Button className="gap-2 font-bold">
                Sell Another Vehicle <ArrowRight className="w-4 h-4" />
              </Button>
            </Link>
          </div>

          {/* Security note */}
          <p className="text-center mt-6 text-xs text-muted-foreground flex items-center justify-center gap-1.5">
            <Shield className="w-3.5 h-3.5" />
            We only show submissions matching your exact contact information.
          </p>
        </div>
      </main>

      <SiteFooter />
    </div>
  );
};

export default CustomerLookup;
