import { lazy, Suspense } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
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

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Suspense fallback={null}>
          <Routes>
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
            {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </Suspense>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
