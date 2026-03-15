import { useAuth } from '@/lib/auth-context';
import { upgradeTier } from '@/lib/storage';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Crown, Zap, Shield, Check, Lock } from 'lucide-react';
import { toast } from 'sonner';
import { motion } from 'framer-motion';

const tiers = [
  { id: 'free' as const, name: 'Free', icon: Shield, surveys: 3, rewards: 'KSh 5 – 15', cost: 0, features: ['3 surveys per day', 'Basic survey access', 'Standard support'] },
  { id: 'premium' as const, name: 'Premium', icon: Zap, surveys: 10, rewards: 'KSh 30 – 50', cost: 100, features: ['10 surveys per day', 'Premium survey access', 'Higher rewards', 'Priority support'] },
  { id: 'gold' as const, name: 'Gold', icon: Crown, surveys: 25, rewards: 'KSh 100 – 200', cost: 150, features: ['25 surveys per day', 'All survey access', 'Maximum rewards', 'VIP support', 'Exclusive surveys'] },
];

export default function UpgradePage() {
  const { user, refreshUser } = useAuth();
  const navigate = useNavigate();
  const [showPayModal, setShowPayModal] = useState<'premium' | 'gold' | null>(null);
  const [phone, setPhone] = useState(user?.phone || '');

  if (!user) return null;

  const tierOrder = { free: 0, premium: 1, gold: 2 };

  const handleUpgrade = (tier: 'premium' | 'gold') => {
    upgradeTier(user.id, tier);
    refreshUser();
    setShowPayModal(null);
    toast.success(`Upgraded to ${tier}!`);
  };

  return (
    <div className="px-4 pt-6 max-w-md mx-auto">
      <h1 className="text-2xl font-display font-bold text-foreground mb-2">Upgrade Tier</h1>
      <p className="text-sm text-muted-foreground mb-6">Unlock more surveys and higher rewards</p>

      <div className="space-y-4">
        {tiers.map((tier, i) => {
          const isCurrent = user.tier === tier.id;
          const isLocked = tierOrder[tier.id] <= tierOrder[user.tier];
          const TierIcon = tier.icon;

          return (
            <motion.div key={tier.id} initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: i * 0.1 }}
              className={`bg-card rounded-2xl p-5 shadow-card border-2 ${isCurrent ? 'border-primary' : 'border-border'}`}>
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${tier.id === 'gold' ? 'gradient-gold' : tier.id === 'premium' ? 'gradient-primary' : 'bg-muted'}`}>
                    <TierIcon className={`w-5 h-5 ${tier.id === 'free' ? 'text-muted-foreground' : tier.id === 'gold' ? 'text-accent-foreground' : 'text-primary-foreground'}`} />
                  </div>
                  <div>
                    <h3 className="font-display font-bold text-foreground">{tier.name}</h3>
                    <p className="text-xs text-muted-foreground">{tier.surveys} surveys/day • {tier.rewards}</p>
                  </div>
                </div>
                {isCurrent && <span className="px-2 py-1 rounded-full bg-primary/10 text-primary text-xs font-bold">Current</span>}
              </div>
              <ul className="space-y-1.5 mb-4">
                {tier.features.map(f => (
                  <li key={f} className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Check className="w-4 h-4 text-primary shrink-0" /> {f}
                  </li>
                ))}
              </ul>
              {!isCurrent && !isLocked && (
                <button onClick={() => setShowPayModal(tier.id as 'premium' | 'gold')} className="w-full py-3 rounded-xl gradient-primary text-primary-foreground font-bold hover:opacity-90 transition-opacity">
                  Upgrade — KSh {tier.cost}
                </button>
              )}
              {isLocked && !isCurrent && (
                <div className="text-center text-sm text-muted-foreground py-2">✓ Already unlocked</div>
              )}
            </motion.div>
          );
        })}
      </div>

      {/* Pay Modal */}
      {showPayModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/30 backdrop-blur-sm p-4">
          <div className="bg-card rounded-2xl p-6 shadow-elevated max-w-sm w-full">
            <h3 className="text-xl font-display font-bold text-foreground mb-2">Upgrade to {showPayModal}</h3>
            <p className="text-sm text-muted-foreground mb-4">Pay KSh {showPayModal === 'premium' ? 100 : 150} via M-Pesa STK Push.</p>
            <div className="mb-4">
              <label className="text-sm font-medium text-foreground block mb-1.5">M-Pesa Number</label>
              <input type="tel" value={phone} onChange={e => setPhone(e.target.value)} className="w-full px-4 py-3 rounded-xl border border-input bg-background text-foreground focus:ring-2 focus:ring-ring outline-none" />
            </div>
            <div className="flex gap-3">
              <button onClick={() => setShowPayModal(null)} className="flex-1 py-3 rounded-xl border border-border text-foreground font-medium hover:bg-muted transition-colors">Cancel</button>
              <button onClick={() => handleUpgrade(showPayModal)} className="flex-1 py-3 rounded-xl gradient-primary text-primary-foreground font-bold hover:opacity-90 transition-opacity">
                Pay Now
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
