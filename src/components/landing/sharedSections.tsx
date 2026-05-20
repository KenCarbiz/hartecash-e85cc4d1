import { lazy, Suspense, Component, ReactNode, useState } from "react";
import { ChevronDown, BookOpen } from "lucide-react";

const HowItWorks = lazy(() => import("@/components/HowItWorks"));
const TrustBadges = lazy(() => import("@/components/TrustBadges"));
const CompetitorComparison = lazy(() => import("@/components/CompetitorComparison"));
const ValueProps = lazy(() => import("@/components/ValueProps"));
const Testimonials = lazy(() => import("@/components/Testimonials"));
const FAQ = lazy(() => import("@/components/FAQ"));
const CTABanner = lazy(() => import("@/components/CTABanner"));
const ReferralBanner = lazy(() => import("@/components/ReferralBanner"));

// Moto-aesthetic lean variants — see src/components/moto-sections/.
const TrustBadgesLean = lazy(() => import("@/components/moto-sections/TrustBadgesLean"));
const HowItWorksLean = lazy(() => import("@/components/moto-sections/HowItWorksLean"));
const TestimonialsLean = lazy(() => import("@/components/moto-sections/TestimonialsLean"));
const CTABannerLean = lazy(() => import("@/components/moto-sections/CTABannerLean"));

