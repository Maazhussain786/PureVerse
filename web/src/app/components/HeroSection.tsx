"use client";

import React, { useState, useEffect, useCallback } from "react";
import Link from "next/link";

interface HeroItem {
  id: string;
  type: string;
  title: string;
  synopsis: string;
  bannerUrl: string;
  posterUrl?: string;
  rating: number;
  releaseYear: number;
  genres?: string[];
}

interface HeroSectionProps {
  items: HeroItem[];
}

/** Route MAL images through Next.js proxy */
function proxyImage(url: string): string {
  if (!url) return "";
  if (url.includes("myanimelist.net")) {
    return `/api/proxy/image?url=${encodeURIComponent(url)}`;
  }
  return url;
}

function typeLabel(type: string): string {
  if (type === "tv") return "Series";
  if (type === "movie") return "Movie";
  if (type === "anime") return "Anime";
  return type;
}

export default function HeroSection({ items }: HeroSectionProps) {
  const heroItems = items.slice(0, 5);
  const [activeIndex, setActiveIndex] = useState(0);
  const [isTransitioning, setIsTransitioning] = useState(false);

  const goToSlide = useCallback(
    (index: number) => {
      if (isTransitioning) return;
      setIsTransitioning(true);
      setActiveIndex(index);
      setTimeout(() => setIsTransitioning(false), 800);
    },
    [isTransitioning]
  );

  const goNext = useCallback(() => {
    goToSlide((activeIndex + 1) % heroItems.length);
  }, [activeIndex, heroItems.length, goToSlide]);

  const goPrev = useCallback(() => {
    goToSlide((activeIndex - 1 + heroItems.length) % heroItems.length);
  }, [activeIndex, heroItems.length, goToSlide]);

  // Auto-advance every 8 seconds
  useEffect(() => {
    const timer = setInterval(goNext, 8000);
    return () => clearInterval(timer);
  }, [goNext]);

  if (heroItems.length === 0) return null;

  const item = heroItems[activeIndex];

  return (
    <div className="relative w-full h-[85vh] md:h-[94vh] overflow-hidden bg-[var(--bg-primary)]">
      {/* ─── Background Slides ─── */}
      {heroItems.map((slide, idx) => {
        const bannerSrc = proxyImage(slide.bannerUrl || slide.posterUrl || "");
        const isActive = idx === activeIndex;
        return (
          <div
            key={slide.id}
            className={`absolute inset-0 transition-opacity duration-[1200ms] ease-in-out ${
              isActive ? "opacity-100 z-[1]" : "opacity-0 z-0"
            }`}
          >
            {bannerSrc ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                // re-mount on activation so the Ken Burns zoom restarts each cycle
                key={isActive ? `active-${idx}-${activeIndex}` : `idle-${idx}`}
                src={bannerSrc}
                alt=""
                className={`absolute inset-0 w-full h-full object-cover object-top ${
                  isActive ? "animate-ken-burns" : ""
                }`}
                referrerPolicy="no-referrer"
              />
            ) : (
              <div className="absolute inset-0 bg-gradient-to-br from-[var(--bg-secondary)] to-[var(--bg-primary)]" />
            )}
          </div>
        );
      })}

      {/* ─── Cinematic Gradient Overlays ─── */}
      {/* bottom fade into page */}
      <div className="absolute inset-0 z-[2] bg-gradient-to-t from-[var(--bg-primary)] via-[var(--bg-primary)]/35 to-transparent" />
      {/* left fade for text legibility */}
      <div className="absolute inset-0 z-[2] bg-gradient-to-r from-[var(--bg-primary)] via-[var(--bg-primary)]/45 to-transparent" />
      {/* subtle top fade so the navbar reads cleanly */}
      <div className="absolute inset-x-0 top-0 h-32 z-[2] bg-gradient-to-b from-black/60 to-transparent" />

      {/* ─── Foreground Content ─── */}
      <div className="absolute inset-0 z-[3] flex items-end">
        <div className="w-full max-w-[1600px] mx-auto px-5 md:px-8 lg:px-16 pb-16 md:pb-24 flex items-end justify-between gap-8">
          {/* Left: Featured details */}
          <div className="max-w-[640px] animate-fade-in-up" key={item.id}>
            {/* Badges */}
            <div className="flex flex-wrap items-center gap-2.5 mb-4">
              <span className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-[0.14em] text-[var(--accent-primary)]">
                <span className="w-5 h-[2px] rounded-full bg-[var(--accent-primary)]" />
                Featured {typeLabel(item.type)}
              </span>
            </div>

            {/* Title */}
            <h1
              className="text-5xl sm:text-6xl md:text-7xl lg:text-[5.5rem] font-extrabold mb-4 leading-[1.0] tracking-tight text-white drop-shadow-[0_4px_30px_rgba(0,0,0,0.85)] line-clamp-2"
              style={{ fontFamily: "var(--font-space)" }}
            >
              {item.title}
            </h1>

            {/* Meta row */}
            <div className="flex flex-wrap items-center gap-x-3 gap-y-2 mb-5 text-sm">
              {item.rating > 0 && (
                <span className="flex items-center gap-1.5 font-bold text-[var(--accent-lime)]">
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor">
                    <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                  </svg>
                  {item.rating.toFixed(1)}
                </span>
              )}
              <span className="px-2 py-0.5 rounded-md bg-white/10 border border-white/10 text-xs font-semibold text-white backdrop-blur-md">
                {typeLabel(item.type)}
              </span>
              {item.releaseYear > 0 && (
                <span className="text-[var(--text-secondary)] font-medium">{item.releaseYear}</span>
              )}
              {item.genres && item.genres.length > 0 && (
                <span className="hidden sm:flex items-center gap-2 text-[var(--text-secondary)] font-medium">
                  {item.genres.slice(0, 3).map((g, i) => (
                    <React.Fragment key={g}>
                      {i > 0 && <span className="w-1 h-1 rounded-full bg-[var(--text-muted)]" />}
                      <span>{g}</span>
                    </React.Fragment>
                  ))}
                </span>
              )}
            </div>

            {/* Synopsis */}
            <p className="text-sm md:text-base text-[var(--text-secondary)] mb-7 max-w-xl leading-relaxed line-clamp-3">
              {item.synopsis}
            </p>

            {/* CTA Buttons — large & cinematic (56px) */}
            <div className="flex flex-wrap items-center gap-3.5">
              <Link
                href={`/watch/${item.type}/${item.id}`}
                className="whitespace-nowrap h-14 bg-[var(--accent-primary)] hover:bg-[var(--accent-hover)] text-black font-bold text-base md:text-lg px-8 md:px-10 rounded-full inline-flex items-center gap-2.5 transition-all shadow-[0_0_28px_var(--accent-glow)] hover:shadow-[0_0_44px_var(--accent-glow)] hover:scale-[1.03] active:scale-[0.98]"
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                  <polygon points="5 3 19 12 5 21 5 3" />
                </svg>
                Play Now
              </Link>
              <Link
                href={`/details/${item.type}/${item.id}`}
                className="whitespace-nowrap h-14 border border-white/20 hover:border-white/40 text-white font-semibold text-base md:text-lg px-8 rounded-full inline-flex items-center gap-2.5 transition-all bg-white/5 backdrop-blur-md hover:bg-white/10"
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10" />
                  <path d="M12 16v-4" />
                  <path d="M12 8h.01" />
                </svg>
                More Info
              </Link>
            </div>
          </div>

          {/* Right: "Up Next" floating glass panel (desktop) */}
          <div className="hidden lg:block glass-panel rounded-2xl p-4 pb-3 shadow-[0_8px_40px_rgba(0,0,0,0.5)]">
            <div className="flex items-center justify-between gap-6 mb-3 px-1">
              <span className="text-xs font-bold uppercase tracking-[0.16em] text-white/90">
                Up Next
              </span>
              <span className="text-xs font-mono text-[var(--text-muted)]">
                <span className="text-[var(--accent-primary)] font-bold">{String(activeIndex + 1).padStart(2, "0")}</span>
                <span className="mx-0.5">/</span>
                {String(heroItems.length).padStart(2, "0")}
              </span>
            </div>
            <div className="flex gap-3">
              {heroItems.map((slide, i) => {
                const posterSrc = proxyImage(slide.posterUrl || slide.bannerUrl || "");
                const active = i === activeIndex;
                return (
                  <button
                    key={slide.id}
                    onClick={() => goToSlide(i)}
                    aria-label={`Show ${slide.title}`}
                    className={`relative w-[68px] h-[102px] rounded-lg overflow-hidden transition-all duration-300 ${
                      active
                        ? "ring-2 ring-[var(--accent-primary)] shadow-[0_0_18px_var(--accent-glow)] scale-[1.04]"
                        : "ring-1 ring-white/10 opacity-55 hover:opacity-100 hover:scale-[1.04]"
                    }`}
                  >
                    {posterSrc ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={posterSrc} alt="" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                    ) : (
                      <div className="w-full h-full bg-[var(--bg-card)]" />
                    )}
                    {/* active progress bar (auto-advance timer cue) */}
                    {active && (
                      <span className="absolute bottom-0 left-0 right-0 h-1 bg-[var(--accent-primary)] shadow-[0_0_8px_var(--accent-glow)]" />
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* ─── Progress Dots (mobile / bottom-left) ─── */}
      <div className="absolute bottom-6 left-5 md:left-10 lg:hidden z-[4] flex items-center gap-2">
        {heroItems.map((_, i) => (
          <button
            key={i}
            onClick={() => goToSlide(i)}
            className={`h-1.5 rounded-full transition-all duration-500 ${
              i === activeIndex
                ? "w-8 bg-[var(--accent-primary)] shadow-[0_0_8px_var(--accent-glow)]"
                : "w-2 bg-white/25 hover:bg-white/40"
            }`}
            aria-label={`Go to slide ${i + 1}`}
          />
        ))}
      </div>

      {/* ─── Prev / Next Arrows (desktop) ─── */}
      <button
        onClick={goPrev}
        aria-label="Previous"
        className="hidden md:flex absolute left-4 top-1/2 -translate-y-1/2 z-[4] w-11 h-11 rounded-full bg-black/30 backdrop-blur-md border border-white/10 items-center justify-center text-white/80 hover:bg-[var(--accent-primary)] hover:text-black hover:border-transparent transition-all duration-200"
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="m15 18-6-6 6-6" />
        </svg>
      </button>
      <button
        onClick={goNext}
        aria-label="Next"
        className="hidden md:flex absolute right-4 top-1/2 -translate-y-1/2 z-[4] w-11 h-11 rounded-full bg-black/30 backdrop-blur-md border border-white/10 items-center justify-center text-white/80 hover:bg-[var(--accent-primary)] hover:text-black hover:border-transparent transition-all duration-200"
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="m9 18 6-6-6-6" />
        </svg>
      </button>
    </div>
  );
}
