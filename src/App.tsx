import { lazy, Suspense, useEffect, useState, type ReactNode } from "react";
import { HelmetProvider } from "react-helmet-async";
import { TenantProvider } from "@/contexts/TenantContext";
import { Toaster } from "@/components/ui/toaster";
import ThemeProvider from "@/components/ThemeProvider";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate, useLocation } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { pageView } from "@/lib/analytics";
import AppErrorBoundary from "@/components/AppErrorBoundary";
import PageErrorBoundary from "@/components/PageErrorBoundary";
const Index = lazy(() => import("./pages/Index"));
const AutocurbLanding = lazy(() => import("./pages/AutocurbLanding"));
const SellFlow = lazy(() => import("./pages/SellFlow"));

// Hostname check for the AutoCurb SaaS marketing landing. All other
// hosts (hartecash.com, sell2harte.com, *.lovable.app previews, and
// every tenant custom domain) keep falling through to <Index />.
const isAutocurbHost = () => {
  if (typeof window === "undefined") return false;
  const h = window.location.hostname.toLowerCase();
  return h === "autocurb.io" || h === "www.autocurb.io";
};
const RootLanding = () => (isAutocurbHost() ? <AutocurbLanding /> : <Index />);

const UploadPhotos = lazy(() => import("./pages/UploadPhotos"));
const UploadDocs = lazy(() => import("./pages/UploadDocs"));
const BoostOfferClarity = lazy(() => import("./pages/BoostOfferClarity"));
const CustomerPortal = lazy(() => import("./pages/CustomerPortal"));
const CustomerLookup = lazy(() => import("./pages/CustomerLookup"));
const ScheduleVisit = lazy(() => import("./pages/ScheduleVisit"));
const WatchMyCar = lazy(() => import("./pages/WatchMyCar"));
const AdminLogin = lazy(() => import("./pages/AdminLogin"));
const AdminDashboard = lazy(() => import("./pages/AdminDashboard"));
const RescheduleAppointment = lazy(() => import("./pages/RescheduleAppointment"));
const CallFeedback = lazy(() => import("./pages/CallFeedback"));
const MfaSetup = lazy(() => import("./pages/MfaSetup"));
const MfaChallenge = lazy(() => import("./pages/MfaChallenge"));
const NotFound = lazy(() => import("./pages/NotFound"));
const PitchDeck = lazy(() => import("./pages/PitchDeck"));
const PlatformPitch = lazy(() => import("./pages/PlatformPitch"));
const ServiceLanding = lazy(() => import("./pages/ServiceLanding"));
const KenPage = lazy(() => import("./pages/KenPage"));
const ServiceLinkGen = lazy(() => import("./pages/ServiceLinkGen"));
const PrivacyPolicy = lazy(() => import("./pages/PrivacyPolicy"));
const TermsOfService = lazy(() => import("./pages/TermsOfService"));
const OfferPage = lazy(() => import("./pages/OfferPage"));
const QuickOfferPage = lazy(() => import("./pages/QuickOfferPage"));
const Sitemap = lazy(() => import("./pages/Sitemap"));
const ReviewPage = lazy(() => import("./pages/ReviewPage"));
const Unsubscribe = lazy(() => import("./pages/Unsubscribe"));
const TradeLanding = lazy(() => import("./pages/TradeLanding"));
const TradeIframe = lazy(() => import("./pages/TradeIframe"));
const EmbedLanding = lazy(() => import("./pages/EmbedLanding"));
const PushPullTow = lazy(() => import("./pages/PushPullTow"));
const DealAccepted = lazy(() => import("./pages/DealAccepted"));
const OfferDisclosure = lazy(() => import("./pages/OfferDisclosure"));
const Updates = lazy(() => import("./pages/Updates"));
const PreviewLoader = lazy(() => import("./pages/PreviewLoader"));
const AboutPage = lazy(() => import("./pages/AboutPage"));
const ExecutiveDashboard = lazy(() => import("./pages/ExecutiveDashboard"));
const InspectionSheet = lazy(() => import("./pages/InspectionSheet"));
const MobileInspection = lazy(() => import("./pages/MobileInspection"));
const AppraisalTool = lazy(() => import("./pages/AppraisalTool"));
const SuperAdminDashboard = lazy(() => import("./pages/SuperAdminDashboard"));
const OnboardingMobile = lazy(() => import("./pages/OnboardingMobile"));
const PublicDemo = lazy(() => import("./pages/PublicDemo"));
const CustomerArrival = lazy(() => import("./pages/CustomerArrival"));
const EmailUnsubscribe = lazy(() => import("./pages/EmailUnsubscribe"));
const ReferralPage = lazy(() => import("./pages/ReferralPage"));
const ResetPassword = lazy(() => import("./pages/ResetPassword"));
const OBDScan = lazy(() => import("./pages/OBDScan"));
const ServiceQuickEntry = lazy(() => import("./pages/ServiceQuickEntry"));
const InspectionCheckIn = lazy(() => import("./pages/InspectionCheckIn"));
const PlanPage = lazy(() => import("./pages/PlanPage"));
const StatusPage = lazy(() => import("./pages/StatusPage"));
const SlaPage = lazy(() => import("./pages/SlaPage"));
const DocsLanding = lazy(() => import("./pages/DocsLanding"));
const GroupLandingPage = lazy(() => import("./pages/GroupLandingPage"));
const Reviews = lazy(() => import("./pages/Reviews"));
// /billing removed — /plan is now the canonical billing surface, with
// a "Manage billing" button that opens the Stripe Customer Portal
// directly. The previous BillingPage was orphaned (not in the sidebar)
// and read from a parallel app_entitlements schema that doesn't exist
// in this repo.

