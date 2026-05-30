// Neutral, brand-agnostic vehicle silhouette (data-URI SVG). Shown only
// until the real photo of the customer's actual vehicle resolves —
// replaces the old hardcoded RAV4 placeholder so a customer is never
// shown the wrong model.
export const NEUTRAL_VEHICLE =
  "data:image/svg+xml;utf8," +
  encodeURIComponent(
    "<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 120 70'>" +
      "<path d='M10 50 L10 40 Q10 36 14 36 L26 36 L36 20 Q38 16 44 16 L84 16 Q90 16 92 20 L102 36 L106 36 Q110 36 110 40 L110 50 Z' fill='rgba(79,70,229,0.10)' stroke='rgba(79,70,229,0.45)' stroke-width='2' stroke-linejoin='round'/>" +
      "<path d='M40 20 L62 20 L62 34 L34 34 Z' fill='white' stroke='rgba(79,70,229,0.4)' stroke-width='1'/>" +
      "<path d='M64 20 L84 20 L94 34 L64 34 Z' fill='white' stroke='rgba(79,70,229,0.4)' stroke-width='1'/>" +
      "<circle cx='34' cy='52' r='7' fill='white' stroke='rgba(79,70,229,0.5)' stroke-width='2'/>" +
      "<circle cx='90' cy='52' r='7' fill='white' stroke='rgba(79,70,229,0.5)' stroke-width='2'/>" +
    "</svg>",
  );
