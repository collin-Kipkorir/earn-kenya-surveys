import { useAuth } from '@/lib/auth-context';
import { upgradeTier } from '@/lib/storage';
import { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Crown, Zap, Shield, Check, Info } from 'lucide-react';
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
  const [isProcessing, setIsProcessing] = useState(false);
  const [retryAvailable, setRetryAvailable] = useState(false);
  const [currentPaymentId, setCurrentPaymentId] = useState<string | null>(null);
  const [pendingUntil, setPendingUntil] = useState<number | null>(null);
  const activateCancelledRef = useRef(false);
  const formatRemaining = (until: number | null) => {
    if (!until) return '';
    const ms = Math.max(0, until - Date.now());
    const sec = Math.floor(ms / 1000);
    const m = Math.floor(sec / 60).toString().padStart(2, '0');
    const s = (sec % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  if (!user) return null;

  const tierOrder = { free: 0, premium: 1, gold: 2 };

  const handleUpgrade = (tier: 'premium' | 'gold') => {
    (async () => {
      // clear any previous cancel flag for a fresh flow
      activateCancelledRef.current = false;
    try {
    // Basic client-side phone normalization & validation
    const raw = phone || '';
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
    const USE_PAYHERO_CLIENT = String(import.meta.env.VITE_USE_PAYHERO_CLIENT || '').toLowerCase() === 'true';
    const apiBase = (import.meta.env.VITE_API_BASE_URL as string) || (import.meta.env.VITE_API_BASE as string) || '/api';
    const base = apiBase.replace(/\/+$/, '');
    let resp: Response | null = null;
    if (USE_PAYHERO_CLIENT) {
      try {
        // @ts-ignore
        const { payHeroService } = await import('../../payhero-integration/payhero-service');
        const r = await payHeroService.initiateSTKPush({ amount: tier === 'premium' ? 1 : 1, customerName: user?.name || user?.id || 'user', phoneNumber: sendPhone });
        if (r.success) {
          resp = new Response(JSON.stringify({ paymentId: null, providerReference: r.reference, providerRequestId: r.CheckoutRequestID || null, providerResponse: r }), { status: 200, headers: { 'Content-Type': 'application/json' } });
        } else {
          resp = new Response(JSON.stringify({ error: r.error }), { status: 400, headers: { 'Content-Type': 'application/json' } });
        }
      } catch (err) {
        resp = new Response(String(err instanceof Error ? err.message : err), { status: 500 });
      }
    } else {
      const iresp = await fetch(`${base}/payments/initiate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.id, phone: sendPhone, amount: tier === 'premium' ? 100 : 150, purpose: `upgrade:${tier}` })
      });
      resp = iresp;
    }
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
          } catch (e) {
            // ignore
          }
          return;
        }
  const j = await resp.json();
  const paymentId = j.paymentId;
  // Debug: log initiate response for easier troubleshooting
  try { console.groupCollapsed('payments:initiate', paymentId || 'no-payment-id'); console.log('initiate response', j); console.groupEnd(); } catch (e) { /* ignore */ }

        // If the server returned an existing pending initiation, inform the user and prevent retry
        if (j.note === 'existing_pending' && j.payment) {
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

        // If provider returned an immediate error, surface it and fetch logs
        if (j.providerResponse && j.providerResponse.ok === false) {
  
          
          const errMsg = j.providerResponse.body?.error_message || j.providerResponse.error || j.providerResponse.body?.message || 'Payment provider error';
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
          setRetryAvailable(true);
          setIsProcessing(false);
          return;
        }

        // Prefer Payhero `reference`, but fall back to checkout/request ids so the UI doesn't get stuck.
        const providerReference = j.providerReference || j.providerResponse?.body?.reference || j.payment?.providerResponse?.body?.reference || null;
        let providerRequestId = providerReference
          || j.providerRequestId
          || j.providerResponse?.body?.CheckoutRequestID
          || j.providerResponse?.body?.checkout_request_id
          || j.payment?.providerRequestId
          || j.checkoutId
          || null;
        if (!providerRequestId) {
          toast.error('Payment provider did not return a reference or checkout id. Please try again.');
          setRetryAvailable(true);
          setIsProcessing(false);
          return;
        }
        if (j.providerResponse && j.providerResponse.ok === false) {
          const errMsg = j.providerResponse.error || j.providerResponse.body?.message || 'Payment provider error';
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
  if (!paymentId) throw new Error('No payment id returned');
  setCurrentPaymentId(paymentId);
  setIsProcessing(true);
  setRetryAvailable(false);
  toast.success('STK push initiated. Please complete the payment on your phone.');

  const start = Date.now();
  const timeoutMs = 2 * 60 * 1000;
  const NO_STATUS_TIMEOUT_MS = Number(import.meta.env.VITE_PAYHERO_NO_STATUS_TIMEOUT_MS || 10000); // 10s default
    // Require two consecutive successful polls a few seconds apart to avoid premature confirms
    let consecutiveSuccessCount = 0;
    let lastSuccessAt = 0;
    const SUCCESS_GAP_MS = Number(import.meta.env.VITE_PAYHERO_SUCCESS_GAP_MS || 3000);

    while (Date.now() - start < timeoutMs) {
          await new Promise(r => setTimeout(r, 2000));
          // stop polling early if user cancelled via the Cancel button
          if (activateCancelledRef.current) {
            setIsProcessing(false);
            setRetryAvailable(true);
            return;
          }
          try {
              if (providerRequestId) {
              const sresp = await fetch(`${base}/payments/status?reference=${encodeURIComponent(providerRequestId)}`);
              const pdata = await sresp.json();

              // Debug: log status proxy response
              try { console.groupCollapsed('payments:poll', providerRequestId); console.log('status proxy response', pdata); } catch (e) { /* ignore */ }

              if (pdata && pdata.ok === false) {
                setIsProcessing(false);
                setRetryAvailable(true);
                const providerErr = pdata.body?.error_message || pdata.body?.message || pdata.error || 'Payment failed or cancelled. Please try again.';
                try { console.log('provider error (status proxy):', providerErr); } catch (e) { /* ignore */ }
                toast.error(String(providerErr));
                return;
              }

              const providerBody = pdata && pdata.body ? pdata.body : pdata;
              try { console.log('providerBody parsed', providerBody); } catch (e) { /* ignore */ }
              // Accept multiple provider shapes: explicit boolean success, nested data.success, or status/result fields
              const txStatus = providerBody.status || providerBody.result || providerBody.resultCode || providerBody.data?.status || (providerBody.data && providerBody.data.transaction && providerBody.data.transaction.status) || 'unknown';
              const s = String(txStatus).toLowerCase();
              const successKeywords = ['success', '0', 'completed', 'ok'];
              const isSuccess = (providerBody && (providerBody.success === true || providerBody.data?.success === true)) || successKeywords.some(k => s === k || s.includes(k));
              try { console.log('txStatus', txStatus, 'isSuccess', isSuccess); } catch (e) { /* ignore */ }
              try { console.groupEnd(); } catch (e) { /* ignore */ }
              if (isSuccess) {
                // Require two successful polls separated by SUCCESS_GAP_MS to reduce false-positives
                const now = Date.now();
                if (lastSuccessAt && (now - lastSuccessAt) >= SUCCESS_GAP_MS) {
                  consecutiveSuccessCount++;
                } else {
                  consecutiveSuccessCount = 1;
                }
                lastSuccessAt = now;
                try { console.log('consecutiveSuccessCount', consecutiveSuccessCount, 'lastSuccessAt', new Date(lastSuccessAt).toISOString()); } catch (e) { /* ignore */ }

                if (consecutiveSuccessCount < 2) {
                  // wait for another confirmation round
                  continue;
                }

                // Confirm with server and persist the payment before upgrading locally
                try {
                  try { console.log('Calling /payments/confirm with reference', providerRequestId, 'userId', user.id); } catch (e) { /* ignore */ }
                  const confirmResp = await fetch(`${base}/payments/confirm`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ reference: providerRequestId, userId: user.id, phone, amount: tier === 'premium' ? 100 : 150, purpose: `upgrade:${tier}` })
                  });
                  if (confirmResp.ok) {
                    const confirmJson = await confirmResp.json();
                    try { console.log('confirm response', confirmJson); } catch (e) { /* ignore */ }
                    if (confirmJson.payment && confirmJson.payment.status === 'success') {
                      upgradeTier(user.id, tier);
                      refreshUser();
                      setIsProcessing(false);
                      setCurrentPaymentId(null);
                      setShowPayModal(null);
                      toast.success(`Upgraded to ${tier}! Payment processed via M-Pesa.`);
                      return;
                    } else if (confirmJson.awaitingCallback || (confirmJson.payment && confirmJson.payment.status === 'pending')) {
                      // Await webhook: poll local payment record for final status
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
                            upgradeTier(user.id, tier);
                            refreshUser();
                            setIsProcessing(false);
                            setCurrentPaymentId(null);
                            setShowPayModal(null);
                            toast.success(`Upgraded to ${tier}! Payment processed via M-Pesa.`);
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
                } catch (err) {
                  console.error('Confirm call failed', err);
                  setIsProcessing(false);
                  setRetryAvailable(true);
                  toast.error('Error confirming payment with server. Please try again.');
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
            } else {
              // If providerRequestId hasn't arrived within the short window, invalidate this initiation so user can retry
              if (!providerRequestId && (Date.now() - start) > NO_STATUS_TIMEOUT_MS) {
                try {
                  await fetch(`${base}/payments/${paymentId}/invalidate`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ userId: user.id, reason: 'no_status_timeout' })
                  });
                } catch (e) { console.warn('Failed to call invalidate endpoint', e); }
                setIsProcessing(false);
                setRetryAvailable(true);
                toast.error('No response from payment provider — the request has been invalidated. Please try again.');
                return;
              }
              const sresp = await fetch(`${base}/payments/${paymentId}`);
              if (!sresp.ok) continue;
              const data = await sresp.json();
              providerRequestId = data.providerRequestId || null;
              if (data.status === 'success') {
                // Persist/confirm idempotently then upgrade locally
                try {
                  const confirmResp = await fetch(`${base}/payments/confirm`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ external_reference: paymentId, userId: user.id, phone, amount: tier === 'premium' ? 100 : 150, purpose: `upgrade:${tier}` })
                  });
                  if (confirmResp.ok) {
                    const confirmJson = await confirmResp.json();
                    if (confirmJson.payment && confirmJson.payment.status === 'success') {
                      upgradeTier(user.id, tier);
                      refreshUser();
                      setIsProcessing(false);
                      setCurrentPaymentId(null);
                      setShowPayModal(null);
                      toast.success(`Upgraded to ${tier}! Payment processed via M-Pesa.`);
                      return;
                    } else if (confirmJson.awaitingCallback) {
                      // Await webhook: poll local payment record for final status
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
                            upgradeTier(user.id, tier);
                            refreshUser();
                            setIsProcessing(false);
                            setCurrentPaymentId(null);
                            setShowPayModal(null);
                            toast.success(`Upgraded to ${tier}! Payment processed via M-Pesa.`);
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
                // Server confirm did not indicate success; do NOT auto-upgrade. Let the user retry.
                setIsProcessing(false);
                setRetryAvailable(true);
                toast.error('Payment appears successful but could not be confirmed by the server. Please contact support or try again.');
                return;
              }
              if (data.status === 'failed') {
                setIsProcessing(false);
                setRetryAvailable(true);
                toast.error('Payment failed. Please try again.');
                return;
              }
            }
          } catch (err) {
            console.debug('Polling error', err);
          }
        }
  setIsProcessing(false);
  setRetryAvailable(true);
  toast.error('Payment timed out. If you paid but were not upgraded, you can retry.');
      } catch (err) {
        const msg = (err as unknown as { message?: string })?.message || 'Payment initiation failed';
        toast.error(msg);
      }
    })();
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
            <p className="text-sm text-muted-foreground mb-3">Pay KSh {showPayModal === 'premium' ? 100 : 150} via M-Pesa STK Push.</p>
            <div className="flex items-start gap-2 p-3 rounded-xl bg-primary/5 border border-primary/20 mb-4">
              <Info className="w-4 h-4 text-primary shrink-0 mt-0.5" />
              <p className="text-xs text-muted-foreground">
                The upgrade fee is paid via M-Pesa and will <strong>not</strong> be deducted from your SurveyEarn balance.
              </p>
            </div>
            <div className="mb-4">
              <label className="text-sm font-medium text-foreground block mb-1.5">M-Pesa Number</label>
              <input type="tel" value={phone} onChange={e => setPhone(e.target.value)} className="w-full px-4 py-3 rounded-xl border border-input bg-background text-foreground focus:ring-2 focus:ring-ring outline-none" />
            </div>
            {pendingUntil && (
              <div className="mb-4 p-3 rounded-lg bg-yellow-50 border border-yellow-200 text-sm text-yellow-800">
                <div className="font-medium">Pending payment detected</div>
                <div className="mt-1">There is already a pending STK push. Please complete the M-Pesa prompt on your phone. Waiting <strong>{formatRemaining(pendingUntil)}</strong>.</div>
                <div className="mt-2 flex gap-2">
                  <button onClick={async () => {
                    if (!currentPaymentId) { toast('No pending payment id'); return; }
                    try {
                      const apiBase = (import.meta.env.VITE_API_BASE_URL as string) || (import.meta.env.VITE_API_BASE as string) || '/api';
                      const base = apiBase.replace(/\/+$/, '');
                      const resp = await fetch(`${base}/payments/${currentPaymentId}`);
                      if (!resp.ok) { toast.error('Failed to fetch payment status'); return; }
                      const data = await resp.json();
                      toast(`Payment status: ${data.status || 'unknown'}`);
                    } catch (e) { toast.error('Failed to fetch payment status'); }
                  }} className="px-3 py-2 rounded-lg border border-input text-sm">View payment status</button>
                </div>
              </div>
            )}
            <div className="flex gap-3">
              <button onClick={() => { activateCancelledRef.current = true; setShowPayModal(null); setIsProcessing(false); setRetryAvailable(false); setCurrentPaymentId(null); }} className="flex-1 py-3 rounded-xl border border-border text-foreground font-medium hover:bg-muted transition-colors">Cancel</button>
              {!isProcessing && !retryAvailable && !pendingUntil && (
                <button onClick={() => handleUpgrade(showPayModal)} className="flex-1 py-3 rounded-xl gradient-primary text-primary-foreground font-bold hover:opacity-90 transition-opacity">Pay via M-Pesa</button>
              )}
              {pendingUntil && (
                <div className="flex-1">
                  <button disabled className="w-full py-3 rounded-xl bg-muted text-muted-foreground font-bold">Pending — wait {formatRemaining(pendingUntil)}</button>
                  <div className="mt-2">
                    <button onClick={async () => {
                      if (!currentPaymentId) { toast('No pending payment id'); return; }
                      try {
                        const apiBase = (import.meta.env.VITE_API_BASE_URL as string) || (import.meta.env.VITE_API_BASE as string) || '/api';
                        const base = apiBase.replace(/\/+$/, '');
                        const resp = await fetch(`${base}/payments/${currentPaymentId}`);
                        if (!resp.ok) { toast.error('Failed to fetch payment status'); return; }
                        const data = await resp.json();
                        toast(`Payment status: ${data.status || 'unknown'}`);
                      } catch (e) { toast.error('Failed to fetch payment status'); }
                    }} className="w-full py-2 rounded-lg border border-input text-sm">View payment status</button>
                  </div>
                </div>
              )}
              {isProcessing && (
                <button disabled className="flex-1 py-3 rounded-xl bg-muted text-muted-foreground font-bold">Processing…</button>
              )}
              {retryAvailable && (
                <button onClick={() => { setRetryAvailable(false); handleUpgrade(showPayModal); }} className="flex-1 py-3 rounded-xl gradient-primary text-primary-foreground font-bold hover:opacity-90 transition-opacity">Retry</button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
