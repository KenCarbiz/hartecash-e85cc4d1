// Shared types for the embeddable Trade/Sell slide-out widget.
//
// This widget is a WATERED-DOWN version of the moto landing flow that
// dealers drop onto THEIR OWN inventory site (via /public/embed.js).
// It renders inside the existing slide-out drawer the embed engine
// already provides, and "follows the customer" across the dealer's
// pages. On a VDP (vehicle detail page) it flips from a generic
// "sell your car" prompt to "apply your firm offer toward THIS car".
//
// See ./README.md for the full architecture + reuse map.

/** Chrome behavior of the iframe, mirroring EmbedLanding's contract. */
export type WidgetMode = "inline" | "overlay";

/** Whether the customer wants to trade toward a purchase or cash out. */
export type WidgetIntent = "trade" | "sell";

/**
 * Lean flow steps. Deliberately fewer than the full moto flow — the
 * heavy disclosure / process-explainer steps (TCPA consent, 8-question
 * damage matrix, multi-slot photo capture, scheduling) are dropped.
 */
export type WidgetStep = "vehicle" | "condition" | "intent" | "contact" | "offer";

export const WIDGET_STEP_ORDER: readonly WidgetStep[] = [
  "vehicle",
  "condition",
  "intent",
  "contact",
  "offer",
] as const;

/**
 * Vehicle-detail-page context, scraped by the parent embed.js from the
 * dealer's inventory page (schema.org JSON-LD → microdata → DMS DOM →
 * OG → URL heuristic) and forwarded as URL params. Non-null only when
 * the customer is actually looking at a specific car for sale.
 */
export interface VdpContext {
  /** e.g. "2024 Honda CR-V EX-L" */
  vehicleLabel: string;
  /** Sticker price scraped from the VDP; 0 when unknown. */
  vehicleMsrp: number;
}

/**
 * The customer's existing firm offer, resolved from a resume token the
 * embed engine persists in localStorage and hands back via `?t=`.
 * `amount` is `submissions.offered_price` — the firm number the
 * customer was shown (auto-firmed via `auto_firm_offer_pct` or
 * manager-bumped).
 */
export interface FirmOffer {
  token: string;
  amount: number;
  status: "in_progress" | "offer_made" | "deal_accepted";
  /** The customer's OWN vehicle (their trade), e.g. "2019 Toyota Camry". */
  vehicleLabel: string | null;
}

/** Parsed, static widget context derived from route + URL params. */
export interface TradeWidgetContext {
  dealershipId: string;
  mode: WidgetMode;
  /** Default "sell"; auto-promoted to "trade" when a VDP is detected. */
  intent: WidgetIntent;
  /** Non-null when the customer is on a vehicle detail page. */
  vdp: VdpContext | null;
  /** Existing submission token handed in by embed.js (`?t=`), if any. */
  resumeToken: string;
  /** Customer ZIP (drives state tax credit on the trade-in math). */
  zip: string;
}
