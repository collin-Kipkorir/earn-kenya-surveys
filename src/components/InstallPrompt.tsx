import { useState, useEffect } from 'react';
import { Download, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export function useInstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalled, setIsInstalled] = useState(false);

  useEffect(() => {
    // Check if already installed
    if (window.matchMedia('(display-mode: standalone)').matches) {
      setIsInstalled(true);
      return;
    }

    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };

    const installedHandler = () => {
      setIsInstalled(true);
      setDeferredPrompt(null);
    };

    window.addEventListener('beforeinstallprompt', handler);
    window.addEventListener('appinstalled', installedHandler);
    return () => {
      window.removeEventListener('beforeinstallprompt', handler);
      window.removeEventListener('appinstalled', installedHandler);
    };
  }, []);

  const install = async () => {
    if (!deferredPrompt) return false;
    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      setIsInstalled(true);
      setDeferredPrompt(null);
    }
    return outcome === 'accepted';
  };

  return { canInstall: !!deferredPrompt && !isInstalled, isInstalled, install };
}

export default function InstallPrompt({ show, onDismiss }: { show: boolean; onDismiss: () => void }) {
  const { canInstall, install } = useInstallPrompt();

  if (!canInstall) return null;

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ y: 100, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 100, opacity: 0 }}
          className="fixed bottom-24 left-4 right-4 z-50 bg-card rounded-2xl shadow-elevated p-4 border border-border"
        >
          <button onClick={onDismiss} className="absolute top-3 right-3 text-muted-foreground hover:text-foreground">
            <X className="w-4 h-4" />
          </button>
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl gradient-primary flex items-center justify-center shrink-0">
              <Download className="w-6 h-6 text-primary-foreground" />
            </div>
            <div className="flex-1">
              <h4 className="font-display font-bold text-foreground text-sm">Install SurveyEarn</h4>
              <p className="text-xs text-muted-foreground">Add to home screen for the best experience</p>
            </div>
            <button
              onClick={async () => {
                await install();
                onDismiss();
              }}
              className="px-4 py-2 rounded-xl gradient-primary text-primary-foreground text-sm font-bold hover:opacity-90 transition-opacity shrink-0"
            >
              Install
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
