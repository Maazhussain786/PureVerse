"use client";

import React, { useRef } from "react";
import MediaCard from "./MediaCard";

interface MediaItem {
  id: string;
  type: string;
  title: string;
  posterUrl: string;
  rating: number;
  releaseYear: number;
}

interface MediaRowProps {
  title: string;
  items: MediaItem[];
  viewAllHref?: string;
  icon?: React.ReactNode;
}

export default function MediaRow({ title, items, viewAllHref, icon }: MediaRowProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  const scroll = (direction: "left" | "right") => {
    if (!scrollRef.current) return;
    const scrollAmount = 600;
    scrollRef.current.scrollBy({
      left: direction === "left" ? -scrollAmount : scrollAmount,
      behavior: "smooth",
    });
  };

  if (!items || items.length === 0) return null;

  return (
    <section className="mb-12">
      {/* Section Header */}
      <div className="flex items-center justify-between mb-5 px-1">
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
              className="text-xs text-[var(--text-muted)] hover:text-[var(--accent-primary)] transition-colors mr-2"
            >
              View All →
            </a>
          )}
          {/* Scroll Arrows */}
          <button
            onClick={() => scroll("left")}
            className="w-8 h-8 rounded-full glass-panel flex items-center justify-center text-[var(--text-secondary)] hover:text-white hover:bg-white/10 transition-all duration-200"
            aria-label="Scroll left"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="m15 18-6-6 6-6" />
            </svg>
          </button>
          <button
            onClick={() => scroll("right")}
            className="w-8 h-8 rounded-full glass-panel flex items-center justify-center text-[var(--text-secondary)] hover:text-white hover:bg-white/10 transition-all duration-200"
            aria-label="Scroll right"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="m9 18 6-6-6-6" />
            </svg>
          </button>
        </div>
      </div>

      {/* Scrollable Row */}
      <div
        ref={scrollRef}
        className="flex gap-4 md:gap-5 overflow-x-auto pb-4 hide-scrollbar scroll-smooth"
      >
        {items.map((item, index) => (
          <MediaCard
            key={`${item.id}-${index}`}
            id={item.id}
            type={item.type}
            title={item.title}
            posterUrl={item.posterUrl}
            rating={item.rating}
            releaseYear={item.releaseYear}
          />
        ))}
      </div>
    </section>
  );
}
