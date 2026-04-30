import SellCarForm from "@/components/SellCarForm";
import QuickOfferForm from "@/components/QuickOfferForm";
import { useSiteConfig } from "@/hooks/useSiteConfig";

interface LandingFormProps {
  leadSource?: string;
  /** Visual variant passed through to SellCarForm. Ignored by the
   *  one-screen QuickOfferForm which has its own card layout. */
  variant?: "default" | "split";
}

/**
 * Renders the dealer's chosen public sell-flow:
 *   - 'detailed' (default) → the full multi-step SellCarForm
 *   - 'quick'              → the one-screen QuickOfferForm
 *
 * Picked per-tenant in Setup · Process → Landing & Flow. Every
 * landing template (HeroOffset / Carousel / Magazine / Slab and
 * future templates) should mount this wrapper instead of importing
 * SellCarForm directly so the tenant's choice propagates everywhere.
 */
const LandingForm = ({ leadSource, variant = "split" }: LandingFormProps) => {
  const { config } = useSiteConfig();
  const useQuick = config.landing_form_variant === "quick";
  return useQuick
    ? <QuickOfferForm leadSource={leadSource} />
    : <SellCarForm leadSource={leadSource} variant={variant} />;
};

export default LandingForm;
