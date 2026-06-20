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
  useDragScroll(tabsRef);

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

      {/* Episode list — a roomy vertical list (thumbnail + title + synopsis),
          Netflix/Cineby style: easy to scan, readable text, big tap targets. */}
      {!loading && episodes.length > 0 && (
        <div className="flex flex-col gap-3">
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
                className="group flex items-stretch gap-4 md:gap-5 p-2.5 md:p-3 rounded-2xl bg-white/[0.03] ring-1 ring-white/[0.06] hover:bg-white/[0.06] hover:ring-[var(--accent-primary)]/40 transition-all duration-200"
              >
                {/* Thumbnail */}
                <div className="relative flex-none w-[136px] sm:w-[180px] md:w-[230px] aspect-video rounded-xl overflow-hidden bg-[var(--bg-elevated)]">
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

                  {/* Play overlay on hover */}
                  <div className="absolute inset-0 flex items-center justify-center bg-black/35 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                    <span className="w-11 h-11 md:w-12 md:h-12 rounded-full bg-[var(--accent-primary)] flex items-center justify-center text-black scale-90 group-hover:scale-100 transition-transform shadow-[0_0_20px_var(--accent-glow)]">
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" className="ml-0.5">
                        <polygon points="6 4 20 12 6 20 6 4" />
                      </svg>
                    </span>
                  </div>

                  {/* Resume progress */}
                  {inProgress && (
                    <div className="absolute bottom-0 inset-x-0 h-1 bg-black/50">
                      <div className="h-full bg-[var(--accent-primary)] shadow-[0_0_8px_var(--accent-glow)]" style={{ width: `${progress}%` }} />
                    </div>
                  )}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0 flex flex-col justify-center py-1 pr-1.5">
                  <div className="flex items-center gap-2.5 mb-1.5">
                    <span className="text-lg md:text-2xl font-extrabold text-[var(--accent-primary)] leading-none tabular-nums">
                      {ep.episodeNumber}
                    </span>
                    <h3 className="flex-1 min-w-0 text-[15px] md:text-[17px] font-bold text-white truncate">
                      {ep.title || `Episode ${ep.episodeNumber}`}
                    </h3>
                    {watched && (
                      <span className="flex-none flex items-center gap-1 text-[11px] font-bold text-[var(--accent-primary)]">
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5" /></svg>
                        <span className="hidden sm:inline">Watched</span>
                      </span>
                    )}
                    {inProgress && (
                      <span className="flex-none text-[12px] font-bold text-[var(--accent-primary)]">{Math.round(progress)}%</span>
                    )}
                  </div>

                  <div className="flex items-center gap-2 mb-1.5 text-[12px] md:text-[13px] font-medium text-[var(--text-muted)]">
                    {ep.runtime ? <span>{ep.runtime} min</span> : null}
                    {ep.runtime && ep.airDate ? <span className="w-1 h-1 rounded-full bg-[var(--text-muted)]" /> : null}
                    {ep.airDate ? <span>{formatAirDate(ep.airDate)}</span> : null}
                  </div>

                  {ep.synopsis ? (
                    <p className="text-[13px] md:text-sm leading-relaxed text-[var(--text-secondary)] line-clamp-2">
                      {ep.synopsis}
                    </p>
                  ) : null}
                </div>
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
