import { useAuth } from '@/lib/auth-context';
import { Link, useNavigate } from 'react-router-dom';
import { Home, ClipboardList, Wallet, ArrowDownCircle, UserCircle } from 'lucide-react';
import { motion } from 'framer-motion';

const tabs = [
  { path: '/dashboard', icon: Home, label: 'Home' },
  { path: '/dashboard/surveys', icon: ClipboardList, label: 'Surveys' },
  { path: '/dashboard/earnings', icon: Wallet, label: 'Earnings' },
  { path: '/dashboard/withdraw', icon: ArrowDownCircle, label: 'Withdraw' },
  { path: '/dashboard/profile', icon: UserCircle, label: 'Profile' },
];

export default function BottomNav() {
  const location = window.location.pathname;

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-card border-t border-border safe-area-bottom">
      <div className="flex items-center justify-around h-16 max-w-lg mx-auto">
        {tabs.map(tab => {
          const active = location === tab.path || (tab.path !== '/dashboard' && location.startsWith(tab.path));
          return (
            <Link key={tab.path} to={tab.path} className={`flex flex-col items-center gap-0.5 px-2 py-1 transition-colors ${active ? 'text-primary' : 'text-muted-foreground'}`}>
              <tab.icon className="w-5 h-5" />
              <span className="text-[10px] font-medium">{tab.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
