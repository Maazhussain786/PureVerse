import React from "react";
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
  item: HeroItem;
}

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000/api";

/** Route MAL images through backend proxy */
function proxyImage(url: string): string {
  if (!url) return "";
  if (url.includes("myanimelist.net")) {
    return `${API_BASE}/proxy/image?url=${encodeURIComponent(url)}`;
  }
  return url;
}

export default function HeroSection({ item }: HeroSectionProps) {
  const bannerSrc = proxyImage(item.bannerUrl || item.posterUrl || "");

  return (
    <div className="relative w-full h-[70vh] md:h-[80vh] overflow-hidden">
      {/* Background Image */}
      {bannerSrc ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={bannerSrc}
          alt=""
          className="absolute inset-0 w-full h-full object-cover scale-105"
          referrerPolicy="no-referrer"
        />
      ) : (
        <div className="absolute inset-0 bg-gradient-to-br from-[var(--bg-secondary)] to-[var(--bg-primary)]" />
      )}

      {/* Multi-layer gradient overlays */}
      <div className="absolute inset-0 bg-gradient-to-t from-[var(--bg-primary)] via-[var(--bg-primary)]/50 to-transparent" />
      <div className="absolute inset-0 bg-gradient-to-r from-[var(--bg-primary)]/80 via-transparent to-transparent" />
      <div className="absolute inset-0 bg-[var(--bg-primary)]/20" />

      {/* Content */}
      <div className="absolute bottom-0 left-0 right-0 p-8 md:p-14 lg:p-20">
        <div className="max-w-3xl animate-fade-in-up">
          {/* Badges */}
          <div className="flex flex-wrap items-center gap-2 mb-4 stagger-children">
            {item.type && (
              <span className="glass-panel text-xs font-semibold px-3 py-1.5 rounded-full uppercase tracking-wider text-white/90">
                {item.type === "tv" ? "Series" : item.type}
              </span>
            )}
            {item.rating > 0 && (
              <span className="glass-panel text-xs font-semibold px-3 py-1.5 rounded-full flex items-center gap-1.5">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="#facc15" className="drop-shadow-sm">
                  <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                </svg>
                <span className="text-yellow-300">{item.rating.toFixed(1)}</span>
              </span>
            )}
            {item.releaseYear > 0 && (
              <span className="glass-panel text-xs font-medium px-3 py-1.5 rounded-full text-white/70">
                {item.releaseYear}
              </span>
            )}
          </div>

          {/* Title */}
          <h1
            className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-bold mb-5 leading-[1.1] tracking-tight drop-shadow-2xl"
            style={{ fontFamily: "var(--font-space)" }}
          >
            {item.title}
          </h1>

          {/* Genres */}
          {item.genres && item.genres.length > 0 && (
            <div className="flex flex-wrap gap-2 mb-4">
              {item.genres.slice(0, 4).map((genre) => (
                <span
                  key={genre}
                  className="text-xs text-[var(--text-secondary)] border border-white/10 rounded-full px-3 py-1"
                >
                  {genre}
                </span>
              ))}
            </div>
          )}

          {/* Synopsis */}
          <p className="text-sm md:text-base text-[var(--text-secondary)] mb-8 max-w-2xl leading-relaxed line-clamp-3">
            {item.synopsis}
          </p>

          {/* CTA Buttons */}
          <div className="flex flex-wrap items-center gap-4">
            <Link
              href={`/watch/${item.type}/${item.id}`}
              className="btn-primary text-base md:text-lg px-8 md:px-10 py-3.5 md:py-4"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                <polygon points="5 3 19 12 5 21 5 3" />
              </svg>
              Watch Now
            </Link>
            <Link
              href={`/details/${item.type}/${item.id}`}
              className="btn-glass text-sm md:text-base"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10" />
                <path d="M12 16v-4" />
                <path d="M12 8h.01" />
              </svg>
              Details
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
