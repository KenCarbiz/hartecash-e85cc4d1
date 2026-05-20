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
// CTABannerLean was retired — its content is now folded into the
// unified BrandFooter slab so there's no tonal seam between the
// closing CTA and the identity/legal rows below it.
const TrustBadgesLean = lazy(() => import("@/components/moto-sections/TrustBadgesLean"));
const HowItWorksLean = lazy(() => import("@/components/moto-sections/HowItWorksLean"));
const TestimonialsLean = lazy(() => import("@/components/moto-sections/TestimonialsLean"));
const ValueTrackerCard = lazy(() => import("@/components/moto-sections/ValueTrackerCard"));
const FAQLean = lazy(() => import("@/components/moto-sections/FAQLean"));
const FindOfferLean = lazy(() => import("@/components/moto-sections/FindOfferLean"));

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
export const ValueTrackerCardSection = () => <Lazy withSkeleton={false}><ValueTrackerCard /></Lazy>;
export const FAQLeanSection = () => <Lazy><FAQLean /></Lazy>;
export const FindOfferLeanSection = () => <Lazy withSkeleton={false}><FindOfferLean /></Lazy>;

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
 * Mobile counterpart to MotoBelowFold (below).
 *
 * Per product-owner direction: "very watered down version for mobile."
 * The Moto form is the priority on small screens — the marketing
 * chrome exists below it ONLY for the SEO weight (mobile-first
 * indexing means whatever's in the mobile DOM is what Google sees
 * primarily). Heavy promo cards (ValueTrackerCard with its inline
 * SVG illustration) are skipped on mobile because they double the
 * vertical scroll on small viewports without commensurate value —
 * the value-tracker opt-in already lives on the form's contact
 * step via MotoTrackValueBlock.
 *
 * Mobile scroll order:
 *   1. HowItWorksLean — three steps stack vertically; per-step CTAs
 *      anchor to #sell-car-form
 *   2. FAQLean — five questions collapse to single-column accordion
 *   3. CTABannerLean — compact closer
 *
 * All three sections are the same lean variants used on desktop, so
 * the SEO payload (process content, FAQ schema-eligible Q&As, dealer
 * mission via CTA copy) is preserved. Just no Value Tracker promo
 * card and no Trust Badges / Comparison / Testimonials grids (the
 * three-agent benchmark cut those on desktop too).
 */
export const MotoMobileBelowFold = () => (
  <>
    <HowItWorksLeanSection />
    {/* ValueTrackerCard is responsive (left/right cols stack on mobile)
        so it lands on small viewports too. The premium SVG-based
        chart degrades gracefully — no horizontal scroll, no heavy
        image bytes. */}
    <ValueTrackerCardSection />
    <FAQLeanSection />
    <FindOfferLeanSection />
  </>
);

/**
 * Moto-template marketing chrome — third iteration per the
 * three-agent benchmark vs sellyourcar.online (MotoAcquire's own
 * consumer site).
 *
 * Strip-down from the prior version (which was already lean):
 *
 *   * DROPPED: TrustBadgesLean — national-tier valuation sites
 *     don't stack stat strips below the form. AggregateRating
 *     already lives in JSON-LD via BrandStructuredData.
 *   * DROPPED: CompetitorComparison — defensive/analytical mindset
 *     too early. Objections are handled by FAQ instead.
 *   * DROPPED: TestimonialsLean — DTC/Trustpilot-era. Moves to
 *     /reviews subpage (PR 3c) with Review/AggregateRating JSON-LD.
 *   * KEPT (rebuilt): HowItWorksLean with semantic Lucide icons in
 *     soft-gray circles + per-step CTA links anchoring to the form
 *     — each step is a micro-conversion ramp instead of inert copy.
 *   * NEW: ValueTrackerCard — MotoAcquire's signature secondary
 *     conversion. "Track your vehicle value for free!" with a
 *     value-curve illustration. Routes to the form's track-value
 *     toggle (already wired via MotoTrackValueBlock).
 *   * REPLACED: FAQ → FAQLean. Two-column asymmetric layout (title
 *     left, accordion right). 5 curated questions instead of 7
 *     (drops the most generic).
 *   * KEPT (simplified): CTABannerLean. Soft-gray bg, single line,
 *     single navy pill button.
 *
 * Final scroll order:
 *   1. HowItWorksLean       three-step process with per-step CTAs
 *   2. ValueTrackerCard     value-tracking opt-in promo
 *   3. FAQLean              5-question 2-column accordion
 *   4. CTABannerLean        single-line centered finisher
 */
export const MotoBelowFold = () => (
  <>
    <HowItWorksLeanSection />
    <ValueTrackerCardSection />
    <TestimonialsLeanSection />
    <FAQLeanSection />
    {/* Closing CTA is now part of BrandFooter (mounted by Index.tsx)
        — folded in to eliminate the tonal seam between the prior
        standalone CTABannerLean section and the footer block. */}
  </>
);
