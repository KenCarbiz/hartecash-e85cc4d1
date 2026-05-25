import { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Star, Loader2, CheckCircle2, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useSiteConfig } from "@/hooks/useSiteConfig";
import { useTenant } from "@/contexts/TenantContext";

// Customer review page. Two entry points share this component:
//   /review/:token   — token-gated, sent to a customer after a deal.
//                      We pre-fill their vehicle + name (source 'token').
//   /leave-a-review   — public, any visitor (source 'public').
// Either way the review is inserted hidden + pending; a tenant admin
// approves or denies it before it appears on the site.

const RATE_LIMIT_MS = 30_000;
const RATE_LIMIT_KEY = "review_last_submit";

const isMissingColumnError = (err: { code?: string; message?: string } | null): boolean =>
  !!err && (err.code === "PGRST204" || /schema cache|column/i.test(err.message ?? ""));

const ReviewPage = () => {
  const { token } = useParams<{ token: string }>();
  const { config } = useSiteConfig();
  const { tenant } = useTenant();
  const isTokenFlow = Boolean(token);

  const [loading, setLoading] = useState(isTokenFlow);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState("");

  const [rating, setRating] = useState(5);
  const [hoverRating, setHoverRating] = useState(0);
  const [reviewText, setReviewText] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [location, setLocation] = useState("");
  const [vehicle, setVehicle] = useState("");
  const [honeypot, setHoneypot] = useState("");

  useEffect(() => {
    if (!token) return;
    supabase
      .rpc("get_submission_by_token", { _token: token })
      .then(({ data }) => {
        if (data && data.length > 0) {
          const s = data[0];
          setVehicle([s.vehicle_year, s.vehicle_make, s.vehicle_model].filter(Boolean).join(" "));
          const parts = (s.name || "").split(" ");
          setDisplayName(parts.length > 1 ? `${parts[0]} ${parts[1][0]}.` : parts[0] || "");
        } else {
          setError("We couldn't find your submission. This link may have expired.");
        }
        setLoading(false);
      });
  }, [token]);

  const handleSubmit = async () => {
    if (!reviewText.trim()) return;

    if (honeypot.trim()) {
      setSubmitted(true);
      return;
    }

    const last = Number(localStorage.getItem(RATE_LIMIT_KEY) || 0);
    if (Date.now() - last < RATE_LIMIT_MS) {
      setError("You've just submitted a review. Please wait a moment before trying again.");
      return;
    }

    setSubmitting(true);

    const base = {
      author_name: displayName.trim() || "Anonymous",
      location: location.trim(),
      vehicle: vehicle.trim(),
      review_text: reviewText.trim(),
      rating,
      is_active: false,
      dealership_id: tenant.dealership_id,
      sort_order: 99,
    };

    let { error: insertError } = await supabase.from("testimonials").insert({
      ...base,
      status: "pending",
      source: isTokenFlow ? "token" : "public",
    });
    if (insertError && isMissingColumnError(insertError)) {
      ({ error: insertError } = await supabase.from("testimonials").insert(base));
    }

    if (insertError) {
      setError("Something went wrong. Please try again.");
    } else {
      localStorage.setItem(RATE_LIMIT_KEY, String(Date.now()));
      setSubmitted(true);
    }
    setSubmitting(false);
  };

  // Shared dark-premium background wrapper used by all states.
  const Shell = ({ children }: { children: React.ReactNode }) => (
    <div className="relative min-h-screen overflow-hidden bg-[#0A0D0C] text-white">
      {/* Grid pattern */}
      <div
        aria-hidden
        className="absolute inset-0 opacity-[0.15]"
        style={{
          backgroundImage:
            "linear-gradient(rgba(255,255,255,0.06) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.06) 1px, transparent 1px)",
          backgroundSize: "44px 44px",
          maskImage: "radial-gradient(ellipse at center, black 40%, transparent 80%)",
          WebkitMaskImage: "radial-gradient(ellipse at center, black 40%, transparent 80%)",
        }}
      />
      {/* Green radial glow */}
      <div
        aria-hidden
        className="absolute left-1/2 top-1/3 -translate-x-1/2 -translate-y-1/2 w-[900px] h-[900px] rounded-full pointer-events-none"
        style={{
          background:
            "radial-gradient(circle, rgba(34,197,94,0.22) 0%, rgba(34,197,94,0.08) 35%, transparent 70%)",
          filter: "blur(20px)",
        }}
      />
      {/* Top edge fade */}
      <div aria-hidden className="absolute inset-x-0 top-0 h-40 bg-gradient-to-b from-black/60 to-transparent" />
      <div className="relative z-10 flex items-center justify-center min-h-screen px-4 sm:px-6 py-10 sm:py-16">
        {children}
      </div>
    </div>
  );

  if (loading) {
    return (
      <Shell>
        <Loader2 className="w-8 h-8 animate-spin text-emerald-400" />
      </Shell>
    );
  }

  if (error && !submitted) {
    return (
      <Shell>
        <div className="max-w-md text-center space-y-4">
          <p className="text-lg text-white/70">{error}</p>
          {!isTokenFlow && (
            <Button
              variant="outline"
              onClick={() => setError("")}
              className="bg-white/5 border-white/15 text-white hover:bg-white/10 hover:text-white"
            >
              Try again
            </Button>
          )}
        </div>
      </Shell>
    );
  }

  if (submitted) {
    return (
      <Shell>
        <div className="max-w-md text-center space-y-5 px-4">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-emerald-500/15 border border-emerald-400/30 mx-auto shadow-[0_0_40px_-8px_rgba(34,197,94,0.6)]">
            <CheckCircle2 className="w-10 h-10 text-emerald-400" />
          </div>
          <h1 className="text-3xl font-bold tracking-tight">Thank You</h1>
          <p className="text-white/70 leading-relaxed">
            Your review has been submitted and will appear on our site once approved.
            We truly appreciate your feedback.
          </p>
        </div>
      </Shell>
    );
  }

  return (
    <Shell>
      <div className="w-full max-w-xl">
        {/* Hero */}
        <div className="text-center mb-8 sm:mb-10">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-400/20 text-emerald-300 text-[11px] font-semibold uppercase tracking-[0.18em] mb-5">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(34,197,94,0.8)]" />
            Customer Review
          </div>
          <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-white mb-3">
            Share Your {config.dealership_name || "AutoCurb"} Experience
          </h1>
          <p className="text-white/60 text-base sm:text-lg max-w-md mx-auto leading-relaxed">
            Tell us how it went — your feedback helps other customers feel confident selling their vehicle.
          </p>
          {isTokenFlow && vehicle && (
            <div className="inline-flex items-center gap-2 bg-white/[0.04] border border-white/10 rounded-full px-4 py-1.5 mt-5">
              <span className="text-sm font-medium text-white/80">🚗 {vehicle}</span>
            </div>
          )}
        </div>

        {/* Card */}
        <div className="relative">
          {/* Card glow */}
          <div
            aria-hidden
            className="absolute -inset-px rounded-3xl bg-gradient-to-b from-emerald-400/20 via-white/5 to-transparent opacity-60 blur-sm"
          />
          <div className="relative bg-[#0F1413]/90 backdrop-blur-xl rounded-3xl border border-white/[0.08] shadow-[0_30px_80px_-20px_rgba(0,0,0,0.8)] p-6 sm:p-8 space-y-6">
            {/* Rating */}
            <div className="text-center">
              <Label className="text-xs font-semibold text-white/70 uppercase tracking-[0.14em] mb-4 block">
                How was your experience?
              </Label>
              <div className="flex justify-center gap-1.5 sm:gap-2">
                {[1, 2, 3, 4, 5].map((n) => {
                  const active = n <= (hoverRating || rating);
                  return (
                    <button
                      key={n}
                      type="button"
                      onClick={() => setRating(n)}
                      onMouseEnter={() => setHoverRating(n)}
                      onMouseLeave={() => setHoverRating(0)}
                      className="p-1.5 rounded-xl transition-all hover:scale-110 active:scale-95"
                      aria-label={`${n} star${n > 1 ? "s" : ""}`}
                    >
                      <Star
                        className={`w-9 h-9 sm:w-11 sm:h-11 transition-all ${
                          active
                            ? "fill-emerald-400 text-emerald-400 drop-shadow-[0_0_8px_rgba(34,197,94,0.6)]"
                            : "text-white/15"
                        }`}
                      />
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Review Text */}
            <div className="space-y-2">
              <Label className="text-xs font-semibold text-white/70 uppercase tracking-[0.12em]">
                Your Review
              </Label>
              <Textarea
                value={reviewText}
                onChange={(e) => setReviewText(e.target.value)}
                rows={4}
                placeholder="Tell us about your experience selling your car..."
                className="resize-none bg-white/[0.03] border-white/10 rounded-2xl text-white placeholder:text-white/30 focus-visible:ring-emerald-400/40 focus-visible:border-emerald-400/40 px-4 py-3"
              />
            </div>

            {/* Display Name & Location */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label className="text-xs font-semibold text-white/70 uppercase tracking-[0.12em]">
                  Your Name
                </Label>
                <Input
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder="Sarah M."
                  className="bg-white/[0.03] border-white/10 rounded-full text-white placeholder:text-white/30 focus-visible:ring-emerald-400/40 focus-visible:border-emerald-400/40 px-5 h-11"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-xs font-semibold text-white/70 uppercase tracking-[0.12em]">
                  City / Town
                </Label>
                <Input
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  placeholder="Hartford, CT"
                  className="bg-white/[0.03] border-white/10 rounded-full text-white placeholder:text-white/30 focus-visible:ring-emerald-400/40 focus-visible:border-emerald-400/40 px-5 h-11"
                />
              </div>
            </div>

            {!isTokenFlow && (
              <div className="space-y-2">
                <Label className="text-xs font-semibold text-white/70 uppercase tracking-[0.12em]">
                  Vehicle <span className="text-white/40 normal-case tracking-normal font-normal">(optional)</span>
                </Label>
                <Input
                  value={vehicle}
                  onChange={(e) => setVehicle(e.target.value)}
                  placeholder="2019 Toyota RAV4"
                  className="bg-white/[0.03] border-white/10 rounded-full text-white placeholder:text-white/30 focus-visible:ring-emerald-400/40 focus-visible:border-emerald-400/40 px-5 h-11"
                />
              </div>
            )}

            {/* Honeypot */}
            <div aria-hidden="true" className="absolute -left-[9999px] h-0 w-0 overflow-hidden">
              <label>
                Company
                <input
                  type="text"
                  tabIndex={-1}
                  autoComplete="off"
                  value={honeypot}
                  onChange={(e) => setHoneypot(e.target.value)}
                />
              </label>
            </div>

            <button
              type="button"
              onClick={handleSubmit}
              disabled={submitting || !reviewText.trim()}
              className="w-full h-12 rounded-full bg-emerald-400 hover:bg-emerald-300 text-[#06140E] font-bold text-base tracking-tight transition-all shadow-[0_10px_30px_-8px_rgba(34,197,94,0.55)] hover:shadow-[0_14px_40px_-8px_rgba(34,197,94,0.75)] active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center justify-center gap-2"
            >
              {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
              Submit My Review
            </button>

            <p className="text-[11px] text-center text-white/40 leading-relaxed px-2">
              By submitting, you agree to share your feedback publicly. Reviews may be featured on the
              {" "}{config.dealership_name || "AutoCurb"} website and dealer partner pages.
            </p>
          </div>
        </div>

        {/* Trust line */}
        <div className="mt-6 flex items-center justify-center gap-2 text-white/40 text-xs">
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-400/70" />
          Moderated by our team before going live
        </div>
      </div>
    </Shell>
  );
};

export default ReviewPage;
