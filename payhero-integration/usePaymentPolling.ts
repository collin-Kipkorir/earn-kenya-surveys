// payhero-integration/usePaymentPolling.ts
import { useEffect, useRef, useState } from 'react';
import { checkPaymentStatus } from './payhero-service';
import { DEFAULT_STATUS_POLL_INTERVAL_MS, DEFAULT_SUCCESS_GAP_MS } from './payhero-config';

export type PollingOptions = {
  intervalMs?: number;
  requiredConsecutiveSuccesses?: number;
  onSuccess?: (data: any) => void;
  onError?: (err: any) => void;
};

export function usePaymentPolling(reference: string | null, opts?: PollingOptions) {
  const intervalMs = opts?.intervalMs || DEFAULT_STATUS_POLL_INTERVAL_MS;
  const required = opts?.requiredConsecutiveSuccesses || 2;
  const onSuccess = opts?.onSuccess;
  const onError = opts?.onError;

  const [status, setStatus] = useState<'idle' | 'pending' | 'success' | 'failed'>('idle');
  const runningRef = useRef(false);
  const consecutiveRef = useRef(0);
  const lastSuccessAtRef = useRef(0);

  useEffect(() => {
    if (!reference) return;
    runningRef.current = true;
    setStatus('pending');
    const t = setInterval(async () => {
      if (!runningRef.current) return;
      try {
        const r = await checkPaymentStatus(reference);
        if (r.success) {
          const now = Date.now();
          if (lastSuccessAtRef.current && (now - lastSuccessAtRef.current) >= DEFAULT_SUCCESS_GAP_MS) {
            consecutiveRef.current += 1;
          } else {
            consecutiveRef.current = 1;
          }
          lastSuccessAtRef.current = now;
          if (consecutiveRef.current >= required) {
            runningRef.current = false;
            setStatus('success');
            onSuccess && onSuccess(r);
            clearInterval(t);
          }
        } else {
          // If provider explicitly returned failure status text
          if (r.status && !['pending', 'unknown'].includes(String(r.status).toLowerCase())) {
            runningRef.current = false;
            setStatus('failed');
            onError && onError(r);
            clearInterval(t);
          }
        }
      } catch (err) {
        // ignore transient errors
        console.debug('poll error', err);
      }
    }, intervalMs);

    return () => { runningRef.current = false; clearInterval(t); };
  }, [reference]);

  return { status };
}

export default usePaymentPolling;
