"use client";

import React, { useState, useEffect } from "react";
import { usePathname } from "next/navigation";

export default function MobileAppPromoFab() {
  const pathname = usePathname();
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const dismissed = localStorage.getItem("pureverse_fab_promo_dismissed");
    if (!dismissed) {
      // Delay it so it gracefully pops in after the page loads
      const timer = setTimeout(() => setIsVisible(true), 2500);
      return () => clearTimeout(timer);
    }
  }, []);

  const handleDismiss = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsVisible(false);
    localStorage.setItem("pureverse_fab_promo_dismissed", "true");
  };

  // Hide in party mode because chat takes full screen
  if (pathname.startsWith("/party/") && pathname.length > 7) return null;
  if (!isVisible) return null;

  return (
    <div className="fixed z-[60] bottom-[76px] left-1/2 -translate-x-1/2 lg:hidden animate-fade-in-up">
      <div className="flex items-center gap-2 p-1.5 pr-2 bg-[rgba(9,9,12,0.85)] backdrop-blur-2xl backdrop-saturate-150 border border-white/10 rounded-full shadow-[0_12px_40px_rgba(0,0,0,0.6)]">
        <a 
          href="https://github.com/Maazhussain786/PureVerse/releases/latest/download/PureVerse.apk" 
          download
          className="flex items-center gap-2 px-4 py-2 bg-[var(--accent-primary)] text-black font-bold text-xs rounded-full hover:scale-105 transition-transform"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
            <polyline points="7 10 12 15 17 10" />
            <line x1="12" y1="15" x2="12" y2="3" />
          </svg>
          Install App
        </a>
        <button 
          onClick={handleDismiss} 
          className="p-1.5 text-[var(--text-muted)] hover:text-white rounded-full transition-colors bg-white/5 hover:bg-white/10"
          aria-label="Close"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      </div>
    </div>
  );
}
