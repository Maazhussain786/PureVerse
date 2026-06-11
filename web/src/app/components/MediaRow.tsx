"use client";

import React, { useRef, useState, useEffect } from "react";
import MediaCard from "./MediaCard";
import useDragScroll from "../hooks/useDragScroll";

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
  href?: string; // custom destination (e.g. resume playback)
  onRemove?: () => void; // X button (continue watching / my list rows)
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
  useDragScroll(scrollRef);

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
    <section className="group/row" style={{ marginBottom: "var(--space-section)" }}>
      {/* Section Header */}
      <div className="flex items-center justify-between px-1" style={{ marginBottom: "var(--space-title-to-content)" }}>
        <div className="flex items-center gap-3">
          {icon || <div className="w-1.5 h-7 rounded-full bg-[var(--accent-primary)] shadow-[0_0_10px_var(--accent-glow)]" />}
          <h2
            className="text-xl md:text-[28px] font-bold text-white tracking-tight"
            style={{ fontFamily: "var(--font-space)" }}
          >
            {title}
          </h2>
        </div>
        {viewAllHref && (
          <a
            href={viewAllHref}
            className="group/all flex items-center gap-1.5 text-xs font-semibold text-[var(--text-secondary)] hover:text-[var(--accent-primary)] transition-colors mr-1"
          >
            View All
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="transition-transform group-hover/all:translate-x-0.5">
              <path d="m9 18 6-6-6-6" />
            </svg>
          </a>
        )}
      </div>

      {/* Scrollable Row with Fade Edges */}
      <div className="relative">
        {canScrollLeft && <div className="row-fade-left" />}
        {canScrollRight && <div className="row-fade-right" />}

        {/* Netflix-style full-height chevrons — fade in on row hover (desktop) */}
        {canScrollLeft && (
          <button
            onClick={() => scroll("left")}
            aria-label="Scroll left"
            className="hidden md:flex absolute left-0 top-0 bottom-0 z-20 w-12 items-center justify-center bg-gradient-to-r from-[rgba(9,9,12,0.9)] via-[rgba(9,9,12,0.45)] to-transparent opacity-0 group-hover/row:opacity-100 transition-opacity duration-200"
          >
            <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-white drop-shadow-lg transition-transform duration-200 hover:scale-125">
              <path d="m15 18-6-6 6-6" />
            </svg>
          </button>
        )}
        {canScrollRight && (
          <button
            onClick={() => scroll("right")}
            aria-label="Scroll right"
            className="hidden md:flex absolute right-0 top-0 bottom-0 z-20 w-12 items-center justify-center bg-gradient-to-l from-[rgba(9,9,12,0.9)] via-[rgba(9,9,12,0.45)] to-transparent opacity-0 group-hover/row:opacity-100 transition-opacity duration-200"
          >
            <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-white drop-shadow-lg transition-transform duration-200 hover:scale-125">
              <path d="m9 18 6-6-6-6" />
            </svg>
          </button>
        )}

        <div
          ref={scrollRef}
          className="row-scroller drag-scroll flex gap-5 md:gap-7 overflow-x-auto overflow-y-visible hide-scrollbar scroll-smooth"
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
              href={item.href}
              onRemove={item.onRemove}
            />
          ))}
        </div>
      </div>
    </section>
  );
}
