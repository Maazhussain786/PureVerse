"use client";

import React from "react";
import Link from "next/link";

interface SpotlightItem {
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

function proxyImage(url: string): string {
  if (!url) return "";
  if (url.includes("myanimelist.net")) {
    return `/api/proxy/image?url=${encodeURIComponent(url)}`;
  }
  return url;
}

/**
 * Cinematic "Anime Spotlight" feature band — a single highlighted title pulled
 * from real trending-anime data. Uses the teal SECONDARY accent to set it apart
 * from the emerald-primary rows around it (intentional duotone).
 */
export default function AnimeSpotlight({ item }: { item?: SpotlightItem }) {
  if (!item) return null;

  const banner = proxyImage(item.bannerUrl || item.posterUrl || "");
  const poster = proxyImage(item.posterUrl || item.bannerUrl || "");

  return (
    <section className="mb-10">
      <div className="flex items-center gap-3 mb-5 px-1">
        <div className="w-7 h-7 rounded-lg bg-[var(--accent-teal-subtle)] flex items-center justify-center">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--accent-teal)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z" />
            <path d="M16 4.5 17 6l1.5.5L17 7l-1 1.5L15 7l-1.5-.5L15 6Z" />
          </svg>
        </div>
        <h2 className="text-lg md:text-xl font-bold text-white" style={{ fontFamily: "var(--font-space)" }}>
          Anime Spotlight
        </h2>
      </div>

      <div className="relative overflow-hidden rounded-2xl ring-1 ring-white/10 group">
        {/* Backdrop */}
        <div className="absolute inset-0">
          {banner ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={banner}
              alt=""
              className="w-full h-full object-cover object-top transition-transform duration-[1.6s] ease-out group-hover:scale-105"
              referrerPolicy="no-referrer"
            />
          ) : (
            <div className="w-full h-full bg-gradient-to-br from-[var(--bg-secondary)] to-[var(--bg-primary)]" />
          )}
        </div>

        {/* Gradients */}
        <div
          className="absolute inset-0"
          style={{ background: "linear-gradient(to right, var(--bg-primary) 6%, rgba(9,9,12,0.72) 40%, rgba(9,9,12,0.1) 100%)" }}
        />
        <div className="absolute inset-0 bg-gradient-to-t from-[var(--bg-primary)] via-transparent to-transparent" />
        {/* Teal accent edge */}
        <div className="absolute inset-y-0 left-0 w-[3px] bg-[var(--accent-teal)] shadow-[0_0_24px_var(--accent-teal-glow)]" />

        {/* Content */}
        <div className="relative z-10 flex items-center gap-6 md:gap-8 p-6 md:p-9 lg:p-11 min-h-[300px] md:min-h-[360px]">
          {poster && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={poster}
              alt={item.title}
              className="hidden md:block w-[140px] lg:w-[160px] aspect-[2/3] object-cover rounded-xl ring-1 ring-white/15 shadow-[0_12px_40px_rgba(0,0,0,0.6)] flex-shrink-0"
              referrerPolicy="no-referrer"
            />
          )}

          <div className="max-w-xl">
            <span className="inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-[0.16em] text-[var(--accent-teal)] mb-3">
              <span className="w-4 h-[2px] rounded-full bg-[var(--accent-teal)]" />
              Featured this week
            </span>

            <h3
              className="text-2xl md:text-4xl font-extrabold text-white leading-tight mb-3 line-clamp-2 drop-shadow-[0_2px_20px_rgba(0,0,0,0.7)]"
              style={{ fontFamily: "var(--font-space)" }}
            >
              {item.title}
            </h3>

            <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 mb-4 text-sm">
              {item.rating > 0 && (
                <span className="flex items-center gap-1.5 font-bold text-[var(--accent-lime)]">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                    <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                  </svg>
                  {item.rating.toFixed(1)}
                </span>
              )}
              <span className="type-pill type-pill-anime">Anime</span>
              {item.releaseYear > 0 && (
                <span className="text-[var(--text-secondary)] font-medium">{item.releaseYear}</span>
              )}
              {item.genres && item.genres.length > 0 && (
                <span className="hidden sm:inline text-[var(--text-secondary)] font-medium">
                  {item.genres.slice(0, 3).join(" · ")}
                </span>
              )}
            </div>

            <p className="text-sm text-[var(--text-secondary)] leading-relaxed line-clamp-2 md:line-clamp-3 mb-6">
              {item.synopsis}
            </p>

            <div className="flex flex-wrap items-center gap-3 md:gap-4 mt-2" style={{ marginTop: '2rem' }}>
              <Link
                href={`/watch/${item.type}/${item.id}`}
                className="group/play inline-flex items-center justify-center gap-2.5 h-12 md:h-14 rounded-xl bg-white text-black font-bold text-[15px] md:text-base shadow-lg transition-all duration-300 hover:bg-[#e6e6e6] hover:scale-[1.02] active:scale-[0.98]"
                style={{ paddingLeft: '1.75rem', paddingRight: '1.75rem' }}
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
                className="inline-flex items-center justify-center gap-2 h-12 md:h-14 rounded-xl bg-white/[0.12] text-white font-semibold text-[15px] md:text-base backdrop-blur-md border border-white/20 shadow-lg transition-all duration-300 hover:bg-white/[0.2] hover:border-white/30 hover:scale-[1.02] active:scale-[0.98]"
                style={{ paddingLeft: '1.5rem', paddingRight: '1.5rem' }}
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
        </div>
      </div>
    </section>
  );
}