const queryClient = new QueryClient();

type MfaGate = "loading" | "ok" | "challenge" | "enroll" | null;

const ProtectedRoute = ({ children }: { children: ReactNode }) => {
  const [session, setSession] = useState<null | "loading" | "authenticated">("loading");
  const [mfa, setMfa] = useState<MfaGate>("loading");
  const location = useLocation();

  // The MFA flow itself runs inside a ProtectedRoute (must be signed
  // in to enroll/challenge). Skip the gate when we're already on the
  // MFA pages so we don't get into a redirect loop.
  const onMfaPage = location.pathname.startsWith("/admin/mfa-");

  useEffect(() => {
    let cancel = false;

    const evaluate = async () => {
      const { data: { session: s } } = await supabase.auth.getSession();
      if (cancel) return;
      if (!s) {
        setSession(null);
        setMfa(null);
        return;
      }
      setSession("authenticated");

      if (onMfaPage) {
        setMfa("ok");
        return;
      }

      // 1) AAL upgrade required? Means user has a verified factor but
      //    the current session is single-factor. Send to challenge.
      const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
      if (cancel) return;
      if (aal && aal.currentLevel === "aal1" && aal.nextLevel === "aal2") {
        setMfa("challenge");
        return;
      }

      // 2) Tenant enforcement — does this user need to enroll?
      //    require_mfa_for_user RPC handles tenant policy + grace
      //    period + role filter. Soft-fail to "ok" if the migration
      //    isn't applied yet (RPC missing / errors) so we don't lock
      //    everyone out before MFA is rolled out.
      try {
        const { data: req } = await supabase.rpc("require_mfa_for_user");
        if (cancel) return;
        const result = req as { ok?: boolean; required?: boolean } | null;
        if (result?.ok && result.required) {
          setMfa("enroll");
          return;
        }
      } catch { /* RPC missing — soft-fail */ }

      setMfa("ok");
    };

    void evaluate();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, s) => {
      if (!s) {
        setSession(null);
        setMfa(null);
        return;
      }
      setSession("authenticated");
      void evaluate();
    });

    return () => {
      cancel = true;
      subscription.unsubscribe();
    };
  }, [onMfaPage, location.pathname]);

  if (session === "loading" || mfa === "loading") {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  if (!session) {
    return <Navigate to="/admin/login" replace />;
  }

  if (mfa === "challenge") {
    return <Navigate to="/admin/mfa-challenge" replace state={{ from: location.pathname }} />;
  }
  if (mfa === "enroll") {
    return <Navigate to="/admin/mfa-setup" replace />;
  }

  return <>{children}</>;
};

const RouteTracker = () => {
  const location = useLocation();
  useEffect(() => {
    pageView(location.pathname);
  }, [location.pathname]);
  return null;
};

