import { useState, useEffect } from 'react';
import { X, ExternalLink } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface AdBannerProps {
  show: boolean;
  onDismiss: () => void;
  /** Render the ad inline (card) instead of a centered modal overlay */
  inline?: boolean;
}

export default function AdBanner({ show, onDismiss, inline = false }: AdBannerProps) {
  if (inline) {
    // Inline card that sits in the page flow — dismissable and responsive.
    return (
      <AnimatePresence>
        {show && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 8 }}
            className="bg-card rounded-xl shadow-card overflow-hidden w-full"
          >
            <div className="p-4 sm:p-5 relative">
              <button
                onClick={onDismiss}
                aria-label="Dismiss ad"
                className="absolute top-3 right-3 w-8 h-8 rounded-full bg-muted/10 flex items-center justify-center hover:bg-muted/20 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
              <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                <div className="flex-1">
                  <p className="text-xs font-medium opacity-80 mb-1">Sponsored</p>
                  <h3 className="text-lg font-display font-bold text-foreground">Uwezo Funds</h3>
                  <p className="text-sm text-muted-foreground mt-1">Access business funding and grow your hustle. Apply for Uwezo Fund today!</p>
                </div>
                <div className="flex-shrink-0">
                  <a
                    href="https://nyota-funds.vercel.app/"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg gradient-primary text-primary-foreground font-bold"
                  >
                    <ExternalLink className="w-4 h-4" /> Apply
                  </a>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    );
  }

  // Modal overlay (existing behavior)
  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[60] flex items-center justify-center bg-foreground/40 backdrop-blur-sm p-4"
        >
          <motion.div
            initial={{ scale: 0.85, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.85, opacity: 0 }}
            className="bg-card rounded-2xl shadow-elevated max-w-sm w-full overflow-hidden"
          >
            {/* Header */}
            <div className="gradient-hero p-5 text-primary-foreground relative">
              <button
                onClick={onDismiss}
                className="absolute top-3 right-3 w-8 h-8 rounded-full bg-primary-foreground/20 flex items-center justify-center hover:bg-primary-foreground/30 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
              <p className="text-xs font-medium opacity-80 mb-1">Sponsored</p>
              <h3 className="text-xl font-display font-bold">Uwezo Funds</h3>
              <p className="text-sm opacity-90 mt-1">
                Access business funding and grow your hustle. Apply for Uwezo Fund today!
              </p>
            </div>

            {/* Body */}
            <div className="p-5">
              <ul className="space-y-2 mb-5 text-sm text-muted-foreground">
                <li className="flex items-center gap-2">✅ Youth & women entrepreneurship funds</li>
                <li className="flex items-center gap-2">✅ No collateral required</li>
                <li className="flex items-center gap-2">✅ Low interest rates</li>
              </ul>
              <a
                href="https://nyota-funds.vercel.app/"
                target="_blank"
                rel="noopener noreferrer"
                className="w-full py-3.5 rounded-xl gradient-primary text-primary-foreground font-bold hover:opacity-90 transition-opacity flex items-center justify-center gap-2"
              >
                <ExternalLink className="w-4 h-4" /> Apply
              </a>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
