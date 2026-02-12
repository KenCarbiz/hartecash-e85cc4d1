import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Index from "./pages/Index";
import UploadPhotos from "./pages/UploadPhotos";
import UploadDocs from "./pages/UploadDocs";
import CustomerPortal from "./pages/CustomerPortal";
import CustomerLookup from "./pages/CustomerLookup";
import ScheduleVisit from "./pages/ScheduleVisit";
import AdminLogin from "./pages/AdminLogin";
import AdminDashboard from "./pages/AdminDashboard";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Index />} />
          <Route path="/upload/:token" element={<UploadPhotos />} />
          <Route path="/docs/:token" element={<UploadDocs />} />
          <Route path="/my-submission" element={<CustomerLookup />} />
          <Route path="/my-submission/:token" element={<CustomerPortal />} />
          <Route path="/schedule" element={<ScheduleVisit />} />
          <Route path="/admin/login" element={<AdminLogin />} />
          <Route path="/admin" element={<AdminDashboard />} />
          {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
