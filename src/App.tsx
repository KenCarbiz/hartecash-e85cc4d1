import { lazy, Suspense } from "react";
import { HelmetProvider } from "react-helmet-async";
import { Toaster } from "@/components/ui/toaster";
import ThemeProvider from "@/components/ThemeProvider";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, useLocation } from "react-router-dom";
import { AnimatePresence } from "framer-motion";
import PageTransition from "@/components/PageTransition";
import Index from "./pages/Index";

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
const DealAccepted = lazy(() => import("./pages/DealAccepted"));
const OfferDisclosure = lazy(() => import("./pages/OfferDisclosure"));
const Updates = lazy(() => import("./pages/Updates"));
const AboutPage = lazy(() => import("./pages/AboutPage"));
const ExecutiveDashboard = lazy(() => import("./pages/ExecutiveDashboard"));
const InspectionSheet = lazy(() => import("./pages/InspectionSheet"));

const queryClient = new QueryClient();

const AnimatedRoutes = () => {
  const location = useLocation();
  return (
    <AnimatePresence mode="wait">
      <PageTransition key={location.pathname}>
        <Suspense fallback={null}>
          <Routes location={location}>
            <Route path="/" element={<Index />} />
            <Route path="/upload/:token" element={<UploadPhotos />} />
            <Route path="/docs/:token" element={<UploadDocs />} />
            <Route path="/my-submission" element={<CustomerLookup />} />
            <Route path="/my-submission/:token" element={<CustomerPortal />} />
            <Route path="/schedule" element={<ScheduleVisit />} />
            <Route path="/admin/login" element={<AdminLogin />} />
            <Route path="/admin" element={<AdminDashboard />} />
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
            <Route path="/deal/:token" element={<DealAccepted />} />
            <Route path="/disclosure" element={<OfferDisclosure />} />
            <Route path="/updates" element={<Updates />} />
            <Route path="/about" element={<AboutPage />} />
            <Route path="/executive" element={<ExecutiveDashboard />} />
            <Route path="/inspection/:id" element={<InspectionSheet />} />
            {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </Suspense>
      </PageTransition>
    </AnimatePresence>
  );
};

const App = () => (
  <HelmetProvider>
  <QueryClientProvider client={queryClient}>
    <ThemeProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <AnimatedRoutes />
        </BrowserRouter>
      </TooltipProvider>
    </ThemeProvider>
  </QueryClientProvider>
  </HelmetProvider>
);

export default App;