class SectionErrorBoundary extends Component<{ children: ReactNode }, { hasError: boolean }> {
  constructor(props: { children: ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }
  static getDerivedStateFromError() {
    return { hasError: true };
  }
  componentDidCatch(error: Error) {
    // Surface to whatever error sink is wired up so we know about it.
    // Silent failures masquerade as broken sections in prod.
    console.error("[SectionErrorBoundary]", error);
  }
  render() {
    if (this.state.hasError) {
      return (
        <div className="w-full py-10 px-5 text-center text-sm text-muted-foreground">
          This section is temporarily unavailable. Refresh to try again.
        </div>
      );
    }
    return this.props.children;
  }
}

const SectionSkeleton = () => (
  <div className="w-full py-12 flex justify-center">
    <div className="w-10 h-10 rounded-full border-4 border-primary/20 border-t-primary animate-spin" />
  </div>
);

const Lazy = ({ children, withSkeleton = true }: { children: ReactNode; withSkeleton?: boolean }) => (
  <SectionErrorBoundary>
    <Suspense fallback={withSkeleton ? <SectionSkeleton /> : null}>{children}</Suspense>
  </SectionErrorBoundary>
);

export const HowItWorksSection = () => <Lazy><HowItWorks /></Lazy>;
export const TrustBadgesSection = () => <Lazy><TrustBadges /></Lazy>;
export const CompetitorComparisonSection = () => <Lazy withSkeleton={false}><CompetitorComparison /></Lazy>;
export const ValuePropsSection = () => <Lazy><ValueProps /></Lazy>;
export const TestimonialsSection = () => <Lazy><Testimonials /></Lazy>;
export const FAQSection = () => <Lazy><FAQ /></Lazy>;
export const CTABannerSection = () => <Lazy withSkeleton={false}><CTABanner /></Lazy>;
export const ReferralBannerSection = () => <Lazy withSkeleton={false}><ReferralBanner /></Lazy>;

// Moto-aesthetic section wrappers — same site_config wiring as the
// standard sections above, but visually flattened to match the Moto
// form's clean Apple-minimal language. Only consumed by MotoTemplate
// via MotoBelowFold; other templates keep the standard set.
export const TrustBadgesLeanSection = () => <Lazy><TrustBadgesLean /></Lazy>;
export const HowItWorksLeanSection = () => <Lazy><HowItWorksLean /></Lazy>;
export const TestimonialsLeanSection = () => <Lazy><TestimonialsLean /></Lazy>;
export const CTABannerLeanSection = () => <Lazy withSkeleton={false}><CTABannerLean /></Lazy>;

/**
 * "Learn more" accordion. Wraps sections that historically padded the
 * page below the fold but rarely move conversion (ValueProps,
 * Testimonials, FAQ). Defaults closed so first-time visitors aren't
 * confronted with eight scrolls of marketing copy before they get
 * to act.
 */
const LearnMoreFold = ({ children }: { children: ReactNode }) => {
  const [open, setOpen] = useState(false);
  return (
    <section className="max-w-3xl mx-auto px-5 py-8">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between gap-2 px-5 py-4 rounded-2xl bg-muted/40 border border-border/60 hover:bg-muted/60 transition-colors"
        aria-expanded={open}
      >
        <span className="flex items-center gap-2 text-sm font-bold text-card-foreground">
          <BookOpen className="w-4 h-4 text-primary" />
          {open ? "Hide details" : "Learn more about how we buy cars"}
        </span>
        <ChevronDown className={`w-4 h-4 text-muted-foreground transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <div className="space-y-12 mt-8">
          {children}
        </div>
      )}
    </section>
  );
};

/**
 * Conversion-tuned below-fold layout. Was 8 stacked sections; now the
 * three high-leverage signals stay visible (trust, head-to-head
 * comparison, three-step explainer) and the educational/proof content
 * (value props, testimonials, FAQ) collapses into a single "Learn more"
 * accordion so the page measures shorter and the customer's first
 * scroll lands them on the form, not on marketing copy.
 *
 * Order rationale:
 *   1. TrustBadges     — quick brand reassurance, tight row
 *   2. CompetitorComp. — direct wedge vs Carvana/CarMax (our edge)
 *   3. HowItWorks      — three-step explainer
 *   4. Learn-more      — collapsed: ValueProps, Testimonials, FAQ
 *   5. ReferralBanner  — light promo
 *   6. CTABanner       — finisher: "still here? get your offer."
 */
export const DefaultBelowFold = () => (
  <>
    <TrustBadgesSection />
    <CompetitorComparisonSection />
    <HowItWorksSection />
    <LearnMoreFold>
      <ValuePropsSection />
      <TestimonialsSection />
      <FAQSection />
    </LearnMoreFold>
    <ReferralBannerSection />
    <CTABannerSection />
  </>
);

/**
 * Full marketing chrome — every below-fold section the customer
 * expects on a Hartecash-style landing, all inline (no Learn-more
 * accordion). Per the May-2026 dealer directive every template must
 * render the same below-fold set, so customers landing on Velocity,
 * Marquee, Heritage, Clarity, Legacy, or any of the OEM-style
 * templates all see:
 *
 *   - TrustBadges
 *   - HowItWorks            (the 1-2-3 ease-of-purchase strip)
 *   - CompetitorComparison  (Hartecash vs CarMax / Carvana / KBB)
 *   - ValueProps
 *   - Testimonials          (reviews with stars)
 *   - FAQ                   (collapsed by default — only section
 *                            the dealer wanted gated behind a click)
 *   - ReferralBanner
 *   - CTABanner
 *
 * Each template wraps this in its own background tone so the chrome
 * inherits the template's color vibe rather than forcing Hartecash
 * brand colors onto every dealer.
 */
export const FullBelowFold = () => (
  <>
    <TrustBadgesSection />
    <HowItWorksSection />
    <CompetitorComparisonSection />
    <ValuePropsSection />
    <TestimonialsSection />
    <FAQSection />
    <ReferralBannerSection />
    <CTABannerSection />
  </>
);

/**
 * Moto-template marketing chrome.
 *
 * Per the three-agent design review (PR #260 follow-up):
 *
 *   * KEEP (refactored): TrustBadgesLean, HowItWorksLean,
 *     TestimonialsLean, CTABannerLean. Same data, flat visuals.
 *   * KEEP as-is: CompetitorComparisonSection (already on-brand;
 *     just drops its outer shadow), FAQSection (collapsed by default
 *     and gold for FAQPage schema).
 *   * TOSS from Moto chrome: ValueProps (duplicates the Comparison
 *     table content), ReferralBanner (wrong audience — hasn't sold
 *     yet, nothing to refer).
 *
 * Order chosen for the desktop visual flow:
 *   1. TrustBadges     numeric reassurance immediately after the form
 *   2. Comparison      "Why {Dealer} Wins" — primary conversion wedge
 *   3. HowItWorks      three-step process explainer
 *   4. Testimonials    static grid of social proof
 *   5. FAQ             long-tail SEO + objection handling
 *   6. CTABanner       finisher with scroll-back-to-form
 *
 * Each lean section has its own `border-t border-border/60` so the
 * page reads as one continuous surface with hairline dividers
 * instead of alternating bg tones.
 */
export const MotoBelowFold = () => (
  <>
    <TrustBadgesLeanSection />
    <CompetitorComparisonSection />
    <HowItWorksLeanSection />
    <TestimonialsLeanSection />
    <FAQSection />
    <CTABannerLeanSection />
  </>
);
