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
    <div className="relative w-full h-[75vh] md:h-[88vh] overflow-hidden">
      {/* Background Slides */}
      {heroItems.map((slide, idx) => {
        const bannerSrc = proxyImage(slide.bannerUrl || slide.posterUrl || "");
        return (
          <div
            key={slide.id}
            className={`hero-slide ${idx === activeIndex ? "active" : "inactive"}`}
          >
            {bannerSrc && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={bannerSrc}
                alt=""
                className="absolute inset-0 w-full h-full object-cover"
                referrerPolicy="no-referrer"
              />
            )}
            {!bannerSrc && (
              <div className="absolute inset-0 bg-gradient-to-br from-[var(--bg-secondary)] to-[var(--bg-primary)]" />
            )}
          </div>
        );
      })}

      {/* Gradient Overlays */}
      <div className="absolute inset-0 bg-gradient-to-t from-[var(--bg-primary)] via-[var(--bg-primary)]/50 to-transparent z-[2]" />
      <div className="absolute inset-0 bg-gradient-to-r from-[var(--bg-primary)]/90 via-[var(--bg-primary)]/30 to-transparent z-[2]" />

      {/* Content */}
      <div className="absolute bottom-0 left-0 right-0 p-8 md:p-14 lg:p-20 z-[3] flex justify-between items-end">
        <div className="max-w-3xl animate-fade-in-up" key={item.id}>
          {/* Badges */}
          <div className="flex flex-wrap items-center gap-3 mb-4">
            {item.rating > 0 && (
              <span className="flex items-center gap-1.5 bg-black/50 backdrop-blur-md border border-white/10 rounded-full px-3 py-1 text-sm font-bold text-[var(--accent-primary)]">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                  <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                </svg>
                {item.rating.toFixed(1)}
              </span>
            )}
            {item.type && (
              <span className="bg-white/10 backdrop-blur-md border border-white/10 rounded-full px-3 py-1 text-sm font-bold text-white">
                {item.type === "tv" ? "Series" : item.type === "movie" ? "Movie" : "Anime"}
              </span>
            )}
            {item.releaseYear > 0 && (
              <span className="text-sm font-medium text-[var(--text-secondary)]">
                {item.releaseYear}
              </span>
            )}
          </div>

          {/* Genres */}
          {item.genres && item.genres.length > 0 && (
            <div className="flex flex-wrap gap-2 mb-3">
              {item.genres.slice(0, 3).map((genre) => (
                <span
                  key={genre}
                  className="text-xs text-[var(--text-secondary)] font-medium"
                >
                  {genre}
                </span>
              ))}
            </div>
          )}

          {/* Title */}
          <h1
            className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-extrabold mb-5 leading-[1.05] tracking-tight drop-shadow-2xl"
            style={{ fontFamily: "var(--font-space)" }}
          >
            {item.title}
          </h1>

          {/* Synopsis */}
          <p className="text-sm md:text-base text-[var(--text-secondary)] mb-8 max-w-2xl leading-relaxed line-clamp-3">
            {item.synopsis}
          </p>

          {/* CTA Buttons */}
          <div className="flex flex-wrap items-center gap-3">
            <Link
              href={`/watch/${item.type}/${item.id}`}
              className="bg-[var(--accent-primary)] hover:bg-[var(--accent-hover)] text-black font-black uppercase tracking-wider text-sm md:text-base px-8 py-3.5 rounded-lg flex items-center gap-2.5 transition-all shadow-[0_0_20px_var(--accent-glow)] hover:shadow-[0_0_30px_var(--accent-glow)] hover:scale-[1.03] active:scale-[0.98]"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                <polygon points="5 3 19 12 5 21 5 3" />
              </svg>
              Play
            </Link>
            <Link
              href={`/details/${item.type}/${item.id}`}
              className="border border-white/20 hover:border-white/40 text-white font-bold text-sm md:text-base px-8 py-3.5 rounded-lg flex items-center gap-2.5 transition-all bg-white/5 backdrop-blur-md hover:bg-white/10"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" />
                <path d="M12 16v-4" />
                <path d="M12 8h.01" />
              </svg>
              More Info
            </Link>
          </div>
        </div>

        {/* Right side: Navigation Controls */}
        <div className="hidden lg:flex flex-col items-end gap-6">
          {/* Arrows */}
          <div className="flex gap-2">
            <button
              onClick={goPrev}
              className="w-11 h-11 rounded-lg bg-black/40 backdrop-blur-md border border-white/10 flex items-center justify-center hover:bg-[var(--accent-primary)] hover:text-black hover:border-transparent transition-all duration-200"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="m15 18-6-6 6-6" />
              </svg>
            </button>
            <button
              onClick={goNext}
              className="w-11 h-11 rounded-lg bg-black/40 backdrop-blur-md border border-white/10 flex items-center justify-center hover:bg-[var(--accent-primary)] hover:text-black hover:border-transparent transition-all duration-200"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="m9 18 6-6-6-6" />
              </svg>
            </button>
          </div>

          {/* Slide Indicators */}
          <div className="flex items-center gap-2">
            {heroItems.map((_, i) => (
              <button
                key={i}
                onClick={() => goToSlide(i)}
                className={`h-1.5 rounded-full transition-all duration-500 ${
                  i === activeIndex
                    ? "w-10 bg-[var(--accent-primary)] shadow-[0_0_8px_var(--accent-glow)]"
                    : "w-2.5 bg-white/20 hover:bg-white/40"
                }`}
                aria-label={`Go to slide ${i + 1}`}
              />
            ))}
          </div>

          {/* Slide Counter */}
          <div className="text-sm font-mono text-[var(--text-muted)]">
            <span className="text-white font-bold">{String(activeIndex + 1).padStart(2, "0")}</span>
            <span className="mx-1">/</span>
            <span>{String(heroItems.length).padStart(2, "0")}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
