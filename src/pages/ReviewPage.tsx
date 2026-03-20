import { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Star, Loader2, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useSiteConfig } from "@/hooks/useSiteConfig";

const ReviewPage = () => {
  const { token } = useParams<{ token: string }>();
  const { config } = useSiteConfig();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState("");
  const [vehicle, setVehicle] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [customerLocation, setCustomerLocation] = useState("");

  const [rating, setRating] = useState(5);
  const [reviewText, setReviewText] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [location, setLocation] = useState("");

  useEffect(() => {
    if (!token) return;
    supabase
      .rpc("get_submission_by_token", { _token: token })
      .then(({ data }) => {
        if (data && data.length > 0) {
          const s = data[0];
          setVehicle([s.vehicle_year, s.vehicle_make, s.vehicle_model].filter(Boolean).join(" "));
          setCustomerName(s.name || "");
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
    setSubmitting(true);

    const { error: insertError } = await supabase.from("testimonials").insert({
      author_name: displayName.trim() || "Anonymous",
      location: location.trim(),
      vehicle: vehicle,
      review_text: reviewText.trim(),
      rating,
      is_active: false, // Admin must approve before it goes live
      sort_order: 99,
    });

    if (insertError) {
      setError("Something went wrong. Please try again.");
    } else {
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
        <div className="max-w-md text-center">
          <p className="text-lg text-muted-foreground">{error}</p>
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
          {vehicle && (
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
