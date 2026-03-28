import { useState, useEffect, useRef } from 'react';
import { payHeroService } from './payhero-service';
import type { PayHeroStatusResponse } from './payhero-types';

interface UsePaymentPollingOptions {
  onSuccess?: () => void;
  onError?: (error: string) => void;
  onTimeout?: () => void;
  maxAttempts?: number;
  pollInterval?: number;
}

export function usePaymentPolling(paymentReference: string | null, options: UsePaymentPollingOptions = {}) {
  const { onSuccess, onError, onTimeout, maxAttempts = 90, pollInterval = 2000 } = options;
  const [status, setStatus] = useState<'idle'|'polling'|'success'|'failed'|'timeout'>('idle');
  const [message, setMessage] = useState('');
  const [error, setError] = useState<string | null>(null);
  const sessionRef = useRef<{ attempts: number; startTime: number; intervalId?: any; timeoutId?: any }>({ attempts: 0, startTime: 0 });

  useEffect(() => {
    if (!paymentReference) {
      setStatus('idle');
      return;
    }

    setStatus('polling');
    setMessage('Initiating payment...');
    setError(null);

    let mounted = true;
    const start = Date.now();
    sessionRef.current = { attempts: 0, startTime: start };

    sessionRef.current.intervalId = setInterval(async () => {
      try {
        sessionRef.current.attempts++;
        if (!mounted) return;
        const response: PayHeroStatusResponse = await payHeroService.checkPaymentStatus(paymentReference);
        if (response.status === 'SUCCESS') {
          clearInterval(sessionRef.current.intervalId);
          setStatus('success');
          onSuccess?.();
        } else if (response.status === 'FAILED') {
          clearInterval(sessionRef.current.intervalId);
          setStatus('failed');
          const errMsg = response.error?.message || 'Payment failed';
          setError(errMsg);
          onError?.(errMsg);
        } else {
          // still pending/queued
          const elapsed = Math.floor((Date.now() - start) / 1000);
          if (elapsed > 30) setMessage('Please check your M-PESA prompt to accept the payment');
        }

        if (sessionRef.current.attempts >= maxAttempts) {
          clearInterval(sessionRef.current.intervalId);
          setStatus('timeout');
          setError('Payment timed out');
          onTimeout?.();
        }
      } catch (err) {
        clearInterval(sessionRef.current.intervalId);
        setStatus('failed');
        const errMsg = err instanceof Error ? err.message : 'Unknown error';
        setError(errMsg);
        onError?.(errMsg);
      }
    }, pollInterval);

    sessionRef.current.timeoutId = setTimeout(() => {
      clearInterval(sessionRef.current.intervalId);
      setStatus('timeout');
      setError('Payment timed out');
      onTimeout?.();
    }, maxAttempts * pollInterval);

    return () => {
      mounted = false;
      clearInterval(sessionRef.current.intervalId);
      clearTimeout(sessionRef.current.timeoutId);
    };
  }, [paymentReference, maxAttempts, pollInterval, onSuccess, onError, onTimeout]);

  return { status, message, error };
}
