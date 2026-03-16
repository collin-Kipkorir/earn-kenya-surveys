import { useState, useEffect } from 'react';
import { X, ExternalLink } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface AdBannerProps {
  show: boolean;
  onDismiss: () => void;
}

export default function AdBanner({ show, onDismiss }: AdBannerProps) {
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
                href="https://uwezo-funds.vercel.app/"
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
