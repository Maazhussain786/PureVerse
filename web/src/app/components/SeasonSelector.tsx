"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import LoadingSpinner from "./LoadingSpinner";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000/api";

interface Episode {
  id: string;
  seasonNumber?: number;
  episodeNumber: number;
  title: string;
  thumbnailUrl: string;
  airDate: string;
  synopsis: string;
}

interface SeasonSelectorProps {
  mediaId: string; // e.g. "tmdb_12345"
  mediaType: string;
  totalSeasons: number;
  initialSeason?: number;
  initialEpisodes?: Episode[];
  currentEpisode?: number; // highlight currently playing
  mode?: "details" | "watch"; // watch mode uses compact layout
}

function proxyImage(url: string): string {
  if (!url) return "";
  if (url.includes("myanimelist.net")) {
    return `/api/proxy/image?url=${encodeURIComponent(url)}`;
  }
  return url;
}

export default function SeasonSelector({
  mediaId,
  mediaType,
  totalSeasons,
  initialSeason,
  initialEpisodes,
  currentEpisode,
  mode = "details",
}: SeasonSelectorProps) {
  const [selectedSeason, setSelectedSeason] = useState(initialSeason || totalSeasons);
  const [episodes, setEpisodes] = useState<Episode[]>(initialEpisodes || []);
  const [loading, setLoading] = useState(false);

  // Strip prefix for API call
  const rawId = mediaId.replace("tmdb_", "").replace("mal_", "");

  useEffect(() => {
    // Don't refetch if we have initial data for the selected season
    const isInitialSeason = selectedSeason === (initialSeason || totalSeasons);
    const initialEpisodesMatch = initialEpisodes && 
      initialEpisodes.length > 0 && 
      (initialEpisodes[0].seasonNumber === selectedSeason || 
       (!initialEpisodes[0].seasonNumber && isInitialSeason));

    if (initialEpisodesMatch) {
      setEpisodes(initialEpisodes);
      return;
    }

    async function fetchEpisodes() {
      setLoading(true);
      try {
        const res = await fetch(`${API_BASE}/tv/${rawId}/season/${selectedSeason}`);
        if (res.ok) {
          const json = await res.json();
          setEpisodes(json.data || []);
        } else {
          setEpisodes([]);
        }
      } catch {
        setEpisodes([]);
      } finally {
        setLoading(false);
      }
    }

    fetchEpisodes();
  }, [selectedSeason, rawId, initialEpisodes, initialSeason, totalSeasons]);

  const isCompact = mode === "watch";

  return (
    <div>
      {/* Season Header */}
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-3">
          <div className="w-1 h-5 rounded-full bg-[var(--accent-primary)]" />
          <h2
            className={`${isCompact ? "text-lg" : "text-xl"} font-bold text-white`}
            style={{ fontFamily: "var(--font-space)" }}
          >
            Episodes
          </h2>
        </div>

        {/* Season Dropdown */}
        {totalSeasons > 1 && (
          <select
            value={selectedSeason}
            onChange={(e) => setSelectedSeason(Number(e.target.value))}
            className="season-dropdown"
          >
            {Array.from({ length: totalSeasons }, (_, i) => i + 1).map((num) => (
              <option key={num} value={num}>
                Season {num}
              </option>
            ))}
          </select>
        )}
      </div>

      {/* Loading Skeleton */}
      {loading && (
        <LoadingSpinner />
      )}

      {/* Episodes Grid */}
      {!loading && episodes.length > 0 && (
        <div className={`grid gap-3 ${isCompact ? "max-h-[500px] overflow-y-auto hide-scrollbar pr-1" : ""}`}>
          {episodes.map((ep) => {
            const isActive = currentEpisode === ep.episodeNumber;
            const watchHref = `/watch/${mediaType}/${mediaId}?season=${ep.seasonNumber || selectedSeason}&episode=${ep.episodeNumber}`;

            return (
              <Link
                key={ep.id}
                href={watchHref}
                className={`episode-card rounded-xl p-3 md:p-4 flex gap-4 items-center border border-white/5 group ${isActive ? "active" : ""}`}
              >
                {/* Episode Thumbnail */}
                <div className="flex-shrink-0 w-[100px] md:w-[140px] aspect-video rounded-lg overflow-hidden bg-[var(--bg-card)] relative">
                  {ep.thumbnailUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={proxyImage(ep.thumbnailUrl)}
                      alt={ep.title}
                      className="w-full h-full object-cover"
                      loading="lazy"
                      referrerPolicy="no-referrer"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-[var(--text-muted)]">
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" className="opacity-30">
                        <polygon points="5 3 19 12 5 21 5 3" />
                      </svg>
                    </div>
                  )}
                  {/* Episode number overlay */}
                  <div className="absolute bottom-1 right-1 bg-black/70 backdrop-blur-sm text-[10px] font-bold text-white px-1.5 py-0.5 rounded">
                    {ep.episodeNumber}
                  </div>
                  {/* Play overlay on hover */}
                  <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center ${isActive ? "bg-[var(--accent-primary)]" : "bg-white/20 backdrop-blur-md"}`}>
                      <svg width="12" height="12" viewBox="0 0 24 24" fill={isActive ? "black" : "white"}>
                        <polygon points="5 3 19 12 5 21 5 3" />
                      </svg>
                    </div>
                  </div>
                </div>

                {/* Episode Info */}
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-[var(--text-muted)] mb-1 font-medium">
                    {ep.seasonNumber ? `S${ep.seasonNumber} · ` : ""}E{ep.episodeNumber}
                    {ep.airDate ? ` · ${ep.airDate}` : ""}
                  </p>
                  <h3 className={`text-sm font-semibold truncate transition-colors ${isActive ? "text-[var(--accent-primary)]" : "text-white group-hover:text-[var(--accent-primary)]"}`}>
                    {ep.title}
                  </h3>
                  {ep.synopsis && !isCompact && (
                    <p className="text-xs text-[var(--text-muted)] mt-1 line-clamp-2">
                      {ep.synopsis}
                    </p>
                  )}
                </div>

                {/* Now Playing indicator */}
                {isActive && (
                  <div className="flex-shrink-0">
                    <div className="flex items-center gap-1 text-[var(--accent-primary)]">
                      <div className="flex gap-0.5">
                        <div className="w-0.5 h-3 bg-[var(--accent-primary)] rounded-full animate-pulse" />
                        <div className="w-0.5 h-4 bg-[var(--accent-primary)] rounded-full animate-pulse" style={{ animationDelay: "0.15s" }} />
                        <div className="w-0.5 h-2 bg-[var(--accent-primary)] rounded-full animate-pulse" style={{ animationDelay: "0.3s" }} />
                      </div>
                    </div>
                  </div>
                )}
              </Link>
            );
          })}
        </div>
      )}

      {/* Empty State */}
      {!loading && episodes.length === 0 && (
        <div className="text-center py-12 text-[var(--text-muted)]">
          <p className="text-sm">No episodes available for this season.</p>
        </div>
      )}
    </div>
  );
}
