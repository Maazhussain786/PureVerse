"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
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

  // ─── Mouse / touch swipe on the hero itself ───
  const swipeStart = useRef<{ x: number; y: number } | null>(null);
  const suppressClick = useRef(false);

  const onPointerDown = (e: React.PointerEvent) => {
    swipeStart.current = { x: e.clientX, y: e.clientY };
  };
  const onPointerUp = (e: React.PointerEvent) => {
    const start = swipeStart.current;
    swipeStart.current = null;
    if (!start) return;
    const dx = e.clientX - start.x;
    const dy = e.clientY - start.y;
    // horizontal-dominant swipe of 60px+ flips the slide
    if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy) * 1.5) {
      suppressClick.current = true;
      setTimeout(() => (suppressClick.current = false), 250);
      if (dx < 0) goNext();
      else goPrev();
    }
  };
  const onClickCapture = (e: React.MouseEvent) => {
    if (suppressClick.current) {
      e.preventDefault();
      e.stopPropagation();
    }
  };

  if (heroItems.length === 0) return null;

  const item = heroItems[activeIndex];

  return (
    <div
      className="relative w-full h-[85vh] md:h-[94vh] overflow-hidden bg-[var(--bg-primary)] select-none touch-pan-y"
      onPointerDown={onPointerDown}
      onPointerUp={onPointerUp}
      onClickCapture={onClickCapture}
    >
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

      {/* ─── Cinematic Gradient Overlays (lighter — keeps the image alive) ─── */}
      {/* bottom fade into page */}
      <div
        className="absolute inset-0 z-[2]"
        style={{ background: "linear-gradient(to top, var(--bg-primary) 0%, rgba(9,9,12,0.55) 24%, rgba(9,9,12,0) 58%)" }}
      />
      {/* left fade for text legibility — fades out well before mid-frame */}
      <div
        className="absolute inset-0 z-[2]"
        style={{ background: "linear-gradient(to right, rgba(9,9,12,0.92) 0%, rgba(9,9,12,0.4) 38%, rgba(9,9,12,0) 66%)" }}
      />
      {/* gentle top fade so the navbar reads cleanly */}
      <div className="absolute inset-x-0 top-0 h-28 z-[2] bg-gradient-to-b from-black/45 to-transparent" />

      {/* ─── Foreground Content ─── */}
      <style>{`
        @keyframes fillProgress {
          0% { transform: scaleX(0); }
          100% { transform: scaleX(1); }
        }
      `}</style>
      <div className="absolute inset-0 z-[3] flex items-end">
        <div className="w-full max-w-[1600px] mx-auto px-5 sm:px-8 lg:px-16 xl:px-20 pb-14 sm:pb-16 md:pb-24 flex items-end justify-between gap-8">
          {/* Left: Featured details */}
          <div className="w-full max-w-[420px] sm:max-w-[520px] md:max-w-[560px] animate-fade-in-up" key={item.id}>
            {/* Eyebrow */}
            <div className="flex items-center gap-2.5 mb-3 sm:mb-4">
              <span className="flex items-center gap-1.5 text-[11px] sm:text-xs font-bold uppercase tracking-[0.16em] text-[var(--accent-primary)]">
                <span className="w-5 h-[2px] rounded-full bg-[var(--accent-primary)]" />
                Featured {typeLabel(item.type)}
              </span>
            </div>

            {/* Title */}
            <h1
              className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-extrabold mb-4 sm:mb-5 leading-[1.05] tracking-tight text-white drop-shadow-[0_4px_30px_rgba(0,0,0,0.85)] line-clamp-2"
              style={{ fontFamily: "var(--font-space)" }}
            >
              {item.title}
            </h1>

            {/* Trending rank — hero items ARE the top trending, so the rank is real */}
            <div className="flex items-center gap-2.5 mb-4">
              <span
                className="flex flex-col items-center justify-center w-7 h-7 rounded-[5px] bg-[var(--accent-primary)] text-black font-black uppercase leading-none shadow-[0_0_14px_var(--accent-glow)]"
                aria-hidden="true"
              >
                <span className="text-[7px] tracking-wide">Top</span>
                <span className="text-[11px] -mt-px">10</span>
              </span>
              <span className="text-sm sm:text-base font-bold text-white drop-shadow-md">
                #{activeIndex + 1} in Trending Today
              </span>
            </div>

            {/* Meta row */}
            <div className="flex flex-wrap items-center gap-x-3 gap-y-2 mb-5 sm:mb-6 text-sm">
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
            <p className="text-sm md:text-[15px] text-[var(--text-secondary)] mb-7 sm:mb-9 leading-relaxed line-clamp-2 sm:line-clamp-3">
              {item.synopsis}
            </p>

            {/* ─── Premium CTA Buttons ─── */}
            <div className="flex flex-wrap items-center gap-3 md:gap-4 mt-8">
              <Link
                href={`/watch/${item.type}/${item.id}`}
                aria-label={`Watch ${item.title}`}
                className="group/play inline-flex items-center justify-center gap-2 md:gap-2.5 h-10 md:h-[46px] px-6 md:px-8 min-w-[140px] md:min-w-[160px] rounded-md bg-white text-black font-semibold text-[15px] md:text-base shadow-md transition-all hover:bg-white/90 active:scale-[0.98]"
              >
                <svg
                  viewBox="0 0 24 24"
                  fill="currentColor"
                  className="w-5 h-5 md:w-[22px] md:h-[22px] translate-x-[1px] transition-transform duration-300 group-hover/play:scale-110"
                >
                  <polygon points="6 4 20 12 6 20 6 4" />
                </svg>
                <span>Watch Now</span>
              </Link>
              
              <Link
                href={`/details/${item.type}/${item.id}`}
                aria-label={`Details about ${item.title}`}
                className="inline-flex items-center justify-center gap-2 md:gap-2.5 h-10 md:h-[46px] px-6 md:px-8 min-w-[140px] md:min-w-[160px] rounded-md bg-[#6d6d6e]/70 text-white font-semibold text-[15px] md:text-base backdrop-blur-md transition-all hover:bg-[#6d6d6e]/50 active:scale-[0.98]"
              >
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="w-5 h-5 md:w-[20px] md:h-[20px]"
                >
                  <circle cx="12" cy="12" r="10" />
                  <path d="M12 16v-4" />
                  <path d="M12 8h.01" />
                </svg>
                <span>Details</span>
              </Link>
            </div>
          </div>

          {/* Right: "Up Next" floating panel (desktop) */}
          <div className="hidden lg:block relative z-10 animate-fade-in">
            <div className="flex flex-col gap-5 w-max">


              {/* Thumbnails */}
              <div className="flex items-end gap-4 h-[180px]">
                {heroItems.map((slide, i) => {
                  const posterSrc = proxyImage(slide.posterUrl || slide.bannerUrl || "");
                  const active = i === activeIndex;
                  return (
                    <button
                      key={slide.id}
                      onClick={() => goToSlide(i)}
                      aria-label={`Show ${slide.title}`}
                      className={`group relative rounded-2xl overflow-hidden transition-all duration-[800ms] ease-[cubic-bezier(0.2,0.8,0.2,1)] transform-gpu origin-bottom ${
                        active
                          ? "w-[120px] h-[180px] ring-[2.5px] ring-[var(--accent-primary)] shadow-[0_10px_40px_rgba(0,0,0,0.6),0_0_25px_var(--accent-glow)] z-10"
                          : "w-[75px] h-[115px] ring-1 ring-white/10 opacity-60 hover:opacity-100 hover:ring-white/40 hover:-translate-y-2 hover:shadow-xl z-0"
                      }`}
                    >
                      {posterSrc ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img 
                          src={posterSrc} 
                          alt="" 
                          className={`w-full h-full object-cover transition-transform duration-[1.5s] ease-out ${active ? 'scale-100' : 'scale-105 group-hover:scale-110'}`} 
                          referrerPolicy="no-referrer" 
                        />
                      ) : (
                        <div className="w-full h-full bg-[var(--bg-card)]" />
                      )}

                      {/* Dimming for inactive */}
                      {!active && (
                        <div className="absolute inset-0 bg-black/40 group-hover:bg-transparent transition-colors duration-500" />
                      )}

                      {/* Active item styling */}
                      {active && (
                        <>
                          <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent" />
                          <div className="absolute bottom-4 left-0 right-0 px-3 text-center">
                            <span className="block text-[11px] font-bold text-white truncate drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)]">
                              {slide.title}
                            </span>
                          </div>
                          <div className="absolute bottom-0 left-0 right-0 h-1.5 bg-black">
                            <div 
                              key={activeIndex}
                              className="h-full bg-[var(--accent-primary)] shadow-[0_0_12px_var(--accent-glow)]"
                              style={{ 
                                animation: 'fillProgress 8000ms linear forwards',
                                transformOrigin: 'left'
                              }}
                            />
                          </div>
                        </>
                      )}
                    </button>
                  );
                })}
              </div>
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
