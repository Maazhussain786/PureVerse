"use client";

import React, { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { useUserState } from "./UserStateContext";
import useDragScroll from "../hooks/useDragScroll";
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
  runtime?: number;
}

interface EpisodeBrowserProps {
  mediaId: string; // e.g. "tmdb_12345"
  mediaType: string;
  totalSeasons: number;
  initialSeason?: number;
  initialEpisodes?: Episode[];
}

function proxyImage(url: string): string {
  if (!url) return "";
  if (url.includes("myanimelist.net")) {
    return `/api/proxy/image?url=${encodeURIComponent(url)}`;
  }
  return url;
}

function formatAirDate(iso: string): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

export default function EpisodeBrowser({
  mediaId,
  mediaType,
  totalSeasons,
  initialSeason,
  initialEpisodes,
}: EpisodeBrowserProps) {
  const { watchHistory } = useUserState();
  const startSeason = initialSeason || 1;
  const [season, setSeason] = useState(startSeason);
  const [episodes, setEpisodes] = useState<Episode[]>(initialEpisodes || []);
  const [loading, setLoading] = useState(false);
  const tabsRef = useRef<HTMLDivElement>(null);
  const stripRef = useRef<HTMLDivElement>(null);
  useDragScroll(tabsRef);
  useDragScroll(stripRef);

  const rawId = mediaId.replace("tmdb_", "").replace("mal_", "");

  useEffect(() => {
    const initialMatches =
      initialEpisodes &&
      initialEpisodes.length > 0 &&
      season === startSeason &&
      (initialEpisodes[0].seasonNumber === season || !initialEpisodes[0].seasonNumber);

    if (initialMatches) {
      setEpisodes(initialEpisodes!);
      return;
    }

    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const res = await fetch(`${API_BASE}/tv/${rawId}/season/${season}`);
        const json = res.ok ? await res.json() : null;
        if (!cancelled) setEpisodes(json?.data || []);
      } catch {
        if (!cancelled) setEpisodes([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [season, rawId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Per-episode progress from real watch history (id + season + episode).
  const progressFor = (epNum: number, seasonNum: number): number => {
    const h = watchHistory.find(
      (w) => w.id === mediaId && (w.season ?? 1) === seasonNum && w.episode === epNum
    );
    return h?.progress ?? 0;
  };

  return (
    <div>
      {/* Header */}
      <div className="flex items-center gap-3 mb-5">
        <div className="w-1.5 h-7 rounded-full bg-[var(--accent-primary)] shadow-[0_0_10px_var(--accent-glow)]" />
        <h2 className="text-xl md:text-[26px] font-bold text-white tracking-tight" style={{ fontFamily: "var(--font-space)" }}>
          Episodes
        </h2>
        {!loading && episodes.length > 0 && (
          <span className="text-sm text-[var(--text-muted)] font-medium mb-0.5">{episodes.length} episodes</span>
        )}
      </div>

      {/* Season tabs */}
      {totalSeasons > 1 && (
        <div className="relative mb-6 border-b border-white/10">
          <div ref={tabsRef} className="drag-scroll flex gap-6 overflow-x-auto hide-scrollbar -mb-px px-2">
            {Array.from({ length: totalSeasons }, (_, i) => i + 1).map((num) => {
              const active = num === season;
              return (
                <button
                  key={num}
                  onClick={() => setSeason(num)}
                  aria-current={active ? "true" : undefined}
                  className={`relative py-3 text-[15px] font-bold whitespace-nowrap transition-colors ${
                    active ? "text-white" : "text-[var(--text-secondary)] hover:text-white"
                  }`}
                >
                  Season {num}
                  {active && (
                    <span className="absolute left-0 right-0 bottom-0 h-[3px] bg-white rounded-t-full shadow-[0_0_10px_rgba(255,255,255,0.6)]" />
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Loading skeletons */}
      {loading && (
        <LoadingSpinner />
      )}

      {/* Episode cards */}
      {!loading && episodes.length > 0 && (
        <div ref={stripRef} className="drag-scroll flex gap-4 overflow-x-auto pb-6 hide-scrollbar snap-x snap-mandatory">
          {episodes.map((ep) => {
            const seasonNum = ep.seasonNumber || season;
            const progress = progressFor(ep.episodeNumber, seasonNum);
            const inProgress = progress > 0 && progress < 95;
            const watched = progress >= 95;
            const href = `/watch/${mediaType}/${mediaId}?season=${seasonNum}&episode=${ep.episodeNumber}`;

            return (
              <Link
                key={ep.id}
                href={href}
                className="group relative flex-none w-72 md:w-80 aspect-video rounded-xl bg-[var(--bg-card)] overflow-hidden snap-start hover:scale-[1.02] transition-transform duration-300 ring-1 ring-white/10 hover:ring-white/30 shadow-lg"
              >
                {/* Thumbnail */}
                {ep.thumbnailUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={proxyImage(ep.thumbnailUrl)}
                    alt={ep.title}
                    className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                    loading="lazy"
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-[var(--text-muted)]">
                    <svg width="28" height="28" viewBox="0 0 24 24" fill="currentColor" className="opacity-30">
                      <polygon points="5 3 19 12 5 21 5 3" />
                    </svg>
                  </div>
                )}
                
                {/* Gradient overlay for text */}
                <div className="absolute inset-0 bg-gradient-to-t from-black/95 via-black/25 to-black/5" />

                {/* Episode number badge */}
                <div className="absolute top-3 left-3 px-2 py-1 rounded-md bg-[var(--accent-primary)] text-black text-[11px] font-extrabold leading-none shadow-[0_0_12px_var(--accent-glow)]">
                  E{ep.episodeNumber}
                </div>

                {/* Watched check */}
                {watched && (
                  <div className="absolute top-3 right-3 w-6 h-6 rounded-full bg-[var(--accent-primary)] flex items-center justify-center shadow-[0_0_12px_var(--accent-glow)]">
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="black" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M20 6 9 17l-5-5" />
                    </svg>
                  </div>
                )}

                {/* Play overlay */}
                <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300 bg-black/30">
                  <div className="w-14 h-14 rounded-full bg-[var(--accent-primary)] flex items-center justify-center text-black scale-90 group-hover:scale-100 transition-transform shadow-[0_0_24px_var(--accent-glow)]">
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor" className="ml-0.5">
                      <polygon points="6 4 20 12 6 20 6 4" />
                    </svg>
                  </div>
                </div>

                {/* Episode Info (bottom) */}
                <div className="absolute bottom-3 left-4 right-4">
                  <div className="flex items-center gap-2 mb-1 text-[11px] font-medium text-white/70">
                    {ep.runtime ? <span>{ep.runtime}m</span> : null}
                    {ep.runtime && ep.airDate ? <span className="w-1 h-1 rounded-full bg-white/40" /> : null}
                    {ep.airDate ? <span>{formatAirDate(ep.airDate)}</span> : null}
                    {inProgress ? <span className="ml-auto text-[var(--accent-primary)] font-bold">{Math.round(progress)}%</span> : null}
                  </div>
                  <h3 className="text-[15px] font-bold text-white truncate drop-shadow-[0_2px_4px_rgba(0,0,0,0.85)]">
                    {ep.title}
                  </h3>
                </div>

                {/* Progress bar */}
                {inProgress && (
                  <div className="absolute bottom-0 left-0 right-0 h-1 bg-white/15">
                    <div className="h-full bg-[var(--accent-primary)] shadow-[0_0_8px_var(--accent-glow)]" style={{ width: `${progress}%` }} />
                  </div>
                )}
              </Link>
            );
          })}
        </div>
      )}

      {/* Empty state */}
      {!loading && episodes.length === 0 && (
        <div className="text-center py-16 rounded-2xl ring-1 ring-white/5 bg-[var(--bg-card)]/30">
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="1.5" className="mx-auto mb-3 opacity-50">
            <rect width="18" height="18" x="3" y="3" rx="2" />
            <path d="M7 3v18M3 7.5h4M3 12h18M3 16.5h4M17 3v18M17 7.5h4M17 16.5h4" />
          </svg>
          <p className="text-sm text-[var(--text-muted)]">No episodes available for this season yet.</p>
        </div>
      )}
    </div>
  );
}