const AnimatedRoutes = () => {
  return (
    <Suspense fallback={null}>
      {/* Skip link for keyboard users — becomes visible on focus, lets
          users jump past any persistent nav straight into page content. */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-[100] focus:px-3 focus:py-2 focus:bg-primary focus:text-primary-foreground focus:rounded-md focus:shadow-lg"
      >
        Skip to main content
      </a>
      <main id="main-content" tabIndex={-1}>
      <Routes>
        <Route path="/" element={<RootLanding />} />
        {/* Subdirectory rooftop URL — preferred for SEO, pools authority to
            the main domain. Renders the same Index; TenantContext resolves
            the rooftop from the slug path segment. */}
        <Route path="/locations/:rooftopSlug" element={<Index />} />
        {/* MotoAcquire-style standalone sell flow. Standalone dealer
            microsite by default; iframed onto the dealer's own site
            with ?embed=true so the top + disclosure bars drop out. */}
        <Route path="/sell" element={<SellFlow />} />
        <Route path="/reviews" element={<Reviews />} />
        <Route path="/upload/:token" element={<UploadPhotos />} />
        <Route path="/docs/:token" element={<UploadDocs />} />
        <Route path="/boost-offer/:token" element={<BoostOfferClarity />} />
        <Route path="/my-submission" element={<CustomerLookup />} />
        <Route path="/my-submission/:token" element={<CustomerPortal />} />
        <Route path="/reschedule/:token" element={<RescheduleAppointment />} />
        <Route path="/call-feedback/:token" element={<CallFeedback />} />
        <Route path="/schedule" element={<ScheduleVisit />} />
        {/* Customer-facing vehicle value tracker (Watch My Car's Worth). */}
        <Route path="/watch-my-car/:token" element={<WatchMyCar />} />
        <Route path="/admin/login" element={<AdminLogin />} />
        <Route path="/admin/mfa-setup" element={<ProtectedRoute><MfaSetup /></ProtectedRoute>} />
        <Route path="/admin/mfa-challenge" element={<ProtectedRoute><MfaChallenge /></ProtectedRoute>} />
        <Route path="/admin" element={<ProtectedRoute><AdminDashboard /></ProtectedRoute>} />
        <Route path="/service" element={<ServiceLanding />} />
        <Route path="/pitch" element={<PitchDeck />} />
        <Route path="/platform" element={<PlatformPitch />} />
        <Route path="/ken" element={<KenPage />} />
        <Route path="/servicelinkgen" element={<ServiceLinkGen />} />
        <Route path="/privacy" element={<PrivacyPolicy />} />
        <Route path="/terms" element={<TermsOfService />} />
        <Route path="/offer/:token" element={<OfferPage />} />
        <Route path="/arrive/:token" element={<CustomerArrival />} />
        <Route path="/quick-offer" element={<QuickOfferPage />} />
        <Route path="/sitemap" element={<Sitemap />} />
        <Route path="/review/:token" element={<ReviewPage />} />
        <Route path="/unsubscribe" element={<Unsubscribe />} />
        <Route path="/trade" element={<TradeLanding />} />
        <Route path="/trade-in" element={<TradeIframe />} />
        <Route path="/embed/:dealershipId" element={<EmbedLanding />} />
        <Route path="/push-pull-tow" element={<PushPullTow />} />
        <Route path="/deal/:token" element={<DealAccepted />} />
        <Route path="/disclosure" element={<OfferDisclosure />} />
        <Route path="/updates" element={<Updates />} />
        <Route path="/preview/loader" element={<PreviewLoader />} />
        <Route path="/about" element={<AboutPage />} />
        <Route path="/executive" element={<ProtectedRoute><ExecutiveDashboard /></ProtectedRoute>} />
        <Route path="/inspection/:id" element={<InspectionSheet />} />
        <Route path="/inspect/:id" element={<MobileInspection />} />
        <Route
          path="/appraisal/:token"
          element={
            <PageErrorBoundary
              title="Couldn't open this appraisal"
              subtitlePrefix="The appraisal page crashed while loading."
              backTo="/admin"
            >
              <AppraisalTool />
            </PageErrorBoundary>
          }
        />
        <Route path="/super-admin" element={<ProtectedRoute><SuperAdminDashboard /></ProtectedRoute>} />
        <Route path="/onboard/:dealershipId" element={<OnboardingMobile />} />
        <Route path="/demo/:token" element={<PublicDemo />} />
        <Route path="/email-unsubscribe" element={<EmailUnsubscribe />} />
        <Route path="/referral" element={<ReferralPage />} />
        <Route path="/reset-password" element={<ResetPassword />} />
        <Route path="/obd-scan/:token" element={<OBDScan />} />
        <Route path="/service-quick-entry" element={<ProtectedRoute><ServiceQuickEntry /></ProtectedRoute>} />
        <Route path="/inspection-checkin" element={<ProtectedRoute><InspectionCheckIn /></ProtectedRoute>} />
        {/* /checkin is a convenience alias for /inspection-checkin — the
            page accepts both a full 17-char VIN and a last-6 shortcut. */}
        <Route path="/checkin" element={<ProtectedRoute><InspectionCheckIn /></ProtectedRoute>} />
        <Route path="/plan" element={<ProtectedRoute><PlanPage /></ProtectedRoute>} />
        {/* /status — public health page. The CDK ransomware wedge:
            customers can self-verify uptime any time. No auth. */}
        <Route path="/status" element={<StatusPage />} />
        {/* /sla — public service-level commitment, linked from /status footer. */}
        <Route path="/sla" element={<SlaPage />} />
        {/* /docs — public landing page for SLA / status / runbooks. */}
        <Route path="/docs" element={<DocsLanding />} />
        {/* /group — chooser page when a customer hits a dealer_groups
            custom_domain with multiple rooftops. Single-rooftop groups
            skip this via TenantContext direct resolution. */}
        <Route path="/group" element={<GroupLandingPage />} />
        {/* /billing removed — see comment near the import. */}
        {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
        <Route path="*" element={<NotFound />} />
      </Routes>
      </main>
    </Suspense>
  );
};

const App = () => (
  <AppErrorBoundary>
    <HelmetProvider>
    <QueryClientProvider client={queryClient}>
      <TenantProvider>
        <ThemeProvider>
          <TooltipProvider>
            <Toaster />
            <Sonner />
            <BrowserRouter>
              <RouteTracker />
              <AnimatedRoutes />
            </BrowserRouter>
          </TooltipProvider>
        </ThemeProvider>
      </TenantProvider>
    </QueryClientProvider>
    </HelmetProvider>
  </AppErrorBoundary>
);

export default App;
