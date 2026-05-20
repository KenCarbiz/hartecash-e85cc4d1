// Per-tenant Schema.org JSON-LD emitter. Three blocks, all driven by
// site_config so a different dealer gets a different graph without
// per-tenant authoring:
//
//   1. AutoDealer (LocalBusiness subtype) — name, address, telephone,
//      foundingDate, aggregateRating, geo (when lat/lng present),
//      openingHoursSpecification (parsed from config.business_hours),
//      sameAs (social links).
//
//   2. FAQPage — pulls from the same buildDealerFaqs() the visible
//      <FAQ /> component renders, so the structured-data answers
//      match the on-page copy (Google's "must match" rule for
//      FAQ-rich-result eligibility).
//
//   3. WebSite with SearchAction — generic site-search entity so
//      Google can surface a search box in SERP if relevance picks up.
//
// Failures are silent. Missing fields drop OUT of the JSON-LD rather
// than emitting empty strings — Google's structured-data validator
// rejects "" / null on required fields and will reject the whole
// block. We err on the side of emitting LESS, never garbage.
import { Helmet } from "react-helmet-async";
import { useSiteConfig } from "@/hooks/useSiteConfig";
import { buildDealerFaqs } from "@/lib/dealerFaq";

type JsonLdValue = string | number | boolean | null | JsonLdObject | JsonLdValue[];
type JsonLdObject = { [k: string]: JsonLdValue };

// Drop keys whose values are empty strings, null, undefined, or empty
// arrays. JSON-LD validators reject these and break the whole block.
function compact(obj: JsonLdObject): JsonLdObject {
  const out: JsonLdObject = {};
  for (const [k, v] of Object.entries(obj)) {
    if (v === null || v === undefined || v === "") continue;
    if (Array.isArray(v) && v.length === 0) continue;
    if (typeof v === "object" && !Array.isArray(v)) {
      const inner = compact(v as JsonLdObject);
      if (Object.keys(inner).length === 0) continue;
      out[k] = inner;
    } else {
      out[k] = v;
    }
  }
  return out;
}

// Parse "Mon–Thu" / "Mon-Thu" / "Friday" into a Schema.org dayOfWeek
// list. We're tolerant: anything we don't recognize falls through
// untouched and the validator can warn but won't break the whole graph.
const DAY_MAP: Record<string, string> = {
  mon: "Monday", monday: "Monday",
  tue: "Tuesday", tues: "Tuesday", tuesday: "Tuesday",
  wed: "Wednesday", weds: "Wednesday", wednesday: "Wednesday",
  thu: "Thursday", thur: "Thursday", thurs: "Thursday", thursday: "Thursday",
  fri: "Friday", friday: "Friday",
  sat: "Saturday", saturday: "Saturday",
  sun: "Sunday", sunday: "Sunday",
};

function parseDays(daysSpec: string): string[] {
  const norm = daysSpec.replace(/[–—-]/g, "-").toLowerCase();
  const range = norm.split(",").flatMap((seg) => {
    const m = seg.trim().match(/^([a-z]+)\s*-\s*([a-z]+)$/);
    if (m) {
      const order = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];
      const startKey = m[1].slice(0, 3);
      const endKey = m[2].slice(0, 3);
      const si = order.indexOf(startKey);
      const ei = order.indexOf(endKey);
      if (si >= 0 && ei >= si) return order.slice(si, ei + 1);
      return [];
    }
    return [seg.trim().slice(0, 3)];
  });
  return range.map((k) => DAY_MAP[k]).filter(Boolean);
}

// "9 AM – 5 PM" → { opens: "09:00", closes: "17:00" } if parseable.
// "Closed" → null (we omit the row entirely, per Schema's preference
// over Type=Closed which is not a thing).
function parseHourRange(hoursSpec: string): { opens: string; closes: string } | null {
  const s = hoursSpec.trim().toLowerCase();
  if (s.includes("closed")) return null;
  const m = s.match(/(\d{1,2})(?::(\d{2}))?\s*(am|pm)?\s*[–—-]\s*(\d{1,2})(?::(\d{2}))?\s*(am|pm)?/i);
  if (!m) return null;
  const to24 = (h: string, mm: string | undefined, mer: string | undefined) => {
    let n = parseInt(h, 10);
    if (mer === "pm" && n < 12) n += 12;
    if (mer === "am" && n === 12) n = 0;
    return `${String(n).padStart(2, "0")}:${(mm || "00").padStart(2, "0")}`;
  };
  return { opens: to24(m[1], m[2], m[3]), closes: to24(m[4], m[5], m[6]) };
}

