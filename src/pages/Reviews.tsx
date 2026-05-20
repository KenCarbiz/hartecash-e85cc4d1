// /reviews — dedicated reviews page that recovers the SEO weight
// (Review + AggregateRating JSON-LD) we cut from the landing in
// PR 3a. Per the content agent: "minimalism on the front door,
// depth in the basement."
//
// Page structure:
//   * SEO meta + sr-only H1
//   * BrandStructuredData (re-emits AutoDealer + FAQPage so this
//     page is also a valid local-business entity for crawlers
//     that hit it directly via search results)
//   * AggregateRating + ItemList of Reviews JSON-LD (local to
//     this page — full Review payload, not just the aggregate)
//   * Header strip: aggregate rating + total count + sentence
//   * Static grid of testimonial cards from the testimonials
//     table, same source as TestimonialsLean
//   * Closing CTA pulling the visitor back to the form
//
// Per-tenant: every signal pulls from useSiteConfig +
// the testimonials table filtered by is_active. Tenant with
// zero real testimonials and a configured dealership_name
// renders empty-state copy directing them back to the form
// (rather than fallback CT testimonials, which would be a lie
// on that dealer's domain).
import { useEffect, useState } from "react";
import { Helmet } from "react-helmet-async";
import { Star, ArrowRight } from "lucide-react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useSiteConfig } from "@/hooks/useSiteConfig";
import SEO from "@/components/SEO";
import BrandStructuredData from "@/components/BrandStructuredData";
import NAPFooter from "@/components/NAPFooter";

interface Testimonial {
  id: string;
  author_name: string;
  location: string;
  vehicle: string;
  review_text: string;
  rating: number;
  created_at?: string | null;
}

const Reviews = () => {
  const { config } = useSiteConfig();
  const [testimonials, setTestimonials] = useState<Testimonial[] | null>(null);

  useEffect(() => {
    supabase
      .from("testimonials")
      .select("id, author_name, location, vehicle, review_text, rating, created_at")
      .eq("is_active", true)
      .order("sort_order", { ascending: true })
      .then(({ data }) => {
        setTestimonials((data as Testimonial[] | null) ?? []);
      });
  }, []);

  const dealerName = (config.dealership_name || "").trim();
  const displayName =
    dealerName && dealerName !== "Our Dealership" ? dealerName : "us";
  const ratingVal = parseFloat(config.stats_rating || "4.9") || 4.9;
  const reviewsCount = config.stats_reviews_count || "thousands of";
  const url = typeof window !== "undefined" ? window.location.origin : "";

  // Reviews-page JSON-LD: full Review payload + AggregateRating
  // attached to the dealer's AutoDealer entity from BrandStructuredData.
  // Emit only when we have at least one real review — otherwise the
  // structured-data validator rejects an empty reviews array.
  const reviewsJsonLd = testimonials && testimonials.length > 0
    ? {
        "@context": "https://schema.org",
        "@type": "ItemList",
        itemListElement: testimonials.slice(0, 50).map((r, i) => ({
          "@type": "ListItem",
          position: i + 1,
          item: {
            "@type": "Review",
            reviewRating: {
              "@type": "Rating",
              ratingValue: String(r.rating),
              bestRating: "5",
              worstRating: "1",
            },
            author: { "@type": "Person", name: r.author_name },
            reviewBody: r.review_text,
            itemReviewed: {
              "@type": "AutoDealer",
              "@id": `${url}#dealer`,
              name: dealerName || "Auto dealer",
            },
            datePublished: r.created_at || undefined,
          },
        })),
      }
    : null;

  return (
    <main className="bg-background min-h-screen">
      <SEO
        title={`Reviews — ${dealerName || "Our customers"} | Real seller stories`}
        description={`Real reviews from customers who sold their car to ${displayName}. ${ratingVal}★ rating across ${reviewsCount} sellers.`}
        path="/reviews"
        siteName={dealerName || "Hartecash"}
      />

      <h1 className="sr-only">
        {dealerName ? `${dealerName} customer reviews` : "Customer reviews"}
      </h1>

      <BrandStructuredData faqVariant="moto" />
      {reviewsJsonLd ? (
        <Helmet>
          <script type="application/ld+json">
            {JSON.stringify(reviewsJsonLd)}
          </script>
        </Helmet>
      ) : null}

      {/* Header strip — aggregate rating + total count */}
      <section className="py-20 lg:py-24 px-5 border-b border-border/60">
        <div className="max-w-3xl mx-auto text-center">
          <p className="text-[11px] uppercase tracking-[0.12em] font-semibold text-muted-foreground mb-3">
            Customer reviews
          </p>
          <h2 className="text-3xl lg:text-5xl font-semibold tracking-tight text-foreground mb-6">
            What our sellers say
          </h2>
          <div className="inline-flex items-center gap-3 text-base text-muted-foreground">
            <div className="flex gap-0.5">
              {[...Array(5)].map((_, j) => (
                <Star
                  key={j}
                  className="w-5 h-5 fill-yellow-400 text-yellow-400"
                />
              ))}
            </div>
            <span className="font-semibold text-foreground">{ratingVal}</span>
            <span>· {reviewsCount} reviews</span>
          </div>
        </div>
      </section>

      {/* Testimonials grid */}
      <section
        aria-labelledby="reviews-list-heading"
        className="py-20 lg:py-24 px-5"
      >
        <h2 id="reviews-list-heading" className="sr-only">
          Individual reviews
        </h2>

        {testimonials === null ? (
          <div className="max-w-6xl mx-auto text-center text-muted-foreground">
            Loading reviews…
          </div>
        ) : testimonials.length === 0 ? (
          <div className="max-w-2xl mx-auto text-center">
            <p className="text-base text-muted-foreground mb-6">
              We're collecting our first reviews. In the meantime, see what
              your car is worth with an instant valuation.
            </p>
            <Link
              to="/"
              className="inline-flex items-center gap-2 px-10 py-4 bg-primary text-primary-foreground rounded-xl text-base font-semibold hover:bg-primary/95 transition-colors"
            >
              Get started
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        ) : (
          <div className="max-w-6xl mx-auto grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {testimonials.map((item) => (
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
                  <p className="font-semibold text-foreground">
                    {item.author_name}
                  </p>
                  <p className="text-muted-foreground">
                    {item.location}
                    {item.vehicle ? ` · ${item.vehicle}` : ""}
                  </p>
                </footer>
              </article>
            ))}
          </div>
        )}
      </section>

      {/* Closing CTA — pull visitor back to the form */}
      {testimonials && testimonials.length > 0 ? (
        <section
          className="py-20 lg:py-24 px-5 border-t border-border/60"
          style={{ background: "hsl(220 14% 96%)" }}
        >
          <div className="max-w-3xl mx-auto text-center">
            <h2 className="text-2xl lg:text-3xl font-semibold tracking-tight text-foreground mb-8">
              Ready to be our next happy seller?
            </h2>
            <Link
              to="/"
              className="inline-flex items-center justify-center px-10 py-4 bg-primary text-primary-foreground rounded-xl text-base font-semibold hover:bg-primary/95 transition-colors"
            >
              Get my offer
            </Link>
          </div>
        </section>
      ) : null}

      <NAPFooter />
    </main>
  );
};

export default Reviews;
