import { Component, ReactNode } from "react";
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
 * landing template (HeroOffset / Carousel / Magazine / Slab / Classic
 * etc.) mounts this wrapper instead of importing SellCarForm directly
 * so the tenant's choice propagates everywhere.
 *
 * Wrapped in a local error boundary that falls back to SellCarForm
 * if QuickOfferForm crashes for any reason — the customer-facing
 * landing must never produce a white screen, even when the new flow
 * has a runtime issue.
 */

interface BoundaryState { hasError: boolean }

class QuickOfferBoundary extends Component<{ fallback: ReactNode; children: ReactNode }, BoundaryState> {
  state: BoundaryState = { hasError: false };
  static getDerivedStateFromError(): BoundaryState { return { hasError: true }; }
  componentDidCatch(error: Error, info: { componentStack: string }) {
    console.error("[LandingForm] QuickOfferForm crashed, falling back to SellCarForm:", error, info.componentStack);
  }
  render() {
    return this.state.hasError ? this.props.fallback : this.props.children;
  }
}

const LandingForm = ({ leadSource, variant = "split" }: LandingFormProps) => {
  const { config } = useSiteConfig();
  const useQuick = config.landing_form_variant === "quick";
  const detailed = <SellCarForm leadSource={leadSource} variant={variant} />;
  return useQuick
    ? (
      <QuickOfferBoundary fallback={detailed}>
        <QuickOfferForm leadSource={leadSource} />
      </QuickOfferBoundary>
    )
    : detailed;
};

export default LandingForm;
