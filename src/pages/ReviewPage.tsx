import { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Star, Loader2, CheckCircle2, ShieldCheck, MessageSquareQuote } from "lucide-react";
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

  /* ── shared light-themed shell ── */
  const Shell = ({ children }: { children: React.ReactNode }) => (
    <div className="relative min-h-screen overflow-hidden bg-[#F7F8FB] text-[#06194A]">
      {/* Very subtle top accent bar */}
      <div aria-hidden className="absolute inset-x-0 top-1.5 h-[3px] bg-gradient-to-r from-[#4F46E5] via-[#7C3AED] to-[#4F46E5] opacity-30" />
      {/* Soft radial tint behind card */}
      <div
        aria-hidden
        className="absolute left-1/2 top-[30%] -translate-x-1/2 -translate-y-1/2 w-[800px] h-[600px] rounded-full pointer-events-none"
        style={{
          background: "radial-gradient(circle, rgba(79,70,229,0.06) 0%, rgba(124,58,237,0.03) 40%, transparent 70%)",
          filter: "blur(40px)",
        }}
      />
      <div className="relative z-10 flex items-center justify-center min-h-screen px-4 sm:px-6 py-10 sm:py-16">
        {children}
      </div>
    </div>
  );

  if (loading) {
    return (
      <Shell>
        <Loader2 className="w-8 h-8 animate-spin text-[#4F46E5]" />
      </Shell>
    );
  }

  if (error && !submitted) {
    return (
      <Shell>
        <div className="max-w-md text-center space-y-4">
          <p className="text-lg text-[#53627A]">{error}</p>
          {!isTokenFlow && (
            <Button
              variant="outline"
              onClick={() => setError("")}
              className="border-[#E6EAF0] text-[#06194A] hover:bg-[#EEF0FF] hover:text-[#4F46E5] hover:border-[#4F46E5]/30"
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
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-[#E8F8EE] border border-[#BBF0D0] mx-auto shadow-[0_0_40px_-12px_rgba(22,163,74,0.35)]">
            <CheckCircle2 className="w-10 h-10 text-[#16A34A]" />
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-[#06194A]">Thank You</h1>
          <p className="text-[#53627A] leading-relaxed">
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
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#EEF0FF] border border-[#DEE2FC] text-[#4F46E5] text-[11px] font-semibold uppercase tracking-[0.18em] mb-5">
            <MessageSquareQuote className="w-3.5 h-3.5" />
            Customer Review
          </div>
          <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-[#06194A] mb-3">
            Share Your Experience
          </h1>
          <p className="text-[#53627A] text-base sm:text-lg max-w-md mx-auto leading-relaxed">
            Tell us how your experience went with {config.dealership_name || "AutoCurb"}.
          </p>
          {isTokenFlow && vehicle && (
            <div className="inline-flex items-center gap-2 bg-white border border-[#E6EAF0] rounded-full px-4 py-1.5 mt-5 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
              <span className="text-sm font-medium text-[#06194A]">{vehicle}</span>
            </div>
          )}
        </div>

        {/* Card */}
        <div className="bg-white rounded-2xl border border-[#E6EAF0] shadow-[0_1px_2px_rgba(15,23,42,0.04)] p-6 sm:p-8 space-y-6">
          {/* Rating */}
          <div className="text-center">
            <Label className="text-xs font-semibold text-[#53627A] uppercase tracking-[0.14em] mb-4 block">
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
                          ? "fill-[#4F46E5] text-[#4F46E5] drop-shadow-[0_0_6px_rgba(79,70,229,0.35)]"
                          : "text-[#E2E8F0]"
                      }`}
                    />
                  </button>
                );
              })}
            </div>
          </div>

          {/* Review Text */}
          <div className="space-y-2">
            <Label className="text-xs font-semibold text-[#53627A] uppercase tracking-[0.12em]">
              Your Review
            </Label>
            <Textarea
              value={reviewText}
              onChange={(e) => setReviewText(e.target.value)}
              rows={4}
              placeholder="Tell us about your experience selling your car..."
              className="resize-none bg-[#F8FAFC] border-[#E2E8F0] rounded-xl text-[#06194A] placeholder:text-[#94A3B8] focus-visible:ring-[#4F46E5]/30 focus-visible:border-[#4F46E5]/40 px-4 py-3"
            />
          </div>

          {/* Display Name & Location */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label className="text-xs font-semibold text-[#53627A] uppercase tracking-[0.12em]">
                Your Name
              </Label>
              <Input
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="Sarah M."
                className="bg-[#F8FAFC] border-[#E2E8F0] rounded-xl text-[#06194A] placeholder:text-[#94A3B8] focus-visible:ring-[#4F46E5]/30 focus-visible:border-[#4F46E5]/40 px-4 h-11"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-xs font-semibold text-[#53627A] uppercase tracking-[0.12em]">
                City / Town
              </Label>
              <Input
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="Hartford, CT"
                className="bg-[#F8FAFC] border-[#E2E8F0] rounded-xl text-[#06194A] placeholder:text-[#94A3B8] focus-visible:ring-[#4F46E5]/30 focus-visible:border-[#4F46E5]/40 px-4 h-11"
              />
            </div>
          </div>

          {!isTokenFlow && (
            <div className="space-y-2">
              <Label className="text-xs font-semibold text-[#53627A] uppercase tracking-[0.12em]">
                Vehicle <span className="text-[#94A3B8] normal-case tracking-normal font-normal">(optional)</span>
              </Label>
              <Input
                value={vehicle}
                onChange={(e) => setVehicle(e.target.value)}
                placeholder="2019 Toyota RAV4"
                className="bg-[#F8FAFC] border-[#E2E8F0] rounded-xl text-[#06194A] placeholder:text-[#94A3B8] focus-visible:ring-[#4F46E5]/30 focus-visible:border-[#4F46E5]/40 px-4 h-11"
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
            className="w-full h-12 rounded-xl bg-gradient-to-r from-[#4F46E5] to-[#7C3AED] hover:opacity-95 text-white font-bold text-base tracking-tight transition shadow-[0_8px_20px_-10px_rgba(79,70,229,0.5)] active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center justify-center gap-2"
          >
            {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
            Submit My Review
          </button>

          <p className="text-[11px] text-center text-[#8893A8] leading-relaxed px-2">
            By submitting, you agree to share your feedback publicly. Reviews may be featured on the
            {" "}{config.dealership_name || "AutoCurb"} website and dealer partner pages.
          </p>
        </div>

        {/* Trust line */}
        <div className="mt-6 flex items-center justify-center gap-2 text-[#8893A8] text-xs">
          <ShieldCheck className="w-3.5 h-3.5 text-[#16A34A]" />
          Moderated by our team before going live
        </div>

        {/* Supporting text */}
        <p className="mt-4 text-center text-[11px] text-[#8893A8] px-4 leading-relaxed">
          Your feedback helps us improve and may be featured on our website.
        </p>
      </div>
    </Shell>
  );
};

export default ReviewPage;
