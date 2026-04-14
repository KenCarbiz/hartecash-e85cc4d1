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
const Index = lazy(() => import("./pages/Index"));

const UploadPhotos = lazy(() => import("./pages/UploadPhotos"));
const UploadDocs = lazy(() => import("./pages/UploadDocs"));
const CustomerPortal = lazy(() => import("./pages/CustomerPortal"));
const CustomerLookup = lazy(() => import("./pages/CustomerLookup"));
const ScheduleVisit = lazy(() => import("./pages/ScheduleVisit"));
const AdminLogin = lazy(() => import("./pages/AdminLogin"));
const AdminDashboard = lazy(() => import("./pages/AdminDashboard"));
const NotFound = lazy(() => import("./pages/NotFound"));
const PitchDeck = lazy(() => import("./pages/PitchDeck"));
const ServiceLanding = lazy(() => import("./pages/ServiceLanding"));
const KenPage = lazy(() => import("./pages/KenPage"));
const ServiceLinkGen = lazy(() => import("./pages/ServiceLinkGen"));
const PrivacyPolicy = lazy(() => import("./pages/PrivacyPolicy"));
const TermsOfService = lazy(() => import("./pages/TermsOfService"));
const OfferPage = lazy(() => import("./pages/OfferPage"));
const Sitemap = lazy(() => import("./pages/Sitemap"));
const ReviewPage = lazy(() => import("./pages/ReviewPage"));
const Unsubscribe = lazy(() => import("./pages/Unsubscribe"));
const TradeLanding = lazy(() => import("./pages/TradeLanding"));
const TradeIframe = lazy(() => import("./pages/TradeIframe"));
const PushPullTow = lazy(() => import("./pages/PushPullTow"));
const DealAccepted = lazy(() => import("./pages/DealAccepted"));
const OfferDisclosure = lazy(() => import("./pages/OfferDisclosure"));
const Updates = lazy(() => import("./pages/Updates"));
const AboutPage = lazy(() => import("./pages/AboutPage"));
const ExecutiveDashboard = lazy(() => import("./pages/ExecutiveDashboard"));
const InspectionSheet = lazy(() => import("./pages/InspectionSheet"));
const MobileInspection = lazy(() => import("./pages/MobileInspection"));
const AppraisalTool = lazy(() => import("./pages/AppraisalTool"));
const SuperAdminDashboard = lazy(() => import("./pages/SuperAdminDashboard"));
const OnboardingMobile = lazy(() => import("./pages/OnboardingMobile"));
const EmailUnsubscribe = lazy(() => import("./pages/EmailUnsubscribe"));
const ReferralPage = lazy(() => import("./pages/ReferralPage"));
const ResetPassword = lazy(() => import("./pages/ResetPassword"));
const OBDScan = lazy(() => import("./pages/OBDScan"));
const ServiceQuickEntry = lazy(() => import("./pages/ServiceQuickEntry"));
const InspectionCheckIn = lazy(() => import("./pages/InspectionCheckIn"));

const queryClient = new QueryClient();

const ProtectedRoute = ({ children }: { children: ReactNode }) => {
  const [session, setSession] = useState<null | "loading" | "authenticated">("loading");

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session: s } }) => {
      setSession(s ? "authenticated" : null);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s ? "authenticated" : null);
    });

    return () => subscription.unsubscribe();
  }, []);

  if (session === "loading") {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  if (!session) {
    return <Navigate to="/admin/login" replace />;
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
      <Routes>
        <Route path="/" element={<Index />} />
        <Route path="/upload/:token" element={<UploadPhotos />} />
        <Route path="/docs/:token" element={<UploadDocs />} />
        <Route path="/my-submission" element={<CustomerLookup />} />
        <Route path="/my-submission/:token" element={<CustomerPortal />} />
        <Route path="/schedule" element={<ScheduleVisit />} />
        <Route path="/admin/login" element={<AdminLogin />} />
        <Route path="/admin" element={<ProtectedRoute><AdminDashboard /></ProtectedRoute>} />
        <Route path="/service" element={<ServiceLanding />} />
        <Route path="/pitch" element={<PitchDeck />} />
        <Route path="/ken" element={<KenPage />} />
        <Route path="/servicelinkgen" element={<ServiceLinkGen />} />
        <Route path="/privacy" element={<PrivacyPolicy />} />
        <Route path="/terms" element={<TermsOfService />} />
        <Route path="/offer/:token" element={<OfferPage />} />
        <Route path="/sitemap" element={<Sitemap />} />
        <Route path="/review/:token" element={<ReviewPage />} />
        <Route path="/unsubscribe" element={<Unsubscribe />} />
        <Route path="/trade" element={<TradeLanding />} />
        <Route path="/trade-in" element={<TradeIframe />} />
        <Route path="/push-pull-tow" element={<PushPullTow />} />
        <Route path="/deal/:token" element={<DealAccepted />} />
        <Route path="/disclosure" element={<OfferDisclosure />} />
        <Route path="/updates" element={<Updates />} />
        <Route path="/about" element={<AboutPage />} />
        <Route path="/executive" element={<ProtectedRoute><ExecutiveDashboard /></ProtectedRoute>} />
        <Route path="/inspection/:id" element={<InspectionSheet />} />
        <Route path="/inspect/:id" element={<MobileInspection />} />
        <Route path="/appraisal/:token" element={<AppraisalTool />} />
        <Route path="/super-admin" element={<ProtectedRoute><SuperAdminDashboard /></ProtectedRoute>} />
        <Route path="/onboard/:dealershipId" element={<OnboardingMobile />} />
        <Route path="/email-unsubscribe" element={<EmailUnsubscribe />} />
        <Route path="/referral" element={<ReferralPage />} />
        <Route path="/reset-password" element={<ResetPassword />} />
        <Route path="/obd-scan/:token" element={<OBDScan />} />
        <Route path="/service-quick-entry" element={<ProtectedRoute><ServiceQuickEntry /></ProtectedRoute>} />
        <Route path="/inspection-checkin" element={<ProtectedRoute><InspectionCheckIn /></ProtectedRoute>} />
        {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
        <Route path="*" element={<NotFound />} />
      </Routes>
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
