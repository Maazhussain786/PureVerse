"use client";

import React, { useState, useEffect } from "react";

export default function AppPromoBanner() {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    // Only show if the user hasn't dismissed it previously
    const dismissed = localStorage.getItem("pureverse_app_promo_dismissed");
    if (!dismissed) {
      // Delay showing it slightly for a nice entrance effect
      const timer = setTimeout(() => setIsVisible(true), 1500);
      return () => clearTimeout(timer);
    }
  }, []);

  const handleDismiss = () => {
    setIsVisible(false);
    localStorage.setItem("pureverse_app_promo_dismissed", "true");
  };

  if (!isVisible) return null;

  return (
    <div className="w-full px-4 sm:px-5 md:px-8 lg:px-16 animate-fade-in-up mb-10 mt-4">
      <div className="relative overflow-hidden flex items-center gap-3 sm:gap-4 p-3 sm:p-4 rounded-2xl bg-[var(--bg-elevated)] border border-white/10 shadow-[0_8px_30px_rgba(0,0,0,0.4)]">
        
        {/* Subtle background glow */}
        <div className="absolute top-0 right-0 w-32 h-32 bg-[var(--accent-primary)]/10 rounded-full blur-3xl pointer-events-none" />

        {/* Dismiss Button */}
        <button
          onClick={handleDismiss}
          className="flex-none p-1 -ml-1 text-[var(--text-muted)] hover:text-white transition-colors"
          aria-label="Dismiss"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>

        {/* App Icon */}
        <div className="flex-none w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-black border border-white/10 overflow-hidden shadow-inner flex items-center justify-center">
          <img src="/logos/Complete_logo.jpg" alt="PureVerse" className="w-full h-full object-cover opacity-90" />
        </div>
        
        {/* Text Info */}
        <div className="flex-1 min-w-0">
          <h3 className="text-[13px] sm:text-[15px] font-bold text-white truncate tracking-tight">
            PureVerse App
          </h3>
          <p className="text-[11px] sm:text-xs text-[var(--text-muted)] truncate">
            Faster streaming, ad-free
          </p>
        </div>

        {/* Install Action */}
        <a
          href="https://github.com/Maazhussain786/PureVerse/releases/latest/download/PureVerse.apk"
          download
          className="flex-none px-4 py-1.5 sm:px-5 sm:py-2 rounded-full bg-[var(--accent-primary)] text-black font-bold text-[11px] sm:text-xs hover:bg-[var(--accent-hover)] hover:scale-105 hover:shadow-[0_4px_15px_rgba(163,230,53,0.3)] transition-all duration-300"
        >
          INSTALL
        </a>
      </div>
    </div>
  );
}