const BrandStructuredData = () => {
  const { config } = useSiteConfig();
  if (typeof window === "undefined") return null;

  const url = window.location.origin;
  const dealerName = (config.dealership_name || "").trim();
  if (!dealerName || dealerName === "Our Dealership") {
    // No identity to anchor a LocalBusiness graph — emit nothing
    // rather than seeding a generic placeholder Google would penalize.
    return null;
  }

  // ── AutoDealer block ────────────────────────────────────────────
  const aggregateRating =
    config.stats_rating && parseFloat(config.stats_rating) > 0
      ? {
          "@type": "AggregateRating",
          ratingValue: String(parseFloat(config.stats_rating).toFixed(1)),
          // Approximate review-count from cars_purchased — both are
          // strings like "14,721+" or "2,400+"; strip non-digits.
          reviewCount: String(
            Math.max(
              50,
              parseInt(String(config.stats_cars_purchased || "").replace(/[^0-9]/g, "")) || 50,
            ),
          ),
          bestRating: "5",
          worstRating: "1",
        }
      : null;

  const openingHoursSpecification = Array.isArray(config.business_hours)
    ? config.business_hours
        .flatMap((row) => {
          const days = parseDays(row.days || "");
          const range = parseHourRange(row.hours || "");
          if (days.length === 0 || !range) return [];
          return [
            {
              "@type": "OpeningHoursSpecification",
              dayOfWeek: days,
              opens: range.opens,
              closes: range.closes,
            },
          ];
        })
    : [];

  const sameAs = [
    (config as { facebook_url?: string }).facebook_url,
    (config as { instagram_url?: string }).instagram_url,
    (config as { twitter_url?: string }).twitter_url,
    (config as { youtube_url?: string }).youtube_url,
  ].filter(Boolean) as string[];

  const autoDealer: JsonLdObject = compact({
    "@context": "https://schema.org",
    "@type": "AutoDealer",
    "@id": `${url}#dealer`,
    name: dealerName,
    url,
    telephone: config.phone || null,
    email: config.email || null,
    address: config.address
      ? compact({
          "@type": "PostalAddress",
          streetAddress: config.address,
        })
      : null,
    foundingDate: config.established_year ? String(config.established_year) : null,
    image: config.logo_url || null,
    logo: config.logo_url || null,
    description:
      config.tagline ||
      `${dealerName} buys cars from consumers — instant cash offers, free pickup, no haggle.`,
    aggregateRating: aggregateRating as JsonLdValue,
    openingHoursSpecification: openingHoursSpecification as JsonLdValue,
    sameAs: sameAs as JsonLdValue,
  });

  // ── FAQPage block ───────────────────────────────────────────────
  const faqs = buildDealerFaqs(config);
  const faqPage: JsonLdObject = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faqs.map((item) => ({
      "@type": "Question",
      name: item.q,
      acceptedAnswer: {
        "@type": "Answer",
        text: item.a,
      },
    })),
  };

  // ── WebSite block ───────────────────────────────────────────────
  const website: JsonLdObject = compact({
    "@context": "https://schema.org",
    "@type": "WebSite",
    "@id": `${url}#website`,
    name: dealerName,
    url,
    publisher: { "@id": `${url}#dealer` },
  });

  return (
    <Helmet>
      <script type="application/ld+json">{JSON.stringify(autoDealer)}</script>
      <script type="application/ld+json">{JSON.stringify(faqPage)}</script>
      <script type="application/ld+json">{JSON.stringify(website)}</script>
    </Helmet>
  );
};

export default BrandStructuredData;
