import { lazy, Suspense } from "react";
import { ConvexAuthProvider } from "@convex-dev/auth/react";
import { convexReactClient } from "@/convexReactClient";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { PostHogProvider } from "@/components/PostHogProvider";
import { HelmetProvider } from "react-helmet-async";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { DashboardHomeRedirect } from "@/components/DashboardHomeRedirect";
import { AccountTypeGate } from "@/components/AccountTypeGate";
import { ScrollToTop } from "@/components/ScrollToTop";
import { ComplianceOnboardingGate } from "@/components/ComplianceOnboardingGate";
import { CookieConsent } from "@/components/CookieConsent";
import { SignupChooserProvider } from "@/components/signup/SignupChooserContext";

// Eagerly loaded: landing, auth, and tiny utility pages (critical for FCP / first-visit UX)
import Index from "./pages/Index";
import Auth from "./pages/Auth";
import AuthInvite from "./pages/AuthInvite";
import AuthConfirm from "./pages/AuthConfirm";
import BookDemo from "./pages/BookDemo";
import ForgotPassword from "./pages/ForgotPassword";
import ResetPassword from "./pages/ResetPassword";
import VerifyEmail from "./pages/VerifyEmail";
import ApproveDevice from "./pages/ApproveDevice";
import NotFound from "./pages/NotFound";

// Lazily loaded: heavy pages that are not needed on the first paint
const Dashboard = lazy(() => import("./pages/Dashboard"));
const Admin = lazy(() => import("./pages/Admin"));
const ApiDocs = lazy(() => import("./pages/ApiDocs"));
const WidgetPreview = lazy(() => import("./pages/WidgetPreview"));
const Pricing = lazy(() => import("./pages/Pricing"));
const About = lazy(() => import("./pages/About"));
const PartnerWithUs = lazy(() => import("./pages/PartnerWithUs"));
const WidgetGuide = lazy(() => import("./pages/WidgetGuide"));
const TermsOfService = lazy(() => import("./pages/TermsOfService"));
const PrivacyPolicy = lazy(() => import("./pages/PrivacyPolicy"));
const DataProcessing = lazy(() => import("./pages/DataProcessing"));
const Support = lazy(() => import("./pages/Support"));

/** Minimal spinner shown while a lazy route chunk is loading. */
const RouteLoader = () => (
  <div className="min-h-screen flex items-center justify-center bg-background">
    <div className="h-8 w-8 rounded-full border-2 border-muted border-t-foreground animate-spin" />
  </div>
);

const queryClient = new QueryClient();

const App = () => (
  <HelmetProvider>
  <QueryClientProvider client={queryClient}>
    <ConvexAuthProvider client={convexReactClient}>
    <AuthProvider>
      <PostHogProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <CookieConsent />
        <BrowserRouter>
          <ScrollToTop />
          <SignupChooserProvider>
          <ComplianceOnboardingGate>
          <Suspense fallback={<RouteLoader />}>
          <Routes>
            <Route path="/" element={<Index />} />
            <Route path="/dashboard" element={<ProtectedRoute><DashboardHomeRedirect /></ProtectedRoute>} />
            <Route
              path="/dashboard/business"
              element={
                <ProtectedRoute>
                  <Dashboard />
                </ProtectedRoute>
              }
            />
            <Route path="/dashboard/individual" element={<Navigate to="/dashboard/business" replace />} />
            <Route path="/pricing" element={<Pricing />} />
            <Route path="/about" element={<About />} />
            <Route path="/partner" element={<PartnerWithUs />} />
            <Route path="/early-access" element={<Navigate to="/book-demo" replace />} />
            <Route path="/waitlist" element={<Navigate to="/book-demo" replace />} />
            <Route path="/book-demo" element={<BookDemo />} />
            <Route path="/auth" element={<Auth />} />
            <Route path="/auth/invite/:token" element={<AuthInvite />} />
            <Route path="/auth/confirm" element={<AuthConfirm />} />
            <Route path="/forgot-password" element={<ForgotPassword />} />
            <Route path="/reset-password" element={<ResetPassword />} />
            <Route path="/auth/verify-email" element={<VerifyEmail />} />
            <Route path="/auth/approve-device" element={<ApproveDevice />} />
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
            <Route path="/studio" element={<Navigate to="/dashboard/business" replace />} />
            <Route path="/try-on-studio" element={<Navigate to="/dashboard/business" replace />} />
            <Route path="/admin" element={<Admin />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
          </Suspense>
          </ComplianceOnboardingGate>
          </SignupChooserProvider>
        </BrowserRouter>
      </TooltipProvider>
      </PostHogProvider>
    </AuthProvider>
    </ConvexAuthProvider>
  </QueryClientProvider>
  </HelmetProvider>
);

export default App;
