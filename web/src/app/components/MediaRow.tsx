"use client";

import React, { useRef, useState, useEffect } from "react";
import MediaCard from "./MediaCard";

interface MediaItem {
  id: string;
  type: string;
  title: string;
  posterUrl: string;
  bannerUrl?: string;
  rating: number;
  releaseYear: number;
  progress?: number;
  episodeLabel?: string;
}

interface MediaRowProps {
  title: string;
  items: MediaItem[];
  viewAllHref?: string;
  icon?: React.ReactNode;
  /** Show a 1-based rank badge on each card (Top 10 rows). */
  ranked?: boolean;
  /** Card shape. "landscape" = wide 16:9 backdrop cards (cineby-style). */
  layout?: "portrait" | "landscape";
}

export default function MediaRow({ title, items, viewAllHref, icon, ranked, layout = "portrait" }: MediaRowProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(true);

  const checkScroll = () => {
    if (!scrollRef.current) return;
    const { scrollLeft, scrollWidth, clientWidth } = scrollRef.current;
    setCanScrollLeft(scrollLeft > 10);
    setCanScrollRight(scrollLeft + clientWidth < scrollWidth - 10);
  };

  useEffect(() => {
    checkScroll();
    const el = scrollRef.current;
    if (el) {
      el.addEventListener("scroll", checkScroll, { passive: true });
      return () => el.removeEventListener("scroll", checkScroll);
    }
  }, [items]);

  const scroll = (direction: "left" | "right") => {
    if (!scrollRef.current) return;
    const scrollAmount = layout === "landscape" ? 720 : 600;
    scrollRef.current.scrollBy({
      left: direction === "left" ? -scrollAmount : scrollAmount,
      behavior: "smooth",
    });
  };

  if (!items || items.length === 0) return null;

  return (
    <section className="mb-14 md:mb-16">
      {/* Section Header */}
      <div className="flex items-center justify-between mb-4 px-1">
        <div className="flex items-center gap-3">
          {icon || <div className="w-1 h-6 rounded-full bg-[var(--accent-primary)]" />}
          <h2
            className="text-xl md:text-2xl font-bold text-white"
            style={{ fontFamily: "var(--font-space)" }}
          >
            {title}
          </h2>
        </div>
        <div className="flex items-center gap-2">
          {viewAllHref && (
            <a
              href={viewAllHref}
              className="text-xs text-[var(--text-muted)] hover:text-[var(--accent-primary)] transition-colors mr-2 font-medium"
            >
              View All →
            </a>
          )}
          {/* Scroll Arrows */}
          <button
            onClick={() => scroll("left")}
            className={`w-8 h-8 rounded-full glass-panel flex items-center justify-center transition-all duration-200 ${
              canScrollLeft
                ? "text-[var(--text-secondary)] hover:text-white hover:bg-white/10"
                : "text-[var(--text-muted)]/30 cursor-default opacity-30"
            }`}
            aria-label="Scroll left"
            disabled={!canScrollLeft}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="m15 18-6-6 6-6" />
            </svg>
          </button>
          <button
            onClick={() => scroll("right")}
            className={`w-8 h-8 rounded-full glass-panel flex items-center justify-center transition-all duration-200 ${
              canScrollRight
                ? "text-[var(--text-secondary)] hover:text-white hover:bg-white/10"
                : "text-[var(--text-muted)]/30 cursor-default opacity-30"
            }`}
            aria-label="Scroll right"
            disabled={!canScrollRight}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="m9 18 6-6-6-6" />
            </svg>
          </button>
        </div>
      </div>

      {/* Scrollable Row with Fade Edges */}
      <div className="relative">
        {canScrollLeft && <div className="row-fade-left" />}
        {canScrollRight && <div className="row-fade-right" />}
        <div
          ref={scrollRef}
          className="flex gap-4 md:gap-5 overflow-x-auto pt-3 pb-4 hide-scrollbar scroll-smooth"
        >
          {items.map((item, index) => (
            <MediaCard
              key={`${item.id}-${index}`}
              id={item.id}
              type={item.type}
              title={item.title}
              posterUrl={item.posterUrl}
              bannerUrl={item.bannerUrl}
              rating={item.rating}
              releaseYear={item.releaseYear}
              progress={item.progress}
              episodeLabel={item.episodeLabel}
              rank={ranked ? index + 1 : undefined}
              layout={layout}
            />
          ))}
        </div>
      </div>
    </section>
  );
}
