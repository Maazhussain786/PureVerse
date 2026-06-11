"use client";

import React from "react";
import Link from "next/link";

interface MediaCardProps {
  id: string;
  type: string;
  title: string;
  posterUrl: string;
  bannerUrl?: string; // landscape backdrop, used by the "landscape" layout
  rating: number;
  releaseYear: number;
  progress?: number; // 0-100, for continue watching
  episodeLabel?: string; // e.g. "S2 E5"
  rank?: number; // 1-based rank badge (Top 10 rows)
  layout?: "portrait" | "landscape";
  onRemove?: () => void;
  href?: string; // override destination (e.g. resume playback on /watch)
}

function ratingClass(rating: number): string {
  if (rating >= 7) return "rating-high";
  if (rating >= 5) return "rating-mid";
  return "rating-low";
}

function typeLabel(type: string): string {
  if (type === "movie") return "Movie";
  if (type === "tv") return "TV Show";
  if (type === "anime") return "Anime";
  return type;
}

/** Route MAL images through our Next.js backend proxy to bypass hotlinking protection */
function proxyImage(url: string): string {
  if (!url) return "";
  if (url.includes("myanimelist.net")) {
    return `/api/proxy/image?url=${encodeURIComponent(url)}`;
  }
  return url;
}

export default function MediaCard({
  id,
  type,
  title,
  posterUrl,
  bannerUrl,
  rating,
  releaseYear,
  progress,
  episodeLabel,
  rank,
  layout = "portrait",
  onRemove,
  href,
}: MediaCardProps) {
  const detailHref = href || `/details/${type}/${id}`;
  const isLandscape = layout === "landscape";

  // Landscape cards prefer the backdrop; fall back to poster if there's no banner.
  const imgSrc = proxyImage(isLandscape ? bannerUrl || posterUrl : posterUrl);

  const widthClass = isLandscape
    ? "w-[260px] sm:w-[300px] md:w-[340px] lg:w-[360px]"
    : "w-[150px] sm:w-[168px] md:w-[188px]";
  const aspectClass = isLandscape ? "aspect-video" : "aspect-[2/3]";

  const removeButton = onRemove ? (
    <button
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        onRemove();
      }}
      className="absolute -top-2 -right-2 w-7 h-7 rounded-full bg-red-500/80 backdrop-blur-md flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all hover:bg-red-500 z-20 shadow-lg cursor-pointer"
      title="Remove from list"
    >
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5">
        <path d="M18 6 6 18M6 6l12 12" />
      </svg>
    </button>
  ) : null;

  return (
    <div className={`media-card flex-none ${widthClass} group relative overflow-visible`}>
      <Link href={detailHref} className="block w-full h-full">
        {/* Image */}
        <div
          className={`relative ${aspectClass} rounded-xl overflow-hidden bg-[var(--bg-card)] shadow-lg shadow-black/40 ring-1 ring-white/5 group-hover:ring-2 group-hover:ring-[var(--accent-primary)]/60 group-hover:shadow-[0_0_26px_var(--accent-glow)] transition-all duration-300`}
        >
          {/* Rank badge (Top 10) */}
          {typeof rank === "number" && (
            <div className="absolute top-2 left-2 z-10 w-7 h-7 rounded-lg bg-[var(--accent-primary)] flex items-center justify-center shadow-[0_0_14px_var(--accent-glow)]">
              <span className="text-sm font-black text-black" style={{ fontFamily: "var(--font-space)" }}>
                {rank}
              </span>
            </div>
          )}

          {/* Episode Badge (continue watching) */}
          {episodeLabel && (
            <div className="absolute top-2 right-2 z-10 bg-black/70 backdrop-blur-md border border-white/10 rounded-md px-2 py-0.5 shadow-md">
              <span className="text-[10px] font-bold text-white tracking-wider">{episodeLabel}</span>
            </div>
          )}

          {imgSrc ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={imgSrc}
              alt={title}
              className="media-card-image w-full h-full object-cover"
              loading="lazy"
              referrerPolicy="no-referrer"
              onError={(e) => {
                const target = e.target as HTMLImageElement;
                target.style.display = "none";
                if (target.nextElementSibling) {
                  (target.nextElementSibling as HTMLElement).style.display = "flex";
                }
              }}
            />
          ) : null}
          {/* Fallback - shown when image fails or no URL */}
          <div
            className={`w-full h-full items-center justify-center text-[var(--text-muted)] text-xs absolute inset-0 bg-[var(--bg-card)] ${imgSrc ? "hidden" : "flex"}`}
          >
            <div className="text-center px-2">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" className="mx-auto mb-1 opacity-40">
                <rect width="18" height="18" x="3" y="3" rx="2" />
                <circle cx="9" cy="9" r="2" />
                <path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21" />
              </svg>
              <span className="opacity-50 line-clamp-1">{title}</span>
            </div>
          </div>

          {/* Hover Overlay — clean darken + centered play */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center justify-center">
            <div className="w-12 h-12 rounded-full bg-[var(--accent-primary)] flex items-center justify-center shadow-[0_0_22px_var(--accent-glow)] scale-90 group-hover:scale-100 transition-transform duration-300">
              <svg width="17" height="17" viewBox="0 0 24 24" fill="black">
                <polygon points="6 4 20 12 6 20 6 4" />
              </svg>
            </div>
          </div>

          {/* Progress Bar */}
          {typeof progress === "number" && progress > 0 && (
            <div className="progress-bar-container">
              <div className="progress-bar-fill" style={{ width: `${Math.min(progress, 100)}%` }} />
            </div>
          )}
        </div>

        {/* Title + meta line (cineby-style) */}
        <div className="mt-2.5 px-0.5">
          <h3 className="text-sm font-semibold text-[var(--text-primary)] truncate group-hover:text-[var(--accent-primary)] transition-colors duration-200">
            {title}
          </h3>
          <div className="flex items-center gap-1.5 mt-1 text-xs text-[var(--text-secondary)]">
            {rating > 0 && (
              <span className={`flex items-center gap-1 font-semibold ${ratingClass(rating)}`}>
                <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor">
                  <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                </svg>
                {rating.toFixed(1)}
              </span>
            )}
            {rating > 0 && releaseYear > 0 && <span className="w-1 h-1 rounded-full bg-[var(--text-muted)]" />}
            {releaseYear > 0 && <span>{releaseYear}</span>}
            <span className="w-1 h-1 rounded-full bg-[var(--text-muted)]" />
            <span>{typeLabel(type)}</span>
          </div>
        </div>
      </Link>
      {removeButton}
    </div>
  );
}
