import { useState, useEffect, useRef } from 'react';
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
  const [pendingUntil, setPendingUntil] = useState<number | null>(null);
  const [currentPaymentId, setCurrentPaymentId] = useState<string | null>(null);
  const activateCancelledRef = useRef(false);

  

  if (!user) return null;

  const referralLink = `${window.location.origin}/register?ref=${user.referralCode}`;

  const copyReferral = () => {
    navigator.clipboard.writeText(referralLink);
    toast.success('Referral link copied!');
  };

  const handleActivate = () => {
    (async () => {
      activateCancelledRef.current = false;
      // Basic client-side phone normalization & validation
      const raw = stkPhone || '';
      const digits = raw.replace(/\D/g, '');
      let normalized = digits;
      if (normalized.startsWith('254')) normalized = '0' + normalized.slice(3);
      if (normalized.startsWith('+254')) normalized = '0' + normalized.slice(4);
      if (normalized.startsWith('7') && normalized.length === 9) normalized = '0' + normalized;
      if (!/^0\d{9}$/.test(normalized)) {
        toast.error('Please enter a valid Kenyan phone number (e.g. 0712345678)');
        return;
      }
      const sendPhone = normalized;
      try {
        const USE_PAYHERO_CLIENT = String(import.meta.env.VITE_USE_PAYHERO_CLIENT || '').toLowerCase() === 'true';
        const apiBase = (import.meta.env.VITE_API_BASE_URL as string) || (import.meta.env.VITE_API_BASE as string) || '/api';
        const base = apiBase.replace(/\/+$/, '');
        let resp: Response | null = null;
        if (USE_PAYHERO_CLIENT) {
          try {
            // @ts-ignore
            const { payHeroService } = await import('../../payhero-integration/payhero-service');
            const r = await payHeroService.initiateSTKPush({ amount: 1, customerName: user?.name || user?.id || 'user', phoneNumber: sendPhone });
            if (r.success) {
              resp = new Response(JSON.stringify({ paymentId: null, providerReference: r.reference, providerRequestId: r.CheckoutRequestID || null, providerResponse: r }), { status: 200, headers: { 'Content-Type': 'application/json' } });
            } else {
              resp = new Response(JSON.stringify({ error: r.error }), { status: 400, headers: { 'Content-Type': 'application/json' } });
            }
          } catch (err) {
            resp = new Response(String(err instanceof Error ? err.message : err), { status: 500 });
          }
        } else {
          resp = await fetch(`${base}/payments/initiate`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId: user.id, phone: sendPhone, amount: 1, purpose: 'activation' })
          });
        }
        if (!resp) throw new Error('No response from initiate');
        const j = await resp.json().catch(() => null);
        const paymentId = j?.paymentId || j?.payment?.id || j?.id || null;

        if (!resp.ok) {
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
          } catch (e) { /* ignore */ }
          return;
        }

        // existing pending
        if (j?.note === 'existing_pending' && j.payment) {
          const created = j.payment.createdAt ? new Date(j.payment.createdAt).getTime() : Date.now();
          const COOLDOWN_MIN = Number(import.meta.env.VITE_PAYHERO_INITIATE_COOLDOWN_MIN || 5);
          const windowMs = COOLDOWN_MIN * 60 * 1000;
          const until = created + windowMs;
          setPendingUntil(until);
          setCurrentPaymentId(j.payment.id || null);
          setIsProcessing(false);
          setRetryAvailable(false);
          toast(`There is already a pending payment attempt. Please complete the M-Pesa prompt on your phone or wait ${COOLDOWN_MIN} minutes before retrying.`);
          const ms = until - Date.now();
          if (ms > 0) setTimeout(() => { setPendingUntil(null); setRetryAvailable(true); }, ms);
          return;
        }

        if (j?.providerResponse && j.providerResponse.ok === false) {
          const errMsg = j.providerResponse.body?.error_message || j.providerResponse.error || j.providerResponse.body?.message || 'Payment provider error';
          toast.error(`Payment initiation error: ${errMsg}`);
          setRetryAvailable(true);
          setIsProcessing(false);
          return;
        }

        const providerReference = j?.providerReference || j?.providerResponse?.body?.reference || j?.payment?.providerResponse?.body?.reference || null;
        let providerRequestId = providerReference
          || j?.providerRequestId
          || j?.providerResponse?.body?.CheckoutRequestID
          || j?.providerResponse?.body?.checkout_request_id
          || j?.payment?.providerRequestId
          || j?.checkoutId
          || null;

        if (!providerRequestId && !paymentId) {
          toast.error('Payment provider did not return a reference or checkout id. Please try again.');
          setRetryAvailable(true);
          setIsProcessing(false);
          return;
        }

        if (!paymentId) throw new Error('No payment id returned');
        setCurrentPaymentId(paymentId);
        setIsProcessing(true);
        setRetryAvailable(false);
        toast.success('STK push initiated. Please complete the payment on your phone.');

        const start = Date.now();
        const timeoutMs = 2 * 60 * 1000;
        const NO_STATUS_TIMEOUT_MS = Number(import.meta.env.VITE_PAYHERO_NO_STATUS_TIMEOUT_MS || 10000);
        let consecutiveSuccessCount = 0;
        let lastSuccessAt = 0;
        const SUCCESS_GAP_MS = Number(import.meta.env.VITE_PAYHERO_SUCCESS_GAP_MS || 3000);

        while (Date.now() - start < timeoutMs) {
          await new Promise(r => setTimeout(r, 2000));
          if (activateCancelledRef.current) {
            setIsProcessing(false);
            setRetryAvailable(true);
            return;
          }
          try {
            if (providerRequestId) {
              const sresp = await fetch(`${base}/payments/status?reference=${encodeURIComponent(providerRequestId)}`);
              const pdata = await sresp.json();
              if (pdata && pdata.ok === false) {
                setIsProcessing(false);
                setRetryAvailable(true);
                const providerErr = pdata.body?.error_message || pdata.body?.message || pdata.error || 'Payment failed or cancelled. Please try again.';
                toast.error(String(providerErr));
                return;
              }
              const providerBody = pdata && pdata.body ? pdata.body : pdata;
              const txStatus = providerBody.status || providerBody.result || providerBody.resultCode || providerBody.data?.status || (providerBody.data && providerBody.data.transaction && providerBody.data.transaction.status) || 'unknown';
              const s = String(txStatus).toLowerCase();
              const successKeywords = ['success', '0', 'completed', 'ok'];
              const isSuccess = (providerBody && (providerBody.success === true || providerBody.data?.success === true)) || successKeywords.some(k => s === k || s.includes(k));
              if (isSuccess) {
                const now = Date.now();
                if (lastSuccessAt && (now - lastSuccessAt) >= SUCCESS_GAP_MS) {
                  consecutiveSuccessCount++;
                } else {
                  consecutiveSuccessCount = 1;
                }
                lastSuccessAt = now;
                if (consecutiveSuccessCount < 2) continue;

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
                    setShowActivateModal(false);
                    toast.success('Account activated! KSh 100 has been added to your balance as a bonus.');
                    return;
                  } else if (confirmJson.awaitingCallback) {
                    // poll local payment record for finalization
                    try {
                      toast('Payment recorded. Waiting for provider callback to finalize...');
                      const pollStart = Date.now();
                      const pollTimeout = 90 * 1000;
                      while (Date.now() - pollStart < pollTimeout) {
                        await new Promise(r => setTimeout(r, 2000));
                        const resp2 = await fetch(`${base}/payments/${paymentId}`);
                        if (!resp2.ok) continue;
                        const data2 = await resp2.json();
                        if (data2.status === 'success') {
                          activateAccount(user.id);
                          refreshUser();
                          setIsProcessing(false);
                          setCurrentPaymentId(null);
                          setShowActivateModal(false);
                          toast.success('Account activated! KSh 100 has been added to your balance as a bonus.');
                          return;
                        }
                        if (data2.status === 'failed') {
                          setIsProcessing(false);
                          setRetryAvailable(true);
                          toast.error('Payment failed. Please try again.');
                          return;
                        }
                      }
                      setIsProcessing(false);
                      setRetryAvailable(true);
                      toast.error('Payment recorded but not yet confirmed by the server. Please contact support or try again later.');
                      return;
                    } catch (err) {
                      console.debug('Callback polling failed', err);
                      setIsProcessing(false);
                      setRetryAvailable(true);
                      toast.error('Error while waiting for payment confirmation. Please try again.');
                      return;
                    }
                  } else {
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
              }
              if (s && !['pending', 'unknown'].includes(s)) {
                setIsProcessing(false);
                setRetryAvailable(true);
                const providerErr = providerBody?.error_message || providerBody?.message || 'Payment failed. Please try again.';
                toast.error(String(providerErr));
                return;
              }
            }
            // If providerRequestId hasn't been returned within NO_STATUS_TIMEOUT_MS, invalidate the attempt
            if (!providerRequestId && (Date.now() - start) > NO_STATUS_TIMEOUT_MS) {
              try {
                await fetch(`${base}/payments/${paymentId}/invalidate`, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ userId: user.id, reason: 'no_status_timeout' })
                });
              } catch (e) {
                console.warn('Failed to call invalidate endpoint', e);
              }
              setIsProcessing(false);
              setRetryAvailable(true);
              toast.error('No response from payment provider — the request has been invalidated. Please try again.');
              return;
            }

            // poll the local payment record
            const sresp = await fetch(`${base}/payments/${paymentId}`);
            if (!sresp.ok) continue;
            const data = await sresp.json();
            providerRequestId = data.providerRequestId || null;
            const status = data.status;
            if (status === 'success') {
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
                    setShowActivateModal(false);
                    toast.success('Account activated! KSh 100 has been added to your balance as a bonus.');
                    return;
                  } else if (confirmJson.awaitingCallback) {
                    // Server still waiting for webhook; poll local payment record for finalization
                    try {
                      const pollStart = Date.now();
                      const pollTimeout = 90 * 1000;
                      while (Date.now() - pollStart < pollTimeout) {
                        await new Promise(r => setTimeout(r, 2000));
                        const resp2 = await fetch(`${base}/payments/${paymentId}`);
                        if (!resp2.ok) continue;
                        const data2 = await resp2.json();
                        if (data2.status === 'success') {
                          activateAccount(user.id);
                          refreshUser();
                          setIsProcessing(false);
                          setCurrentPaymentId(null);
                          setShowActivateModal(false);
                          toast.success('Account activated! KSh 100 has been added to your balance as a bonus.');
                          return;
                        }
                        if (data2.status === 'failed') {
                          setIsProcessing(false);
                          setRetryAvailable(true);
                          toast.error('Payment failed. Please try again.');
                          return;
                        }
                      }
                      setIsProcessing(false);
                      setRetryAvailable(true);
                      toast.error('Payment recorded but not yet confirmed by the server. Please contact support or try again later.');
                      return;
                    } catch (err) {
                      console.debug('Callback polling failed', err);
                      setIsProcessing(false);
                      setRetryAvailable(true);
                      toast.error('Error while waiting for payment confirmation. Please try again.');
                      return;
                    }
                  }
                }
              } catch (err) {
                console.debug('Confirm idempotent call failed', err);
              }
              setIsProcessing(false);
              setRetryAvailable(true);
              toast.error('Payment appears successful but could not be confirmed by the server. Please contact support or try again.');
              return;
            }
            if (status === 'failed') {
              setIsProcessing(false);
              setRetryAvailable(true);
              toast.error('Payment failed. Please try again.');
              return;
            }
          } catch (err) {
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

  const viewPendingPaymentStatus = async () => {
    if (!currentPaymentId) { toast('No pending payment id available'); return; }
    try {
      const apiBase = (import.meta.env.VITE_API_BASE_URL as string) || (import.meta.env.VITE_API_BASE as string) || '/api';
      const base = apiBase.replace(/\/+$/, '');
      const resp = await fetch(`${base}/payments/${currentPaymentId}`);
      if (!resp.ok) { toast.error('Failed to fetch payment status'); return; }
      const data = await resp.json();
      toast(`Payment status: ${data.status || 'unknown'}`);
    } catch (e) {
      toast.error('Failed to fetch payment status');
    }
  };

  const formatRemaining = (until: number | null) => {
    if (!until) return '';
    const ms = Math.max(0, until - Date.now());
    const sec = Math.floor(ms / 1000);
    const m = Math.floor(sec / 60).toString().padStart(2, '0');
    const s = (sec % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
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
            {pendingUntil && (
              <div className="mb-4 p-3 rounded-lg bg-yellow-50 border border-yellow-200 text-sm text-yellow-800">
                <div className="font-medium">Pending payment detected</div>
                <div className="mt-1">There is already a pending STK push. Please complete the M-Pesa prompt on your phone. Waiting <strong>{formatRemaining(pendingUntil)}</strong>.</div>
                <div className="mt-2 flex gap-2">
                  <button onClick={viewPendingPaymentStatus} className="px-3 py-2 rounded-lg border border-input text-sm">View payment status</button>
                </div>
              </div>
            )}
            <div className="flex gap-3">
              <button onClick={() => { activateCancelledRef.current = true; setShowActivateModal(false); setIsProcessing(false); setRetryAvailable(false); setCurrentPaymentId(null); }} className="flex-1 py-3 rounded-xl border border-border text-foreground font-medium hover:bg-muted transition-colors">Cancel</button>
              {!isProcessing && !retryAvailable && !pendingUntil && (
                  <button onClick={handleActivate} className="flex-1 py-3 rounded-xl gradient-primary text-primary-foreground font-bold hover:opacity-90 transition-opacity">Pay KSh 100</button>
              )}
              {pendingUntil && (
                <div className="flex-1">
                  <button disabled className="w-full py-3 rounded-xl bg-muted text-muted-foreground font-bold">Pending — wait {formatRemaining(pendingUntil)}</button>
                  <div className="mt-2">
                    <button onClick={viewPendingPaymentStatus} className="w-full py-2 rounded-lg border border-input text-sm">View payment status</button>
                  </div>
                </div>
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
