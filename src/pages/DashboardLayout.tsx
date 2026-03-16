import { Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '@/lib/auth-context';
import { useEffect, useState } from 'react';
import BottomNav from '@/components/BottomNav';
import InstallPrompt from '@/components/InstallPrompt';
import AdBanner from '@/components/AdBanner';
import { useAdManager } from '@/hooks/useAdManager';

export default function DashboardLayout() {
  const { user, isLoggedIn } = useAuth();
  const navigate = useNavigate();
  const [showInstall, setShowInstall] = useState(false);
  const { showAd, dismissAd } = useAdManager();

  useEffect(() => {
    if (!isLoggedIn) navigate('/login');
    else if (user && !user.onboardingCompleted) navigate('/onboarding');
  }, [isLoggedIn, user, navigate]);

  // Show install prompt after 5 seconds
  useEffect(() => {
    const timer = setTimeout(() => setShowInstall(true), 5000);
    return () => clearTimeout(timer);
  }, []);

  if (!user) return null;

  return (
    <div className="min-h-screen bg-background pb-20">
      <Outlet />
      <BottomNav />
      <InstallPrompt show={showInstall} onDismiss={() => setShowInstall(false)} />
      <AdBanner show={showAd} onDismiss={dismissAd} />
    </div>
  );
}
