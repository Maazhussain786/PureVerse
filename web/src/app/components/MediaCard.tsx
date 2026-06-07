"use client";

import React from "react";
import Link from "next/link";

interface MediaCardProps {
  id: string;
  type: string;
  title: string;
  posterUrl: string;
  rating: number;
  releaseYear: number;
}

function ratingClass(rating: number): string {
  if (rating >= 7) return "rating-high";
  if (rating >= 5) return "rating-mid";
  return "rating-low";
}

function typePillClass(type: string): string {
  if (type === "movie") return "type-pill type-pill-movie";
  if (type === "tv") return "type-pill type-pill-tv";
  return "type-pill type-pill-anime";
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
  rating,
  releaseYear,
}: MediaCardProps) {
  const detailHref = `/details/${type}/${id}`;
  const imgSrc = proxyImage(posterUrl);

  return (
    <Link
      href={detailHref}
      className="media-card flex-none w-[140px] sm:w-[160px] md:w-[180px] group relative rounded-xl overflow-visible"
    >
      {/* Poster */}
      <div className="relative aspect-[2/3] rounded-xl overflow-hidden bg-[var(--bg-card)] shadow-lg shadow-black/40 border border-white/5 group-hover:border-white/10 transition-colors">
        {/* Episode Badge (Mock for Continue Watching style) */}
        {type === "tv" || type === "anime" ? (
          <div className="absolute top-2 left-2 z-10 bg-black/70 backdrop-blur-md border border-white/10 rounded-md px-2 py-0.5 shadow-md">
            <span className="text-[10px] font-bold text-white tracking-wider">EP 12</span>
          </div>
        ) : null}

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
          <div className="text-center">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" className="mx-auto mb-1 opacity-40">
              <rect width="18" height="18" x="3" y="3" rx="2" />
              <circle cx="9" cy="9" r="2" />
              <path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21" />
            </svg>
            <span className="opacity-50">{title.substring(0, 12)}</span>
          </div>
        </div>

        {/* Hover Overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex flex-col justify-end p-3">
          <div className="flex items-center gap-2 mb-1">
            <span className={typePillClass(type)}>
              {type === "tv" ? "Series" : type}
            </span>
          </div>
          <p className="text-xs text-gray-300">
            {releaseYear > 0 ? releaseYear : "TBA"}
          </p>
        </div>

        {/* Rating Badge (always visible) */}
        {rating > 0 && (
          <div className="absolute top-2 right-2 glass-panel rounded-md px-1.5 py-0.5 flex items-center gap-1">
            <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor" className={ratingClass(rating)}>
              <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
            </svg>
            <span className={`text-[10px] font-semibold ${ratingClass(rating)}`}>
              {rating.toFixed(1)}
            </span>
          </div>
        )}
      </div>

      {/* Title */}
      <div className="mt-2.5 px-0.5">
        <h3 className="text-sm font-medium text-[var(--text-primary)] truncate group-hover:text-[var(--accent-primary)] transition-colors duration-200">
          {title}
        </h3>
      </div>
    </Link>
  );
}
