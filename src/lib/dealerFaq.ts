// Shared dealer-FAQ data — single source of truth used by both the
// visible <FAQ /> component AND the FAQPage JSON-LD emitted by
// BrandStructuredData. Keeping them in sync via import (not by
// duplicating the strings) means Google's structured-data graph
// matches what the user sees on the page — Schema.org's bar for
// "must match the visible content."
//
// Questions are written for "is it safe to sell to a dealer" /
// "how do I sell my car" long-tail intent. A few of the answers
// are templated from site_config (price_guarantee_days, pickup
// availability, dealership_name) so each tenant's FAQ reads
// distinct to Google rather than as duplicate boilerplate.
import type { SiteConfig } from "@/hooks/useSiteConfig";

export interface DealerFaqItem {
  q: string;
  a: string;
}

export function buildDealerFaqs(config: Pick<SiteConfig, "price_guarantee_days" | "pickup_offered" | "dealership_name">): DealerFaqItem[] {
  const days = config.price_guarantee_days || 8;
  const pickup = config.pickup_offered !== false;
  const dealer = config.dealership_name || "We";

  return [
    {
      q: "How long does it take to get an offer?",
      a: "Most offers are generated within 2 minutes of submitting your vehicle information. Complex cases may take up to 24 hours.",
    },
    {
      q: "Do I need to bring my car to you?",
      a: pickup
        ? `Nope! ${dealer} offers free pickup at your home, office, or wherever is most convenient for you.`
        : `You'll drop the vehicle off at our location — most of our customers say the visit takes about 30 minutes.`,
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
      a: `Your offer is guaranteed for ${days} full days. No pressure, no bait-and-switch — sell when you're ready.`,
    },
  ];
}
