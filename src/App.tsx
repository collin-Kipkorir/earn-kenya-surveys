import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes, Navigate } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/lib/auth-context";
import LandingPage from "./pages/LandingPage";
import RegisterPage from "./pages/RegisterPage";
import LoginPage from "./pages/LoginPage";
import OnboardingPage from "./pages/OnboardingPage";
import DashboardLayout from "./pages/DashboardLayout";
import DashboardHome from "./pages/DashboardHome";
import SurveyListPage from "./pages/SurveyListPage";
import SurveyTakePage from "./pages/SurveyTakePage";
import EarningsPage from "./pages/EarningsPage";
import WithdrawPage from "./pages/WithdrawPage";
import ProfilePage from "./pages/ProfilePage";
import UpgradePage from "./pages/UpgradePage";
import ReferralPage from "./pages/ReferralPage";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            <Route path="/" element={<LandingPage />} />
            <Route path="/register" element={<RegisterPage />} />
            <Route path="/login" element={<LoginPage />} />
            <Route path="/onboarding" element={<OnboardingPage />} />
            <Route path="/dashboard" element={<DashboardLayout />}>
              <Route index element={<DashboardHome />} />
              <Route path="surveys" element={<SurveyListPage />} />
              <Route path="survey/:id" element={<SurveyTakePage />} />
              <Route path="earnings" element={<EarningsPage />} />
              <Route path="withdraw" element={<WithdrawPage />} />
              <Route path="profile" element={<ProfilePage />} />
              <Route path="upgrade" element={<UpgradePage />} />
              <Route path="referral" element={<ReferralPage />} />
            </Route>
            <Route path="*" element={<NotFound />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
