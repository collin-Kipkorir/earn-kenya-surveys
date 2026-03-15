import { Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '@/lib/auth-context';
import { useEffect } from 'react';
import BottomNav from '@/components/BottomNav';

export default function DashboardLayout() {
  const { user, isLoggedIn } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!isLoggedIn) navigate('/login');
    else if (user && !user.onboardingCompleted) navigate('/onboarding');
  }, [isLoggedIn, user, navigate]);

  if (!user) return null;

  return (
    <div className="min-h-screen bg-background pb-20">
      <Outlet />
      <BottomNav />
    </div>
  );
}
