import { Component, ReactNode } from "react";
import SellCarForm from "@/components/SellCarForm";
import QuickOfferForm from "@/components/QuickOfferForm";
import SellFlowSimple from "@/components/SellFlowSimple";
import type { FormData } from "@/components/sell-form/types";
import { useSiteConfig } from "@/hooks/useSiteConfig";
import { useTenant } from "@/contexts/TenantContext";

interface LandingFormProps {
  leadSource?: string;
  /** Visual variant passed through to SellCarForm. Ignored by the
   *  one-screen QuickOfferForm which has its own card layout. */
  variant?: "default" | "split";
  /** Optional pre-populated values from the landing-page hand-off
   *  (FullscreenWizard pattern). Ignored by QuickOfferForm. */
  initial?: Partial<FormData>;
  /** Wizard interior theme — passed through to SellFlowSimple so the
   *  3-screen flow inherits the template's prestige tier. */
  theme?: "light" | "dark" | "warm";
  /** Per-template compute-reveal loader. Velocity uses "running-car"
   *  per the May-2026 audit; other templates use quieter loaders. */
  loader?: "running-car" | "brass-arc" | "thin-line" | "hand-drawn";
  /** Ghost-screen variant for the BB lookup transition state. */
  ghost?: "pulse-orb" | "sweep-arc" | "stack-reveal" | "card-skeleton" | "legacy-car";
  /** Optional override for the ghost-screen copy. */
  ghostHeadline?: string;
  ghostSubhead?: string;
  /** Brand accent (hex) used by the wizard's loader + emphasis. */
  accent?: string;
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

const LandingForm = ({ leadSource, variant = "split", initial, theme, loader, ghost, ghostHeadline, ghostSubhead, accent }: LandingFormProps) => {
  const { config } = useSiteConfig();
  const { tenant } = useTenant();

  // Read the variant from the DB first; fall back to a per-tenant
  // localStorage flag the admin sets when the landing_form_variant
  // column isn't deployed yet. This keeps the admin's preview working
  // before the Supabase migration lands. Customers on other browsers
  // see the DB default ("detailed") until the migration is applied.
  let resolved: string | undefined = config.landing_form_variant;
  if (resolved == null || resolved === "" || resolved === "detailed") {
    try {
      const local = localStorage.getItem(
        `landing_form_variant_pending:${tenant.dealership_id}`,
      );
      if (local === "quick" || local === "detailed") resolved = local;
    } catch { /* private mode: ignore */ }
  }

  // Density-driven dispatch (May-2026 audit). When the LandingPlateInput
  // hands off either plate+state OR a 17-character VIN via `initial`,
  // we route into SellFlowSimple (the 3-screen wizard) for "simple"
  // and "standard" densities. The "detailed" density and any
  // non-handoff entry (admin preview, embed, legacy direct mount) keep
  // using the existing SellCarForm.
  const rawDensity = ((config as any).landing_form_density ?? "simple") as string;
  // "dealer_configured" routes through the full form so the dealer's
  // form_config toggles (steps + questions) drive the journey directly.
  const density = (rawDensity === "dealer_configured" ? "detailed" : rawDensity) as "simple" | "standard" | "detailed";
  const hasPlateHandoff = !!(initial?.plate && initial?.state);
  const hasVinHandoff = !!(initial?.vin && initial.vin.length === 17);
  // Resolve the ghost-screen choice. Template-prop wins, otherwise
  // fall back to whatever the dealer picked in site_config (which
  // defaults to "pulse-orb" — the calmest premium variant).
  const resolvedGhost =
    ghost ||
    ((config as any).ghost_screen as
      | "pulse-orb"
      | "sweep-arc"
      | "stack-reveal"
      | "card-skeleton"
      | "legacy-car"
      | undefined) ||
    "legacy-car";
  const resolvedGhostHeadline = ghostHeadline || ((config as any).ghost_headline ?? undefined);
  const resolvedGhostSubhead = ghostSubhead || ((config as any).ghost_subhead ?? undefined);

  if ((hasPlateHandoff || hasVinHandoff) && density !== "detailed") {
    return (
      <SellFlowSimple
        initial={
          hasVinHandoff
            ? { vin: initial!.vin as string }
            : { plate: initial!.plate as string, state: initial!.state as string }
        }
        density={density}
        leadSource={leadSource}
        theme={theme}
        loader={loader}
        ghost={resolvedGhost}
        ghostHeadline={resolvedGhostHeadline}
        ghostSubhead={resolvedGhostSubhead}
        accent={accent}
      />
    );
  }

  const useQuick = resolved === "quick";
  const detailed = <SellCarForm leadSource={leadSource} variant={variant} initial={initial} />;
  return useQuick
    ? (
      <QuickOfferBoundary fallback={detailed}>
        <QuickOfferForm leadSource={leadSource} />
      </QuickOfferBoundary>
    )
    : detailed;
};

export default LandingForm;
