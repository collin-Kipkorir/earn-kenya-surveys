import { useState } from 'react';
import { useAuth } from '@/lib/auth-context';
import { activateAccount, upgradeTier } from '@/lib/storage';
import { useNavigate } from 'react-router-dom';
import { LogOut, Shield, Zap, Crown, Copy, CheckCircle, Phone } from 'lucide-react';
import { toast } from 'sonner';

export default function ProfilePage() {
  const { user, refreshUser, logout } = useAuth();
  const navigate = useNavigate();
  const [activating, setActivating] = useState(false);
  const [stkPhone, setStkPhone] = useState(user?.phone || '');
  const [showActivateModal, setShowActivateModal] = useState(false);

  if (!user) return null;

  const referralLink = `${window.location.origin}/register?ref=${user.referralCode}`;

  const copyReferral = () => {
    navigator.clipboard.writeText(referralLink);
    toast.success('Referral link copied!');
  };

  const handleActivate = () => {
    // In production, this would call PayHero STK Push
    activateAccount(user.id);
    refreshUser();
    setShowActivateModal(false);
    toast.success('Account activated successfully!');
  };

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  return (
    <div className="px-4 pt-6 max-w-md mx-auto">
      <h1 className="text-2xl font-display font-bold text-foreground mb-6">Profile</h1>

      {/* User Info */}
      <div className="bg-card rounded-xl p-5 shadow-card mb-4">
        <div className="flex items-center gap-4 mb-4">
          <div className="w-14 h-14 rounded-full gradient-hero flex items-center justify-center text-primary-foreground text-xl font-bold">
            {user.name.charAt(0)}
          </div>
          <div>
            <h2 className="font-display font-bold text-foreground">{user.name}</h2>
            <p className="text-sm text-muted-foreground">{user.email}</p>
            <p className="text-sm text-muted-foreground">{user.phone}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-semibold ${user.tier === 'gold' ? 'gradient-gold text-accent-foreground' : user.tier === 'premium' ? 'gradient-primary text-primary-foreground' : 'bg-muted text-muted-foreground'}`}>
            {user.tier === 'gold' ? <Crown className="w-3 h-3" /> : user.tier === 'premium' ? <Zap className="w-3 h-3" /> : <Shield className="w-3 h-3" />}
            {user.tier.charAt(0).toUpperCase() + user.tier.slice(1)} Tier
          </span>
          <span className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-semibold ${user.isActivated ? 'bg-primary/10 text-primary' : 'bg-destructive/10 text-destructive'}`}>
            {user.isActivated ? <CheckCircle className="w-3 h-3" /> : <Shield className="w-3 h-3" />}
            {user.isActivated ? 'Activated' : 'Not Activated'}
          </span>
        </div>
      </div>

      {/* Activation */}
      {!user.isActivated && (
        <div className="bg-card rounded-xl p-5 shadow-card mb-4 border-2 border-accent">
          <h3 className="font-display font-bold text-foreground mb-2">Activate Your Account</h3>
          <p className="text-sm text-muted-foreground mb-3">Pay KSh 100 to activate and unlock withdrawals.</p>
          <button onClick={() => setShowActivateModal(true)} className="w-full py-3 rounded-xl gradient-primary text-primary-foreground font-bold hover:opacity-90 transition-opacity">
            Activate Now — KSh 100
          </button>
        </div>
      )}

      {/* Referral */}
      <div className="bg-card rounded-xl p-5 shadow-card mb-4">
        <h3 className="font-display font-bold text-foreground mb-2">Referral Link</h3>
        <p className="text-sm text-muted-foreground mb-3">Earn KSh 20 per activated referral</p>
        <div className="flex gap-2">
          <input readOnly value={referralLink} className="flex-1 px-3 py-2 rounded-lg border border-input bg-muted text-sm text-foreground truncate" />
          <button onClick={copyReferral} className="px-4 py-2 rounded-lg gradient-primary text-primary-foreground hover:opacity-90">
            <Copy className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Logout */}
      <button onClick={handleLogout} className="w-full flex items-center justify-center gap-2 py-3 rounded-xl border-2 border-destructive text-destructive font-bold hover:bg-destructive/5 transition-colors">
        <LogOut className="w-5 h-5" /> Logout
      </button>

      {/* Activate Modal */}
      {showActivateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/30 backdrop-blur-sm p-4">
          <div className="bg-card rounded-2xl p-6 shadow-elevated max-w-sm w-full">
            <h3 className="text-xl font-display font-bold text-foreground mb-2">Account Activation</h3>
            <p className="text-sm text-muted-foreground mb-4">An M-Pesa STK push of KSh 100 will be sent to your phone.</p>
            <div className="mb-4">
              <label className="text-sm font-medium text-foreground block mb-1.5">M-Pesa Number</label>
              <input type="tel" value={stkPhone} onChange={e => setStkPhone(e.target.value)} className="w-full px-4 py-3 rounded-xl border border-input bg-background text-foreground focus:ring-2 focus:ring-ring outline-none" />
            </div>
            <div className="flex gap-3">
              <button onClick={() => setShowActivateModal(false)} className="flex-1 py-3 rounded-xl border border-border text-foreground font-medium hover:bg-muted transition-colors">Cancel</button>
              <button onClick={handleActivate} className="flex-1 py-3 rounded-xl gradient-primary text-primary-foreground font-bold hover:opacity-90 transition-opacity">
                Pay KSh 100
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
