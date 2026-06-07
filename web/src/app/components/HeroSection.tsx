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

/** Route MAL images through Next.js proxy */
function proxyImage(url: string): string {
  if (!url) return "";
  if (url.includes("myanimelist.net")) {
    return `/api/proxy/image?url=${encodeURIComponent(url)}`;
  }
  return url;
}

export default function HeroSection({ item }: HeroSectionProps) {
  const bannerSrc = proxyImage(item.bannerUrl || item.posterUrl || "");

  return (
    <div className="relative w-full h-[70vh] md:h-[85vh] overflow-hidden">
      {/* Background Image */}
      {bannerSrc ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={bannerSrc}
          alt=""
          className="absolute inset-0 w-full h-full object-cover"
          referrerPolicy="no-referrer"
        />
      ) : (
        <div className="absolute inset-0 bg-gradient-to-br from-[var(--bg-secondary)] to-[var(--bg-primary)]" />
      )}

      {/* Re:ANIME+ style gradients */}
      <div className="absolute inset-0 bg-gradient-to-t from-[var(--bg-primary)] via-[var(--bg-primary)]/40 to-transparent" />
      <div className="absolute inset-0 bg-gradient-to-r from-[var(--bg-primary)]/90 via-[var(--bg-primary)]/40 to-transparent" />

      {/* Content */}
      <div className="absolute bottom-0 left-0 right-0 p-8 md:p-14 lg:p-20 flex justify-between items-end">
        <div className="max-w-3xl animate-fade-in-up">
          {/* Badges (Star, Type, Year) */}
          <div className="flex flex-wrap items-center gap-3 mb-4 font-bold tracking-wide text-sm">
            {item.rating > 0 && (
              <span className="flex items-center gap-1.5 text-[var(--accent-primary)] drop-shadow-[0_0_8px_var(--accent-glow)]">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                  <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                </svg>
                {item.rating.toFixed(1)}
              </span>
            )}
            {item.type && (
              <span className="text-[var(--text-primary)]">
                {item.type === "tv" ? "TV" : item.type.toUpperCase()}
              </span>
            )}
            {item.releaseYear > 0 && (
              <span className="text-[var(--text-secondary)]">
                {item.releaseYear}
              </span>
            )}
          </div>

          {/* Title */}
          <h1
            className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-extrabold mb-5 leading-[1.1] tracking-tight drop-shadow-2xl"
          >
            {item.title}
          </h1>

          {/* Synopsis */}
          <p className="text-sm md:text-base text-[var(--text-secondary)] mb-8 max-w-2xl leading-relaxed line-clamp-3">
            {item.synopsis}
          </p>

          {/* CTA Buttons */}
          <div className="flex flex-wrap items-center gap-4">
            <Link
              href={`/watch/${item.type}/${item.id}`}
              className="bg-[var(--accent-primary)] hover:bg-[var(--accent-hover)] text-black font-black uppercase tracking-wider text-sm md:text-base px-8 py-3.5 rounded flex items-center gap-2 transition-all shadow-[0_0_20px_var(--accent-glow)] hover:scale-105"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                <polygon points="5 3 19 12 5 21 5 3" />
              </svg>
              Watch Now
            </Link>
            <Link
              href={`/details/${item.type}/${item.id}`}
              className="border-2 border-white/20 hover:border-white/50 text-white font-bold uppercase tracking-wider text-sm md:text-base px-8 py-3.5 rounded flex items-center gap-2 transition-all bg-black/20 backdrop-blur-sm hover:bg-white/10"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" />
                <path d="M12 16v-4" />
                <path d="M12 8h.01" />
              </svg>
              Details
            </Link>
          </div>
        </div>

        {/* Right side controls (Arrows + Dots) */}
        <div className="hidden lg:flex flex-col items-end justify-between h-[300px]">
          {/* Arrows */}
          <div className="flex gap-2 mb-auto">
            <button className="w-10 h-10 rounded bg-black/40 border border-white/10 flex items-center justify-center hover:bg-[var(--accent-primary)] hover:text-black hover:border-transparent transition-colors">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="m15 18-6-6 6-6" />
              </svg>
            </button>
            <button className="w-10 h-10 rounded bg-black/40 border border-white/10 flex items-center justify-center hover:bg-[var(--accent-primary)] hover:text-black hover:border-transparent transition-colors">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="m9 18 6-6-6-6" />
              </svg>
            </button>
          </div>

          {/* Dots */}
          <div className="flex items-center gap-2 mt-auto">
            {[...Array(6)].map((_, i) => (
              <div
                key={i}
                className={`h-1.5 rounded-full transition-all duration-300 ${
                  i === 0 ? "w-8 bg-[var(--accent-primary)]" : "w-2 bg-white/20"
                }`}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
