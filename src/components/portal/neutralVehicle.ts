// Neutral, brand-agnostic vehicle placeholder (data-URI SVG). Shown only
// until the real photo of the customer's actual vehicle resolves —
// never a specific model, so a customer is never shown the wrong car.
//
// Refined, minimal line-art (matches the lucide "car" glyph used by the
// loading skeleton) rather than the old clunky cartoon silhouette. Soft
// indigo stroke on a transparent ground reads as an intentional, premium
// placeholder. Prefer <VehicleHeroImage> for hero spots — it shows a
// shimmer skeleton while loading; this constant is for plain <img src>
// fallbacks (e.g. gallery thumbnails).
export const NEUTRAL_VEHICLE =
  "data:image/svg+xml;utf8," +
  encodeURIComponent(
    "<svg xmlns='http://www.w3.org/2000/svg' viewBox='-2 -2 28 28' fill='none' stroke='%23A5B4FC' stroke-width='1.6' stroke-linecap='round' stroke-linejoin='round'>" +
      "<path d='M19 17h2c.6 0 1-.4 1-1v-3c0-.9-.7-1.7-1.5-1.9C18.7 10.6 16 10 16 10s-1.3-1.4-2.2-2.3c-.5-.4-1.1-.7-1.8-.7H5c-.6 0-1.1.4-1.4.9l-1.4 2.9A3.7 3.7 0 0 0 2 12v4c0 .6.4 1 1 1h2'/>" +
      "<circle cx='7' cy='17' r='2'/>" +
      "<path d='M9 17h6'/>" +
      "<circle cx='17' cy='17' r='2'/>" +
    "</svg>",
  );
