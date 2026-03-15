import { useAuth } from '@/lib/auth-context';
import { getUserTransactions } from '@/lib/storage';
import { motion } from 'framer-motion';
import { ArrowUp, ArrowDown, Gift, Zap, Shield } from 'lucide-react';

const typeIcons: Record<string, any> = {
  surveyReward: ArrowUp,
  referralBonus: Gift,
  onboarding: Gift,
  upgrade: Zap,
  withdrawal: ArrowDown,
  activation: Shield,
};

const typeColors: Record<string, string> = {
  surveyReward: 'text-primary',
  referralBonus: 'text-accent',
  onboarding: 'text-accent',
  upgrade: 'text-secondary',
  withdrawal: 'text-destructive',
  activation: 'text-secondary',
};

export default function EarningsPage() {
  const { user } = useAuth();
  if (!user) return null;

  const transactions = getUserTransactions(user.id).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  return (
    <div className="px-4 pt-6">
      <h1 className="text-2xl font-display font-bold text-foreground mb-6">Earnings</h1>

      <div className="grid grid-cols-2 gap-3 mb-6">
        <div className="bg-card rounded-xl p-4 shadow-card">
          <p className="text-xs text-muted-foreground mb-1">Balance</p>
          <p className="text-2xl font-bold text-foreground">KSh {user.balance.toLocaleString()}</p>
        </div>
        <div className="bg-card rounded-xl p-4 shadow-card">
          <p className="text-xs text-muted-foreground mb-1">Total Earned</p>
          <p className="text-2xl font-bold text-primary">KSh {user.totalEarnings.toLocaleString()}</p>
        </div>
      </div>

      <h2 className="font-display font-bold text-foreground mb-3">Transaction History</h2>
      {transactions.length === 0 ? (
        <p className="text-sm text-muted-foreground">No transactions yet. Start taking surveys!</p>
      ) : (
        <div className="space-y-2">
          {transactions.map((t, i) => {
            const Icon = typeIcons[t.type] || ArrowUp;
            const color = typeColors[t.type] || 'text-foreground';
            const isDebit = t.type === 'withdrawal' || t.type === 'upgrade' || t.type === 'activation';
            return (
              <motion.div key={t.id} initial={{ y: 10, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: i * 0.03 }}
                className="bg-card rounded-xl p-4 shadow-card flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-lg bg-muted flex items-center justify-center ${color}`}>
                    <Icon className="w-5 h-5" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-foreground">{t.description}</p>
                    <p className="text-xs text-muted-foreground">{new Date(t.date).toLocaleDateString()}</p>
                  </div>
                </div>
                <span className={`font-bold ${isDebit ? 'text-destructive' : 'text-primary'}`}>
                  {isDebit ? '-' : '+'}KSh {t.amount}
                </span>
              </motion.div>
            );
          })}
        </div>
      )}
    </div>
  );
}
