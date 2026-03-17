import { useState, useEffect } from 'react';
import { useAuth } from '@/lib/auth-context';
import { activateAccount } from '@/lib/storage';
import { useNavigate } from 'react-router-dom';
import { LogOut, Shield, Zap, Crown, Copy, CheckCircle, Info } from 'lucide-react';
import { toast } from 'sonner';

export default function ProfilePage() {
  const { user, refreshUser, logout } = useAuth();
  const navigate = useNavigate();
  const [stkPhone, setStkPhone] = useState(user?.phone || '');
  const [showActivateModal, setShowActivateModal] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [retryAvailable, setRetryAvailable] = useState(false);
  const [currentPaymentId, setCurrentPaymentId] = useState<string | null>(null);

  if (!user) return null;

  const referralLink = `${window.location.origin}/register?ref=${user.referralCode}`;

  const copyReferral = () => {
    navigator.clipboard.writeText(referralLink);
    toast.success('Referral link copied!');
  };

  const handleActivate = () => {
    // Start payment flow via backend server which will call Payhero and receive callback.
    // The server will return a paymentId which we poll for status. Only after status === 'success'
    // do we activate the user locally.
    (async () => {
      try {
  const apiBase = (import.meta.env.VITE_API_BASE_URL as string) || (import.meta.env.VITE_API_BASE as string) || '/api';
  const base = apiBase.replace(/\/+$/, '');
  const resp = await fetch(`${base}/payments/initiate`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId: user.id, phone: stkPhone, amount: 100, purpose: 'activation' })
        });
        if (!resp.ok) {
          // try to read detailed error from body
          const errBodyText = await resp.text().catch(() => '');
          let errBodyObj: unknown = null;
          try { errBodyObj = JSON.parse(errBodyText); } catch (e) { errBodyObj = null; }
          console.error('Payment initiate failed', resp.status, errBodyObj || errBodyText);
          let errMsg = `HTTP ${resp.status}`;
          if (typeof errBodyObj === 'object' && errBodyObj !== null) {
            const o = errBodyObj as Record<string, unknown>;
            if (typeof o.error === 'string') errMsg = o.error;
            else if (typeof o.message === 'string') errMsg = o.message;
          } else if (errBodyText) {
            errMsg = errBodyText;
          }
          toast.error(`Payment initiation error: ${errMsg}`);
          try {
            const logsResp = await fetch(`${base}/payments/logs?limit=50`);
            if (logsResp.ok) {
              const logsJson = await logsResp.json();
              console.groupCollapsed('Payhero logs (initiate error)');
              console.log(logsJson.logs);
              console.groupEnd();
            }
          } catch (e) {
            // ignore
          }
          return;
        }
        const j = await resp.json();
        const paymentId = j.paymentId;
        let providerRequestId = j.providerRequestId || null;
        // If provider returned an immediate error, surface it and fetch logs
        if (j.providerResponse && j.providerResponse.ok === false) {
          const errMsg = j.providerResponse.error || j.providerResponse.body?.message || 'Payment provider error';
          toast.error(`Payment initiation error: ${errMsg}`);
          try {
            const apiBase = (import.meta.env.VITE_API_BASE_URL as string) || (import.meta.env.VITE_API_BASE as string) || '/api';
            const base = apiBase.replace(/\/+$/, '');
            const logsResp = await fetch(`${base}/payments/logs?limit=50`);
            if (logsResp.ok) {
              const logsJson = await logsResp.json();
              console.groupCollapsed('Payhero logs (initiate error)');
              console.log(logsJson.logs);
              console.groupEnd();
            }
          } catch (e) {
            // ignore
          }
          return;
        }
  if (!paymentId) throw new Error('No payment id returned');
  setCurrentPaymentId(paymentId);
  setIsProcessing(true);
  setRetryAvailable(false);
  toast.success('STK push initiated. Please complete the payment on your phone.');

  // poll for status — if initiate returned providerRequestId use it immediately,
  // otherwise poll the local payment record until providerRequestId becomes available.
  const start = Date.now();
        const timeoutMs = 2 * 60 * 1000; // 2 minutes
  // providerRequestId may have been returned directly from initiate
        let status = 'pending';
        while (Date.now() - start < timeoutMs) {
          await new Promise(r => setTimeout(r, 2000));

          try {
            if (providerRequestId) {
              // poll Payhero via our status proxy
              const sresp = await fetch(`${base}/payments/status?reference=${encodeURIComponent(providerRequestId)}`);
              if (!sresp.ok) continue;
              const pdata = await sresp.json();
              const txStatus = pdata.status || pdata.result || pdata.resultCode || pdata.data?.status || (pdata.data && pdata.data.transaction && pdata.data.transaction.status) || 'unknown';
              const s = String(txStatus).toLowerCase();
              const successKeywords = ['success', '0', 'completed', 'ok'];
              const isSuccess = successKeywords.some(k => s === k || s.includes(k));
              if (isSuccess) {
                // Confirm with server and persist the payment before activating locally
                try {
                  const confirmResp = await fetch(`${base}/payments/confirm`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ reference: providerRequestId, userId: user.id, phone: stkPhone, amount: 100, purpose: 'activation' })
                  });
                  if (confirmResp.ok) {
                    const confirmJson = await confirmResp.json();
                    if (confirmJson.payment && confirmJson.payment.status === 'success') {
                      activateAccount(user.id);
                      refreshUser();
                      setIsProcessing(false);
                      setCurrentPaymentId(null);
                      toast.success('Account activated! KSh 100 has been added to your balance as a bonus.');
                      return;
                    } else {
                      // Server did not confirm success; surface to user
                      setIsProcessing(false);
                      setRetryAvailable(true);
                      toast.error('Payment appears successful but could not be confirmed by the server. Please contact support or try again.');
                      return;
                    }
                  } else {
                    setIsProcessing(false);
                    setRetryAvailable(true);
                    toast.error('Failed to confirm payment with server. Please try again.');
                    return;
                  }
                } catch (err) {
                  console.error('Confirm call failed', err);
                  setIsProcessing(false);
                  setRetryAvailable(true);
                  toast.error('Error confirming payment with server. Please try again.');
                  return;
                }
              }
              if (s && !['pending', 'unknown'].includes(s)) {
                toast.error('Payment failed. Please try again.');
                return;
              }
            } else {
              // poll the local payment record
              const sresp = await fetch(`${base}/payments/${paymentId}`);
              if (!sresp.ok) continue;
              const data = await sresp.json();
              providerRequestId = data.providerRequestId || null;
              status = data.status;
              if (status === 'success') {
                // Payment already persisted by callback or previous confirm; still try to confirm idempotently
                try {
                  const confirmResp = await fetch(`${base}/payments/confirm`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ external_reference: paymentId, userId: user.id, phone: stkPhone, amount: 100, purpose: 'activation' })
                  });
                  if (confirmResp.ok) {
                    const confirmJson = await confirmResp.json();
                    if (confirmJson.payment && confirmJson.payment.status === 'success') {
                      activateAccount(user.id);
                      refreshUser();
                      setIsProcessing(false);
                      setCurrentPaymentId(null);
                      toast.success('Account activated! KSh 100 has been added to your balance as a bonus.');
                      return;
                    }
                  }
                } catch (err) {
                  console.debug('Confirm idempotent call failed', err);
                }
                // If we reached here, fallback to local activation but warn the user
                activateAccount(user.id);
                refreshUser();
                setIsProcessing(false);
                setCurrentPaymentId(null);
                toast.success('Account activated! KSh 100 has been added to your balance as a bonus.');
                return;
              }
              if (status === 'failed') {
                setIsProcessing(false);
                setRetryAvailable(true);
                toast.error('Payment failed. Please try again.');
                return;
              }
            }
          } catch (err) {
            // ignore and retry until timeout
            console.debug('Polling error', err);
          }
        }
        setIsProcessing(false);
        setRetryAvailable(true);
        toast.error('Payment timed out. If you paid but were not activated, you can retry.');
      } catch (err) {
        console.error(err);
        const msg = (err as unknown as { message?: string })?.message || 'Payment initiation failed';
        toast.error(msg);
      }
    })();
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
          <p className="text-sm text-muted-foreground mb-2">Pay KSh 100 via M-Pesa to activate your account and unlock withdrawals.</p>
          <div className="flex items-start gap-2 p-3 rounded-xl bg-primary/5 border border-primary/20 mb-3">
            <Info className="w-4 h-4 text-primary shrink-0 mt-0.5" />
            <p className="text-xs text-muted-foreground">
              <strong>Bonus:</strong> The KSh 100 activation fee will be added to your SurveyEarn balance after activation!
            </p>
          </div>
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
            <p className="text-sm text-muted-foreground mb-3">An M-Pesa STK push of KSh 100 will be sent to your phone.</p>
            <div className="flex items-start gap-2 p-3 rounded-xl bg-primary/5 border border-primary/20 mb-4">
              <Info className="w-4 h-4 text-primary shrink-0 mt-0.5" />
              <p className="text-xs text-muted-foreground">
                The KSh 100 will be <strong>added to your balance</strong> as an activation bonus!
              </p>
            </div>
            <div className="mb-4">
              <label className="text-sm font-medium text-foreground block mb-1.5">M-Pesa Number</label>
              <input type="tel" value={stkPhone} onChange={e => setStkPhone(e.target.value)} className="w-full px-4 py-3 rounded-xl border border-input bg-background text-foreground focus:ring-2 focus:ring-ring outline-none" />
            </div>
            <div className="flex gap-3">
              <button onClick={() => { setShowActivateModal(false); setIsProcessing(false); setRetryAvailable(false); setCurrentPaymentId(null); }} className="flex-1 py-3 rounded-xl border border-border text-foreground font-medium hover:bg-muted transition-colors">Cancel</button>
              {!isProcessing && !retryAvailable && (
                <button onClick={handleActivate} className="flex-1 py-3 rounded-xl gradient-primary text-primary-foreground font-bold hover:opacity-90 transition-opacity">Pay KSh 100</button>
              )}
              {isProcessing && (
                <button disabled className="flex-1 py-3 rounded-xl bg-muted text-muted-foreground font-bold">Processing…</button>
              )}
              {retryAvailable && (
                <button onClick={() => { setRetryAvailable(false); handleActivate(); }} className="flex-1 py-3 rounded-xl gradient-primary text-primary-foreground font-bold hover:opacity-90 transition-opacity">Retry</button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
