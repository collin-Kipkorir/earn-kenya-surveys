import React, { useEffect, useState } from 'react';
import { useAuth } from '@/lib/auth-context';
import { getAvailableSurveys } from '@/lib/storage';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ClipboardList, Wallet, ArrowUpCircle, Users, Crown, Zap, Shield } from 'lucide-react';
import AdBanner from '@/components/AdBanner';

export default function DashboardHome() {
  const { user } = useAuth();
  if (!user) return null;

  const available = getAvailableSurveys(user);
  const limit = user.tier === 'gold' ? 25 : user.tier === 'premium' ? 10 : 3;
  const remaining = Math.max(0, limit - user.surveysCompletedToday);
  const tierIcon = user.tier === 'gold' ? Crown : user.tier === 'premium' ? Zap : Shield;

  return (
    <div className="px-4 pt-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <p className="text-sm text-muted-foreground">Welcome back,</p>
          <h1 className="text-2xl font-display font-bold text-foreground">{user.name.split(' ')[0]} 👋</h1>
        </div>
        <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-semibold ${user.tier === 'gold' ? 'gradient-gold text-accent-foreground' : user.tier === 'premium' ? 'gradient-primary text-primary-foreground' : 'bg-muted text-muted-foreground'}`}>
          {React.createElement(tierIcon, { className: "w-4 h-4" })}
          {user.tier.charAt(0).toUpperCase() + user.tier.slice(1)}
        </div>
      </div>

      {/* Balance Card */}
      <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} className="gradient-hero rounded-2xl p-6 text-primary-foreground mb-6">
        <p className="text-sm opacity-80 mb-1">Your Balance</p>
        <p className="text-4xl font-display font-extrabold mb-1">KSh {user.balance.toLocaleString()}</p>
        <p className="text-sm opacity-70">Total earned: KSh {user.totalEarnings.toLocaleString()}</p>
        {!user.isActivated && (
          <div className="mt-3 px-3 py-2 rounded-lg bg-card/20 text-sm">
            ⚠️ Account not activated. <Link to="/dashboard/profile" className="underline font-semibold">Activate now</Link>
          </div>
        )}
      </motion.div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3 mb-6">
        <div className="bg-card rounded-xl p-4 shadow-card">
          <p className="text-xs text-muted-foreground mb-1">Surveys Today</p>
          <p className="text-2xl font-bold text-foreground">{user.surveysCompletedToday}/{limit}</p>
          <div className="mt-2 h-2 rounded-full bg-muted overflow-hidden">
            <div className="h-full gradient-primary rounded-full transition-all" style={{ width: `${(user.surveysCompletedToday / limit) * 100}%` }} />
          </div>
        </div>
        <div className="bg-card rounded-xl p-4 shadow-card">
          <p className="text-xs text-muted-foreground mb-1">Available</p>
          <p className="text-2xl font-bold text-primary">{Math.min(remaining, available.length)}</p>
          <p className="text-xs text-muted-foreground mt-1">surveys left today</p>
        </div>
      </div>

  {/* Quick Actions */}
  <h2 className="font-display font-bold text-foreground mb-3">Quick Actions</h2>
  {/* Inline ad at bottom of quick actions should be dismissable and persist until cleared */}
  <div className="grid grid-cols-2 gap-3">
        <Link to="/dashboard/surveys" className="bg-card rounded-xl p-4 shadow-card flex flex-col items-center gap-2 hover:shadow-elevated transition-shadow">
          <div className="w-12 h-12 rounded-xl gradient-primary flex items-center justify-center"><ClipboardList className="w-6 h-6 text-primary-foreground" /></div>
          <span className="text-sm font-semibold text-foreground">Take Surveys</span>
        </Link>
        <Link to="/dashboard/withdraw" className="bg-card rounded-xl p-4 shadow-card flex flex-col items-center gap-2 hover:shadow-elevated transition-shadow">
          <div className="w-12 h-12 rounded-xl gradient-hero flex items-center justify-center"><Wallet className="w-6 h-6 text-primary-foreground" /></div>
          <span className="text-sm font-semibold text-foreground">Withdraw</span>
        </Link>
        <Link to="/dashboard/upgrade" className="bg-card rounded-xl p-4 shadow-card flex flex-col items-center gap-2 hover:shadow-elevated transition-shadow">
          <div className="w-12 h-12 rounded-xl gradient-gold flex items-center justify-center"><ArrowUpCircle className="w-6 h-6 text-accent-foreground" /></div>
          <span className="text-sm font-semibold text-foreground">Upgrade Tier</span>
        </Link>
        <Link to="/dashboard/referral" className="bg-card rounded-xl p-4 shadow-card flex flex-col items-center gap-2 hover:shadow-elevated transition-shadow">
          <div className="w-12 h-12 rounded-xl bg-secondary flex items-center justify-center"><Users className="w-6 h-6 text-secondary-foreground" /></div>
          <span className="text-sm font-semibold text-foreground">Invite Friends</span>
        </Link>
        {/* Inline Ad — spans full width of the quick-actions grid */}
        <div className="col-span-2">
          <InlineAd />
        </div>
      </div>
    </div>
  );
}

function InlineAd() {
  const [dismissed, setDismissed] = useState<boolean>(() => {
    try {
      return localStorage.getItem('surveyearn_ad_dismissed') === '1';
    } catch {
      return false;
    }
  });

  useEffect(() => {
    try {
      if (dismissed) localStorage.setItem('surveyearn_ad_dismissed', '1');
      else localStorage.removeItem('surveyearn_ad_dismissed');
    } catch (err) {
      // ignore storage errors (private mode, quota, etc.)
    }
  }, [dismissed]);

  if (dismissed) return null;

  return <AdBanner inline show={!dismissed} onDismiss={() => setDismissed(true)} />;
}
