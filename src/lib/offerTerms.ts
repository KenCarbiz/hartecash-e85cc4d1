// offerTerms — single source of truth for how an offer is described to the
// customer, in the dealer's voice, depending on whether the dealership has
// opted in to making a *firm* (binding-subject-to-inspection) offer or is
// presenting a non-binding *estimate*.
//
// Why this exists
// ---------------
// A "firm offer" is a stronger legal statement than just showing a number:
// the dealership commits to honoring the stated amount provided an in-person
// inspection confirms the vehicle matches what the customer described. That
// commitment must be worded carefully so the dealer is protected when a
// vehicle turns out to be materially different than described (undisclosed
// accident, branded title, hidden mechanical/cosmetic damage), while still
// being honored when the customer was truthful. Estimate mode makes no such
// commitment.
//
// Both modes are tenant-driven: pass the dealership's display name and the
// offer-validity window so the copy reads as the dealership's own statement.
// AutoCurb is only the facilitator and is never named as the offering party.

export type OfferMode = "firm" | "estimate";

export interface OfferTermsParams {
  /** Dealership display name (already validated upstream). */
  dealerName: string;
  /** Days the offer/estimate remains valid. */
  guaranteeDays: number;
}

export interface OfferTermsCopy {
  /** Short badge/label, e.g. "Firm offer" / "Estimated value". */
  badge: string;
  /** One-line headline shown above the number. */
  headline: string;
  /** Reassurance sentence shown under the number. */
  subtext: string;
  /** Full legal/disclosure paragraph (used on the offer + disclosure pages). */
  disclosure: string;
  /** Bulletized inspection assumptions — only meaningful in firm mode. */
  assumptions: string[];
}

/**
 * Resolve the customer-facing copy for an offer.
 *
 * Firm mode encodes the dealer's exact protection: the offer is honored
 * only if inspection finds nothing different than the customer described,
 * and it is premised on no accident history, no branded title, and no other
 * undisclosed issues. Anything the customer *did* disclose is already priced
 * in and will not reduce the offer. Undisclosed material issues release the
 * dealer from the commitment.
 */
export function getOfferTerms(mode: OfferMode, p: OfferTermsParams): OfferTermsCopy {
  const dealer = p.dealerName;
  const days = p.guaranteeDays;

  if (mode === "firm") {
    return {
      badge: "Firm offer",
      headline: `${dealer}'s firm offer`,
      subtext: `Good for ${days} days. ${dealer} will honor this exact amount, as long as an in-person inspection confirms your vehicle matches what you described.`,
      disclosure:
        `This is a firm offer from ${dealer}, not an estimate. Because you've described your vehicle's ` +
        `condition to the best of your knowledge, ${dealer} commits to honoring the stated amount for ` +
        `${days} calendar days — provided a brief in-person inspection confirms the vehicle is as described. ` +
        `This offer assumes the vehicle has a clean, non-branded title, no prior accident or frame damage, ` +
        `and no undisclosed mechanical or cosmetic issues. Any condition you have already disclosed is fine ` +
        `and is already reflected in this number. If the inspection reveals something materially different ` +
        `from what you described — for example an undisclosed accident, a branded or salvage title, ` +
        `odometer discrepancy, or significant damage — ${dealer} is not bound by this amount and may adjust ` +
        `or withdraw the offer. No sale is final until both you and ${dealer} sign a purchase agreement.`,
      assumptions: [
        "Clean, non-branded title (no salvage, rebuilt, lemon, or flood)",
        "No prior accident or frame/structural damage",
        "Mileage and equipment as entered",
        "No undisclosed mechanical or cosmetic problems",
      ],
    };
  }

  return {
    badge: "Estimated value",
    headline: `Your estimated value from ${dealer}`,
    subtext: `This is a preliminary estimate, not a binding offer. ${dealer} confirms your final offer after a quick in-person look.`,
    disclosure:
      `This is a preliminary estimate from ${dealer}, not a binding offer to purchase your vehicle and not ` +
      `a guarantee of price. It is based on the information you provided and on current market data, and is ` +
      `valid for ${days} calendar days. The estimate is subject to change after ${dealer} inspects the ` +
      `vehicle in person to verify its actual condition, mileage, equipment, title, and history, and may be ` +
      `revised up or down or withdrawn. No purchase obligation exists on either party unless and until a ` +
      `written purchase agreement is signed by both ${dealer} and you.`,
    assumptions: [],
  };
}

/**
 * Derive the offer mode from a dealership's offer_settings row. A dealer is
 * in firm mode only when they have explicitly opted in (firm_offer_enabled)
 * AND a firm percentage is configured to produce a single number. Otherwise
 * the customer sees an estimate, which is the safe default.
 */
export function resolveOfferMode(settings: {
  firm_offer_enabled?: boolean | null;
  auto_firm_offer_pct?: number | null;
} | null | undefined): OfferMode {
  if (settings?.firm_offer_enabled && settings?.auto_firm_offer_pct != null) return "firm";
  return "estimate";
}
