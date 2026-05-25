// Moto-aesthetic variant of Testimonials.
//
// Visual rules:
//   * Static 4-up grid (no autoplay carousel — competes with the form
//     for attention on desktop where both are simultaneously visible)
//   * No italics on quote body, no vehicle-pill bg-primary/10 chip
//   * <article> per review so structured-data review-rich-results
//     can attach if AggregateRating is also present (JSON-LD already
//     emits this from BrandStructuredData)
//   * Same supabase fetch + FALLBACK behavior as the original
//
// Loading state returns null (don't show a spinner where the form
// is still vying for primary attention).
import { useEffect, useState } from "react";
import { Star, ArrowRight } from "lucide-react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useSiteConfig } from "@/hooks/useSiteConfig";
import { useTenant } from "@/contexts/TenantContext";

interface Testimonial {
  id: string;
  author_name: string;
  location: string;
  vehicle: string;
  review_text: string;
  rating: number;
}

const FALLBACK: Testimonial[] = [
  { id: "1", review_text: "I got $3,000 more than what CarMax offered me. The process was unbelievably easy — they picked up my car from my driveway!", author_name: "Sarah M.", location: "Hartford, CT", vehicle: "2019 Toyota RAV4", rating: 5 },
  { id: "2", review_text: "Sold my old Honda in under 24 hours. The offer was fair and they handled everything. Can't recommend enough!", author_name: "Mike T.", location: "West Hartford, CT", vehicle: "2017 Honda Civic", rating: 5 },
  { id: "3", review_text: "I was skeptical at first, but they really did beat every other offer I got. Professional and fast.", author_name: "Jennifer L.", location: "Manchester, CT", vehicle: "2020 Ford Escape", rating: 5 },
  { id: "4", review_text: "No surprises, no pressure. They gave me a number, I said yes, and I had my check in 20 minutes.", author_name: "David R.", location: "Glastonbury, CT", vehicle: "2018 Chevy Malibu", rating: 5 },
];

const TestimonialsLean = () => {
  const { config } = useSiteConfig();
  const { tenant } = useTenant();
  const [testimonials, setTestimonials] = useState<Testimonial[] | null>(null);

  useEffect(() => {
    supabase
      .from("testimonials")
      .select("id, author_name, location, vehicle, review_text, rating")
      .eq("is_active", true)
      .eq("dealership_id", tenant.dealership_id)
      .order("sort_order", { ascending: true })
      .then(({ data }) => {
        if (data && data.length > 0) {
          setTestimonials(data as Testimonial[]);
        } else if (config.dealership_name === "Our Dealership" || !config.dealership_name) {
          setTestimonials(FALLBACK);
        } else {
          setTestimonials([]);
        }
      });
  }, [config.dealership_name, tenant.dealership_id]);

  if (testimonials === null || testimonials.length === 0) return null;

  // Cap at 4 for the grid — more than that is page-bloat on desktop.
  const visible = testimonials.slice(0, 4);

  return (
    <section
      id="reviews"
      aria-labelledby="reviews-heading"
      className="py-20 lg:py-24 px-5 bg-background border-t border-border/60 scroll-mt-24"
    >
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-12 lg:mb-16">
          <h2
            id="reviews-heading"
            className="text-3xl font-semibold tracking-tight text-foreground mb-3"
          >
            What customers say
          </h2>
          <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
            <div className="flex gap-0.5">
              {[...Array(5)].map((_, j) => (
                <Star key={j} className="w-4 h-4 fill-yellow-400 text-yellow-400" />
              ))}
            </div>
            <span className="font-semibold text-foreground">
              {config.stats_rating || "4.9"}
            </span>
            <span>· {config.stats_reviews_count || "2,400+"} reviews</span>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {visible.map((item) => (
            <article
              key={item.id}
              className="rounded-2xl border border-border/60 bg-card p-6"
            >
              <div className="flex gap-0.5 mb-3">
                {[...Array(5)].map((_, j) => (
                  <Star
                    key={j}
                    className={`w-4 h-4 ${
                      j < item.rating
                        ? "fill-yellow-400 text-yellow-400"
                        : "text-muted-foreground/30"
                    }`}
                  />
                ))}
              </div>
              <p className="text-base leading-relaxed text-foreground mb-5">
                {item.review_text}
              </p>
              <footer className="text-sm">
                <p className="font-semibold text-foreground">{item.author_name}</p>
                <p className="text-muted-foreground">
                  {item.location}
                  {item.vehicle ? ` · ${item.vehicle}` : ""}
                </p>
              </footer>
            </article>
          ))}
        </div>

        {/* Inline CTA so customers landing on this section from the
            top nav can jump straight back to the offer flow without
            a route change. */}
        <div className="mt-12 flex justify-center">
          <Link
            to="/#top"
            onClick={(e) => {
              e.preventDefault();
              window.scrollTo({ top: 0, behavior: "smooth" });
            }}
            className="inline-flex items-center gap-2 rounded-full bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground shadow-sm transition-transform hover:scale-[1.02] active:scale-[0.98]"
          >
            Get My Offer
            <ArrowRight className="w-4 h-4" strokeWidth={2.25} />
          </Link>
        </div>
      </div>
    </section>
  );
};

export default TestimonialsLean;
