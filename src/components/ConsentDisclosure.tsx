import { Link } from "react-router-dom";
import { useSiteConfig } from "@/hooks/useSiteConfig";

/**
 * Consent disclosure block shown at every customer contact-info
 * collection point: the SellFlowSimple "See my offer" step, the
 * OfferPageClarity contact gate, and the DealAcceptedClarity
 * contact gate. Same text everywhere so the consent record on
 * submissions.tcpa_consent_text reflects what the customer
 * actually saw, regardless of which page captured the contact.
 *
 * Two blocks:
 *   1. TCPA — autodialed calls / SMS / email consent. Required
 *      under FCC TCPA + state-level analogs. Includes the
 *      not-a-condition-of-purchase line and STOP/opt-out path,
 *      plus links to the dealer's /privacy and /terms pages.
 *   2. Lienholder payoff verification — when the customer is
 *      selling a leased or financed vehicle, they grant the
 *      dealer permission to verify payoff with the lender so
 *      the correct amount is paid to the correct party.
 *
 * Both blocks render quietly under the primary CTA in zinc-500
 * 11px so they're legible without competing visually.
 *
 * Pass a `ctaLabel` prop ("See my offer" / "Confirm and continue"
 * / etc.) to interpolate the right verb into the TCPA "by
 * tapping" lead.
 */
interface Props {
  /** The label of the primary CTA right above this disclosure.
   *  Used in the TCPA lead so the consent ties to a specific
   *  action ("By tapping 'See my offer' you agree…"). */
  ctaLabel: string;
  /** Optional override for the dealer name. Defaults to
   *  config.dealership_name; falls back to "the dealership". */
  dealerName?: string;
  className?: string;
}

const ConsentDisclosure = ({ ctaLabel, dealerName, className }: Props) => {
  const { config } = useSiteConfig();
  const name = dealerName || config.dealership_name || "the dealership";

  return (
    <div
      className={`text-[11px] text-zinc-500 leading-relaxed space-y-3 ${className || ""}`}
    >
      <p>
        By tapping "{ctaLabel}", you consent to receive autodialed calls, texts
        (SMS/MMS), and emails from <span className="font-semibold text-zinc-700">{name}</span>{" "}
        at the phone number and email provided regarding your vehicle submission, offer,
        and appointment. Consent is not a condition of purchase. Msg &amp; data rates may
        apply. Msg frequency varies. Reply STOP to opt out. See our{" "}
        <Link
          to="/privacy"
          target="_blank"
          rel="noopener noreferrer"
          className="font-semibold text-zinc-700 underline hover:text-zinc-900 transition-colors"
        >
          Privacy Policy
        </Link>{" "}
        and{" "}
        <Link
          to="/terms"
          target="_blank"
          rel="noopener noreferrer"
          className="font-semibold text-zinc-700 underline hover:text-zinc-900 transition-colors"
        >
          Terms of Service
        </Link>
        .
      </p>
      <p>
        If you are selling a leased vehicle or a vehicle with a lienholder, you authorize{" "}
        <span className="font-semibold text-zinc-700">{name}</span> to contact your lender
        or lessor to verify the payoff amount once you accept an offer. This authorization
        ensures we pay off the correct lienholder for the correct amount as part of
        completing your sale.
      </p>
    </div>
  );
};

export default ConsentDisclosure;
