// Moto-aesthetic FAQ — second iteration per the 3-agent benchmark.
//
// Layout:
//   Two-column asymmetric on lg+. Left column: H2 + 1-sentence intro
//   + support link. Right column: accordion list with HAIRLINE
//   dividers only — NO card chrome, NO rounded backgrounds.
//   Mobile collapses to single column.
//
// Content:
//   Curated 5-question set from buildDealerFaqs(config, {variant:"moto"})
//   — drops the two most generic Q's to keep the FAQ weighted toward
//   long-tail SEO intent (payoff, title, leased vehicles, price lock).
//   BrandStructuredData on the Moto template must use the SAME variant
//   so JSON-LD matches visible (Google's "must match" rule for FAQ
//   rich-result eligibility).
//
// Per-tenant: questions/answers pull from useSiteConfig via
// buildDealerFaqs() — same source as the original FAQ component.
import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { useSiteConfig } from "@/hooks/useSiteConfig";
import { buildDealerFaqs } from "@/lib/dealerFaq";

const FAQLean = () => {
  const { config } = useSiteConfig();
  const faqs = buildDealerFaqs(config, { variant: "moto" });
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  return (
    <section
      id="faq"
      aria-labelledby="faq-heading"
      className="py-20 lg:py-24 px-5 bg-background border-t border-border/60"
    >
      <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-[1fr_2fr] gap-10 lg:gap-16">
        <div>
          <h2
            id="faq-heading"
            className="text-3xl font-semibold tracking-tight text-foreground mb-4"
          >
            Frequently Asked Questions
          </h2>
          <p className="text-base text-muted-foreground leading-relaxed max-w-sm">
            We've compiled answers to the questions sellers ask most. Don't see
            yours?{" "}
            {config.email ? (
              <a
                href={`mailto:${config.email}`}
                className="text-primary underline-offset-4 hover:underline font-medium"
              >
                Contact us
              </a>
            ) : (
              <a
                href="#sell-car-form"
                className="text-primary underline-offset-4 hover:underline font-medium"
              >
                Start your offer
              </a>
            )}
            .
          </p>
        </div>

        <ul className="divide-y divide-border/60">
          {faqs.map((faq, i) => {
            const isOpen = openIndex === i;
            return (
              <li key={i}>
                <button
                  type="button"
                  onClick={() => setOpenIndex(isOpen ? null : i)}
                  aria-expanded={isOpen}
                  className="w-full py-5 text-left flex items-center justify-between gap-4 group"
                >
                  <span className="text-base font-semibold text-foreground">
                    {faq.q}
                  </span>
                  <ChevronDown
                    className={`w-4 h-4 shrink-0 text-muted-foreground transition-transform ${
                      isOpen ? "rotate-180" : ""
                    }`}
                    strokeWidth={2}
                  />
                </button>
                <div
                  className={`overflow-hidden transition-all duration-200 ${
                    isOpen ? "max-h-[400px] pb-5" : "max-h-0"
                  }`}
                >
                  <p className="text-[15px] text-muted-foreground leading-relaxed max-w-2xl">
                    {faq.a}
                  </p>
                </div>
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
};

export default FAQLean;
