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
    <div className="relative w-full mx-auto px-5 md:px-8 lg:px-16 animate-fade-in-up" style={{ marginBottom: "var(--space-hero-to-section)", marginTop: "24px" }}>
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-[var(--bg-elevated)] via-[rgba(163,230,53,0.1)] to-[var(--bg-elevated)] border border-[var(--accent-primary)]/20 shadow-[0_8px_30px_rgba(163,230,53,0.15)] p-5 md:p-6 flex flex-col md:flex-row items-center justify-between gap-6">
        
        {/* Abstract shapes for background */}
        <div className="absolute -top-24 -left-24 w-48 h-48 bg-[var(--accent-primary)]/20 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-24 -right-24 w-48 h-48 bg-[var(--accent-primary)]/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 flex items-center gap-5 w-full md:w-auto">
          {/* App Icon */}
          <div className="flex-none w-14 h-14 md:w-16 md:h-16 rounded-xl bg-gradient-to-br from-[var(--bg-card)] to-black border border-white/10 flex items-center justify-center shadow-inner overflow-hidden">
             <img src="/logos/Complete_logo.jpg" alt="PureVerse App" className="w-full h-full object-cover opacity-90" />
          </div>
          
          <div>
            <h3 className="text-lg md:text-xl font-bold text-white mb-1 tracking-tight" style={{ fontFamily: "var(--font-space)" }}>
              Experience PureVerse on Android
            </h3>
            <p className="text-sm text-[var(--text-secondary)] max-w-lg leading-relaxed">
              Download our official mobile app for a faster, ad-free streaming experience on the go. Get the latest APK now!
            </p>
          </div>
        </div>

        <div className="relative z-10 flex items-center gap-3 w-full md:w-auto mt-2 md:mt-0">
          <a
            href="https://github.com/Maazhussain786/PureVerse/releases/latest/download/PureVerse.apk"
            download
            className="flex-1 md:flex-none flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-[var(--accent-primary)] text-black font-bold text-sm hover:bg-[var(--accent-hover)] hover:scale-105 hover:shadow-[0_0_20px_var(--accent-glow)] transition-all duration-300"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="7 10 12 15 17 10" />
              <line x1="12" y1="15" x2="12" y2="3" />
            </svg>
            Download APK
          </a>
          
          <button
            onClick={handleDismiss}
            className="p-3 rounded-xl bg-white/5 text-[var(--text-muted)] hover:bg-white/10 hover:text-white transition-colors"
            aria-label="Dismiss banner"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}
