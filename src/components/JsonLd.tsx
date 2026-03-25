import { Helmet } from "react-helmet-async";

interface JsonLdProps {
  data: Record<string, unknown>;
}

const JsonLd = ({ data }: JsonLdProps) => (
  <Helmet>
    <script type="application/ld+json">{JSON.stringify(data)}</script>
  </Helmet>
);

// ── LocalBusiness ──
export const LocalBusinessJsonLd = () => (
  <JsonLd
    data={{
      "@context": "https://schema.org",
      "@type": "AutoDealer",
      name: "Harte Auto Group",
      url: "https://hartecash.lovable.app",
      logo: "https://hartecash.lovable.app/og-service.jpg",
      description:
        "Get a top-dollar cash offer for your car in 2 minutes. Free pickup, no obligation. Trusted since 1952.",
      address: {
        "@type": "PostalAddress",
        addressRegion: "CT",
        addressCountry: "US",
      },
      aggregateRating: {
        "@type": "AggregateRating",
        ratingValue: "4.9",
        reviewCount: "2400",
        bestRating: "5",
      },
      sameAs: [],
    }}
  />
);

// ── FAQPage ──
const FAQ_ITEMS = [
  {
    q: "How long does it take to get an offer?",
    a: "Most offers are generated within 2 minutes of submitting your vehicle information. Complex cases may take up to 24 hours.",
  },
  {
    q: "Do I need to bring my car to you?",
    a: "Nope! We offer free pickup at your home, office, or wherever is most convenient for you.",
  },
  {
    q: "What if I still owe money on my car?",
    a: "No problem. We handle payoffs directly with your lender and pay you the difference.",
  },
  {
    q: "Is there any obligation after I get an offer?",
    a: "Absolutely not. Our offers are no-obligation — you're free to accept, decline, or shop around.",
  },
  {
    q: "What paperwork do I need?",
    a: "Just your vehicle title, a valid ID, and your registration. We handle all the rest.",
  },
  {
    q: "Can I trade in my leased vehicle?",
    a: "Yes! We purchase leased vehicles too. We'll work with your leasing company to handle the buyout and pay you any equity.",
  },
  {
    q: "How long is my offer valid?",
    a: "Your offer is guaranteed for 8 full days. No pressure, no bait-and-switch — sell when you're ready.",
  },
];

export const FAQPageJsonLd = () => (
  <JsonLd
    data={{
      "@context": "https://schema.org",
      "@type": "FAQPage",
      mainEntity: FAQ_ITEMS.map((item) => ({
        "@type": "Question",
        name: item.q,
        acceptedAnswer: {
          "@type": "Answer",
          text: item.a,
        },
      })),
    }}
  />
);

export default JsonLd;
