import { lazy, Suspense, Component, ReactNode } from "react";

const HowItWorks = lazy(() => import("@/components/HowItWorks"));
const TrustBadges = lazy(() => import("@/components/TrustBadges"));
const CompetitorComparison = lazy(() => import("@/components/CompetitorComparison"));
const ValueProps = lazy(() => import("@/components/ValueProps"));
const Testimonials = lazy(() => import("@/components/Testimonials"));
const FAQ = lazy(() => import("@/components/FAQ"));
const CTABanner = lazy(() => import("@/components/CTABanner"));
const ReferralBanner = lazy(() => import("@/components/ReferralBanner"));

class SectionErrorBoundary extends Component<{ children: ReactNode }, { hasError: boolean }> {
  constructor(props: { children: ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }
  static getDerivedStateFromError() {
    return { hasError: true };
  }
  render() {
    if (this.state.hasError) return null;
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

export const DefaultBelowFold = () => (
  <>
    <HowItWorksSection />
    <TrustBadgesSection />
    <CompetitorComparisonSection />
    <ValuePropsSection />
    <TestimonialsSection />
    <FAQSection />
    <ReferralBannerSection />
    <CTABannerSection />
  </>
);
