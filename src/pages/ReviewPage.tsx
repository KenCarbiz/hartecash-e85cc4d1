import { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Star, Loader2, CheckCircle2 } from "lucide-react";
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

// PostgREST raises PGRST204 ("could not find the 'X' column ... in the schema
// cache") when a column referenced in a write doesn't exist yet — e.g. before
// the moderation migration is applied. Used to fall back to a bare insert.
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
  const [reviewText, setReviewText] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [location, setLocation] = useState("");
  const [vehicle, setVehicle] = useState("");
  // Honeypot — bots fill hidden fields; humans never see this one.
  const [honeypot, setHoneypot] = useState("");

  useEffect(() => {
    if (!token) return;
    supabase
      .rpc("get_submission_by_token", { _token: token })
      .then(({ data }) => {
        if (data && data.length > 0) {
          const s = data[0];
          setVehicle([s.vehicle_year, s.vehicle_make, s.vehicle_model].filter(Boolean).join(" "));
          // Pre-fill display name with first name + last initial
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

    // Honeypot tripped — silently pretend success without writing.
    if (honeypot.trim()) {
      setSubmitted(true);
      return;
    }

    // Soft client-side rate guard against accidental / rapid resubmits.
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
      is_active: false, // hidden until a tenant admin approves
      dealership_id: tenant.dealership_id,
      sort_order: 99,
    };

    // Try with the moderation columns. If the DB hasn't had the moderation
    // migration applied yet (status/source missing), PostgREST returns a
    // schema-cache error — fall back to a bare insert so the customer's
    // review is never lost. is_active=false still keeps it off the site.
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

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error && !submitted) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background px-5">
        <div className="max-w-md text-center space-y-4">
          <p className="text-lg text-muted-foreground">{error}</p>
          {!isTokenFlow && (
            <Button variant="outline" onClick={() => setError("")}>Try again</Button>
          )}
        </div>
      </div>
    );
  }

  if (submitted) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background px-5">
        <div className="max-w-md text-center space-y-4">
          <CheckCircle2 className="w-16 h-16 text-success mx-auto" />
          <h1 className="text-2xl font-bold text-foreground">Thank You! 🎉</h1>
          <p className="text-muted-foreground">
            Your review has been submitted and will appear on our site once approved.
            We truly appreciate your feedback!
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-primary to-[hsl(210,100%,36%)] flex items-center justify-center px-5 py-12">
      <div className="w-full max-w-lg">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-extrabold text-primary-foreground mb-2">
            Share Your Experience
          </h1>
          <p className="text-primary-foreground/80">
            with {config.dealership_name || "us"}
          </p>
          {isTokenFlow && vehicle && (
            <div className="inline-flex items-center gap-2 bg-white/15 border border-white/25 rounded-full px-4 py-1.5 mt-4">
              <span className="text-sm font-medium text-primary-foreground">🚗 {vehicle}</span>
            </div>
          )}
        </div>

        <div className="bg-card rounded-xl shadow-2xl p-6 space-y-5">
          {/* Rating */}
          <div className="text-center">
            <Label className="text-sm font-semibold text-card-foreground mb-3 block">How was your experience?</Label>
            <div className="flex justify-center gap-2">
              {[1, 2, 3, 4, 5].map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => setRating(n)}
                  className="p-1 transition-transform hover:scale-110 active:scale-95"
                  aria-label={`${n} star${n > 1 ? "s" : ""}`}
                >
                  <Star
                    className={`w-10 h-10 transition-colors ${
                      n <= rating ? "fill-yellow-400 text-yellow-400" : "text-muted-foreground/20"
                    }`}
                  />
                </button>
              ))}
            </div>
          </div>

          {/* Review Text */}
          <div className="space-y-1.5">
            <Label className="text-sm font-semibold">Your Review</Label>
            <Textarea
              value={reviewText}
              onChange={(e) => setReviewText(e.target.value)}
              rows={4}
              placeholder="Tell us about your experience selling your car..."
              className="resize-none"
            />
          </div>

          {/* Display Name & Location */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-sm font-semibold">Your Name</Label>
              <Input
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="Sarah M."
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-sm font-semibold">City / Town</Label>
              <Input
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="Hartford, CT"
              />
            </div>
          </div>

          {/* Vehicle — only asked on the public page (token flow pre-fills it) */}
          {!isTokenFlow && (
            <div className="space-y-1.5">
              <Label className="text-sm font-semibold">Vehicle (optional)</Label>
              <Input
                value={vehicle}
                onChange={(e) => setVehicle(e.target.value)}
                placeholder="2019 Toyota RAV4"
              />
            </div>
          )}

          {/* Honeypot — visually hidden, off the tab order, ignored by humans */}
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

          <Button
            className="w-full"
            size="lg"
            onClick={handleSubmit}
            disabled={submitting || !reviewText.trim()}
          >
            {submitting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
            Submit My Review
          </Button>

          <p className="text-xs text-center text-muted-foreground">
            Your review may be displayed on our website. By submitting, you agree to share your feedback publicly.
          </p>
        </div>
      </div>
    </div>
  );
};

export default ReviewPage;
