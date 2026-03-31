import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { PostHogProvider } from "@/components/PostHogProvider";
import { HelmetProvider } from "react-helmet-async";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { DashboardHomeRedirect } from "@/components/DashboardHomeRedirect";
import { AccountTypeGate } from "@/components/AccountTypeGate";
import { ScrollToTop } from "@/components/ScrollToTop";
import { ComplianceOnboardingGate } from "@/components/ComplianceOnboardingGate";
import { CookieConsent } from "@/components/CookieConsent";
import Index from "./pages/Index";
import Dashboard from "./pages/Dashboard";
import IndividualDashboard from "./pages/IndividualDashboard";
import Pricing from "./pages/Pricing";
import About from "./pages/About";
import PartnerWithUs from "./pages/PartnerWithUs";
import Auth from "./pages/Auth";
import AuthConfirm from "./pages/AuthConfirm";
import ForgotPassword from "./pages/ForgotPassword";
import ResetPassword from "./pages/ResetPassword";
import WidgetPreview from "./pages/WidgetPreview";
import WidgetGuide from "./pages/WidgetGuide";
import TermsOfService from "./pages/TermsOfService";
import PrivacyPolicy from "./pages/PrivacyPolicy";
import DataProcessing from "./pages/DataProcessing";
import Support from "./pages/Support";
import ApiDocs from "./pages/ApiDocs";
import TryOnStudio from "./pages/TryOnStudio";
import Admin from "./pages/Admin";
import EarlyAccess from "./pages/EarlyAccess";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <HelmetProvider>
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <PostHogProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <CookieConsent />
        <BrowserRouter>
          <ScrollToTop />
          <ComplianceOnboardingGate>
          <Routes>
            <Route path="/" element={<Index />} />
            <Route path="/dashboard" element={<ProtectedRoute><DashboardHomeRedirect /></ProtectedRoute>} />
            <Route
              path="/dashboard/business"
              element={
                <ProtectedRoute>
                  <AccountTypeGate allowed={["business"]}>
                    <Dashboard />
                  </AccountTypeGate>
                </ProtectedRoute>
              }
            />
            <Route
              path="/dashboard/individual"
              element={
                <ProtectedRoute>
                  <AccountTypeGate allowed={["individual"]}>
                    <IndividualDashboard />
                  </AccountTypeGate>
                </ProtectedRoute>
              }
            />
            <Route path="/pricing" element={<ProtectedRoute><Pricing /></ProtectedRoute>} />
            <Route path="/about" element={<About />} />
            <Route path="/partner" element={<PartnerWithUs />} />
            <Route path="/early-access" element={<EarlyAccess />} />
            <Route path="/auth" element={<Auth />} />
            <Route path="/auth/confirm" element={<AuthConfirm />} />
            <Route path="/forgot-password" element={<ForgotPassword />} />
            <Route path="/reset-password" element={<ResetPassword />} />
            <Route
              path="/widget-preview"
              element={
                <ProtectedRoute>
                  <AccountTypeGate allowed={["business"]}>
                    <WidgetPreview />
                  </AccountTypeGate>
                </ProtectedRoute>
              }
            />
            <Route path="/widget-guide" element={<WidgetGuide />} />
            <Route path="/terms" element={<TermsOfService />} />
            <Route path="/privacy" element={<PrivacyPolicy />} />
            <Route path="/data-processing" element={<DataProcessing />} />
            <Route path="/support" element={<Support />} />
            <Route
              path="/api-docs"
              element={
                <ProtectedRoute>
                  <AccountTypeGate allowed={["business"]}>
                    <ApiDocs />
                  </AccountTypeGate>
                </ProtectedRoute>
              }
            />
            <Route path="/studio" element={<ProtectedRoute><TryOnStudio clothingOnly /></ProtectedRoute>} />
            <Route path="/admin" element={<Admin />} />
            <Route path="/try-on-studio" element={<ProtectedRoute><TryOnStudio clothingOnly /></ProtectedRoute>} />
            <Route path="*" element={<NotFound />} />
          </Routes>
          </ComplianceOnboardingGate>
        </BrowserRouter>
      </TooltipProvider>
      </PostHogProvider>
    </AuthProvider>
  </QueryClientProvider>
  </HelmetProvider>
);

export default App;
