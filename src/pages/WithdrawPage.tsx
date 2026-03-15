import { useState } from 'react';
import { useAuth } from '@/lib/auth-context';
import { requestWithdrawal } from '@/lib/storage';
import { AlertCircle, CheckCircle } from 'lucide-react';
import { z } from 'zod';

const phoneSchema = z.string().regex(/^(07|01|\+254)\d{8,9}$/, 'Invalid M-Pesa number');

export default function WithdrawPage() {
  const { user, refreshUser } = useAuth();
  const [phone, setPhone] = useState(user?.phone || '');
  const [amount, setAmount] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  if (!user) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess(false);

    const pr = phoneSchema.safeParse(phone);
    if (!pr.success) { setError(pr.error.errors[0].message); return; }

    try {
      requestWithdrawal(user.id, parseInt(amount), phone);
      refreshUser();
      setSuccess(true);
      setAmount('');
    } catch (err: any) {
      setError(err.message);
    }
  };

  return (
    <div className="px-4 pt-6 max-w-md mx-auto">
      <h1 className="text-2xl font-display font-bold text-foreground mb-2">Withdraw</h1>
      <p className="text-sm text-muted-foreground mb-6">Withdraw your earnings via M-Pesa</p>

      <div className="bg-card rounded-xl p-4 shadow-card mb-6">
        <p className="text-xs text-muted-foreground mb-1">Available Balance</p>
        <p className="text-3xl font-bold text-foreground">KSh {user.balance.toLocaleString()}</p>
      </div>

      {!user.isActivated && (
        <div className="flex items-start gap-2 p-3 rounded-lg bg-accent/20 text-accent-foreground text-sm mb-4">
          <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
          <p>You must activate your account (KSh 100) before withdrawing. Go to Profile to activate.</p>
        </div>
      )}

      {success && (
        <div className="flex items-center gap-2 p-3 rounded-lg bg-primary/10 text-primary text-sm mb-4">
          <CheckCircle className="w-5 h-5" />
          <p>Withdrawal request submitted successfully!</p>
        </div>
      )}

      {error && <div className="p-3 rounded-lg bg-destructive/10 text-destructive text-sm mb-4">{error}</div>}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="text-sm font-medium text-foreground block mb-1.5">M-Pesa Phone Number</label>
          <input type="tel" value={phone} onChange={e => setPhone(e.target.value)} placeholder="0712345678" className="w-full px-4 py-3 rounded-xl border border-input bg-background text-foreground placeholder:text-muted-foreground focus:ring-2 focus:ring-ring outline-none" required />
        </div>
        <div>
          <label className="text-sm font-medium text-foreground block mb-1.5">Amount (Min KSh 5,000)</label>
          <input type="number" value={amount} onChange={e => setAmount(e.target.value)} placeholder="5000" min={5000} className="w-full px-4 py-3 rounded-xl border border-input bg-background text-foreground placeholder:text-muted-foreground focus:ring-2 focus:ring-ring outline-none" required />
        </div>
        <button type="submit" disabled={!user.isActivated} className="w-full py-3.5 rounded-xl gradient-primary text-primary-foreground font-bold hover:opacity-90 transition-opacity disabled:opacity-50">
          Request Withdrawal
        </button>
      </form>
    </div>
  );
}
