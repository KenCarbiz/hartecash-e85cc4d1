import { Helmet } from "react-helmet-async";
import { useSiteConfig } from "@/hooks/useSiteConfig";

interface JsonLdProps {
  data: Record<string, unknown>;
}

const JsonLd = ({ data }: JsonLdProps) => (
  <Helmet>
    <script type="application/ld+json">{JSON.stringify(data)}</script>
  </Helmet>
);

// ── Organization + AutoDealer ──
export const LocalBusinessJsonLd = () => {
  const { config } = useSiteConfig();
  const name = config.dealership_name || "Our Dealership";

  return (
    <JsonLd
      data={{
        "@context": "https://schema.org",
        "@type": ["AutoDealer", "Organization"],
        name,
        url: config.website_url || "https://autocurb.io",
        foundingDate: "1952",
        description: `${name} purchases vehicles directly from consumers. Sellers receive a firm cash offer within 2 minutes, backed by a ${config.price_guarantee_days || 8}-day price guarantee. Free vehicle pickup included.`,
        slogan: config.tagline || "Sell Your Car The Easy Way",
        telephone: config.phone || "",
        areaServed: {
          "@type": "Place",
          name: "Service Area",
        },
        address: config.address
          ? {
              "@type": "PostalAddress",
              streetAddress: config.address,
              addressCountry: "US",
            }
          : undefined,
        aggregateRating: config.stats_rating
          ? {
              "@type": "AggregateRating",
              ratingValue: config.stats_rating,
              reviewCount: (config.stats_reviews_count || "100").replace(/\D/g, ""),
              bestRating: "5",
            }
          : undefined,
        knowsAbout: [
          "car buying",
          "vehicle appraisal",
          "trade-in valuation",
          "used car purchasing",
          "instant cash offers for cars",
        ],
        hasOfferCatalog: {
          "@type": "OfferCatalog",
          name: "Vehicle Purchase Services",
          itemListElement: [
            {
              "@type": "Offer",
              itemOffered: {
                "@type": "Service",
                name: "Instant Cash Offer",
                description:
                  "Receive a competitive, no-obligation cash offer for your vehicle in under 2 minutes. Based on real-time market data.",
              },
            },
            {
              "@type": "Offer",
              itemOffered: {
                "@type": "Service",
                name: "Free Vehicle Pickup",
                description:
                  "Complimentary vehicle pickup from your home, office, or any convenient location after accepting your offer.",
              },
            },
            {
              "@type": "Offer",
              itemOffered: {
                "@type": "Service",
                name: "Loan Payoff Handling",
                description:
                  "We handle payoffs directly with your lender and pay you the difference — even for leased vehicles.",
              },
            },
          ],
        },
      }}
    />
  );
};

// ── HowTo (for AI step-by-step extraction) ──
export const HowToJsonLd = () => {
  const { config } = useSiteConfig();
  const name = config.dealership_name || "Our Dealership";

  return (
    <JsonLd
      data={{
        "@context": "https://schema.org",
        "@type": "HowTo",
        name: `How to Sell Your Car to ${name}`,
        description: `A simple 3-step process to sell your car for cash to ${name}.`,
        totalTime: "PT2M",
        step: [
          {
            "@type": "HowToStep",
            position: 1,
            name: "Tell Us About Your Car",
            text: "Enter your license plate or VIN and basic details about your vehicle. Takes less than 2 minutes.",
          },
          {
            "@type": "HowToStep",
            position: 2,
            name: "Get Your Cash Offer",
            text: `Receive a competitive, no-obligation offer based on real market data. Guaranteed for ${config.price_guarantee_days || 8} days.`,
          },
          {
            "@type": "HowToStep",
            position: 3,
            name: "Get Paid & We Pick Up",
            text: "Accept your offer, get paid on the spot, and we pick up your car for free at your convenience.",
          },
        ],
      }}
    />
  );
};

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