import { useState, useEffect, useCallback } from 'react';
import { useInstallPrompt } from '@/components/InstallPrompt';

export function useAdManager() {
  const [showAd, setShowAd] = useState(false);
  const { isInstalled } = useInstallPrompt();

  // Don't show ads if app is installed
  const shouldShowAds = !isInstalled;

  // Timer-based ad: every 60 seconds if surveys exhausted
  useEffect(() => {
    if (!shouldShowAds) return;
    const interval = setInterval(() => {
      setShowAd(true);
    }, 60000);
    return () => clearInterval(interval);
  }, [shouldShowAds]);

  const triggerAd = useCallback(() => {
    if (shouldShowAds) {
      setShowAd(true);
    }
  }, [shouldShowAds]);

  const dismissAd = useCallback(() => {
    setShowAd(false);
  }, []);

  return { showAd, triggerAd, dismissAd, shouldShowAds };
}
