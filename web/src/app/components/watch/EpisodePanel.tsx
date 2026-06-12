"use client";

import React, { useState, useEffect, useRef } from "react";
import { useUserState, historyKey } from "../UserStateContext";
import { API_BASE, proxyImage } from "../../lib/api";

export interface EpisodeInfo {
  id: string;
  seasonNumber?: number;
  episodeNumber: number;
  title: string;
  thumbnailUrl: string;
  airDate: string;
  synopsis: string;
  runtime?: number;
}

interface EpisodePanelProps {
  mediaId: string;
  totalSeasons: number;
  season: number;
  episode: number;
  initialEpisodes?: EpisodeInfo[];
  onSelect: (season: number, episode: number) => void;
  onEpisodesLoaded?: (episodes: EpisodeInfo[]) => void;
  locked?: boolean; // party guests
  className?: string;
}

/**
 * Theater-mode episode rail: season switcher + scrollable episode list with
 * thumbnails, per-episode watch progress and a now-playing indicator.
 * Selection is callback-based so the watch page navigates and the party
 * room broadcasts instead.
 */
export default function EpisodePanel({
  mediaId,
  totalSeasons,
  season,
  episode,
  initialEpisodes,
  onSelect,
  onEpisodesLoaded,
  locked = false,
  className = "",
}: EpisodePanelProps) {
  const { watchHistory } = useUserState();
  const [selectedSeason, setSelectedSeason] = useState(season);
  const [episodes, setEpisodes] = useState<EpisodeInfo[]>(initialEpisodes || []);
  const [loading, setLoading] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);
  const activeRef = useRef<HTMLButtonElement>(null);

  const rawId = mediaId.replace("tmdb_", "").replace("mal_", "");

  // Follow external season changes (e.g. host switched episodes)
  useEffect(() => {
    setSelectedSeason(season);
  }, [season]);

  useEffect(() => {
    const initialMatches =
      initialEpisodes &&
      initialEpisodes.length > 0 &&
      (initialEpisodes[0].seasonNumber === selectedSeason || initialEpisodes[0].seasonNumber == null);
    // Only lift episodes to the parent when the panel is showing the season
    // that's actually being watched — otherwise browsing other seasons in the
    // dropdown would corrupt the watch page's next/prev/autoplay computation.
    if (initialMatches) {
      setEpisodes(initialEpisodes);
      if (selectedSeason === season) onEpisodesLoaded?.(initialEpisodes);
      return;
    }
    let cancelled = false;
    setLoading(true);
    fetch(`${API_BASE}/tv/${rawId}/season/${selectedSeason}`)
      .then((r) => (r.ok ? r.json() : { data: [] }))
      .then((j) => {
        if (cancelled) return;
        setEpisodes(j.data || []);
        if (selectedSeason === season) onEpisodesLoaded?.(j.data || []);
      })
      .catch(() => !cancelled && setEpisodes([]))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedSeason, rawId]);

  // Auto-scroll the active episode into view
  useEffect(() => {
    if (activeRef.current && listRef.current) {
      activeRef.current.scrollIntoView({ block: "nearest", behavior: "smooth" });
    }
  }, [episodes, episode]);

  const progressFor = (epNum: number): number => {
    const key = historyKey(mediaId, selectedSeason, epNum);
    return watchHistory.find((h) => h.key === key)?.progress || 0;
  };

  return (
    <div className={`flex flex-col min-h-0 ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between gap-3 px-4 py-3 border-b border-white/[0.06] flex-shrink-0">
        <h3 className="text-sm font-bold text-white flex items-center gap-2" style={{ fontFamily: "var(--font-space)" }}>
          <span className="w-1 h-4 rounded-full bg-[var(--accent-primary)]" />
          Episodes
          {episodes.length > 0 && (
            <span className="text-[10px] font-bold text-[var(--text-muted)]">({episodes.length})</span>
          )}
        </h3>
        {totalSeasons > 1 && (
          <select
            value={selectedSeason}
            onChange={(e) => setSelectedSeason(Number(e.target.value))}
            className="season-dropdown !py-1.5 !text-xs"
            aria-label="Season"
          >
            {Array.from({ length: totalSeasons }, (_, i) => i + 1).map((num) => (
              <option key={num} value={num}>Season {num}</option>
            ))}
          </select>
        )}
      </div>

      {/* List */}
      <div ref={listRef} className="flex-1 min-h-0 overflow-y-auto custom-scrollbar">
        {loading ? (
          <div className="p-3 space-y-2">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="flex gap-3 p-2">
                <div className="skeleton w-[104px] aspect-video rounded-lg flex-shrink-0" />
                <div className="flex-1 space-y-2 py-1">
                  <div className="skeleton w-12 h-2.5 rounded" />
                  <div className="skeleton w-4/5 h-3.5 rounded" />
                </div>
              </div>
            ))}
          </div>
        ) : episodes.length === 0 ? (
          <p className="text-xs text-[var(--text-muted)] text-center py-10">
            No episodes available for this season.
          </p>
        ) : (
          <div className="p-2 space-y-1">
            {episodes.map((ep) => {
              const isActive = selectedSeason === season && ep.episodeNumber === episode;
              const progress = progressFor(ep.episodeNumber);
              return (
                <button
                  key={ep.id}
                  ref={isActive ? activeRef : undefined}
                  onClick={() => !locked && onSelect(selectedSeason, ep.episodeNumber)}
                  disabled={locked}
                  className={`w-full flex gap-3 p-2 rounded-xl text-left transition-all duration-200 group ${
                    isActive
                      ? "bg-[var(--accent-primary)]/10 ring-1 ring-[var(--accent-primary)]/40"
                      : locked
                        ? "opacity-50 cursor-not-allowed"
                        : "hover:bg-white/[0.05]"
                  }`}
                >
                  {/* Thumbnail */}
                  <div className="relative flex-shrink-0 w-[104px] aspect-video rounded-lg overflow-hidden bg-[var(--bg-elevated)]">
                    {ep.thumbnailUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={proxyImage(ep.thumbnailUrl)}
                        alt=""
                        className="w-full h-full object-cover"
                        loading="lazy"
                        referrerPolicy="no-referrer"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-[var(--text-muted)]">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" className="opacity-30">
                          <polygon points="5 3 19 12 5 21 5 3" />
                        </svg>
                      </div>
                    )}
                    {isActive ? (
                      <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                        <span className="sound-wave">
                          <span /><span /><span /><span />
                        </span>
                      </div>
                    ) : (
                      !locked && (
                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                          <span className="w-7 h-7 rounded-full bg-white/20 backdrop-blur-md flex items-center justify-center">
                            <svg width="11" height="11" viewBox="0 0 24 24" fill="white">
                              <polygon points="5 3 19 12 5 21 5 3" />
                            </svg>
                          </span>
                        </div>
                      )
                    )}
                    {progress > 0 && (
                      <div className="absolute bottom-0 inset-x-0 h-[3px] bg-black/50">
                        <div className="h-full bg-[var(--accent-primary)]" style={{ width: `${progress}%` }} />
                      </div>
                    )}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0 py-0.5">
                    <p className="text-[10px] font-bold text-[var(--text-muted)] tracking-wide">
                      EPISODE {ep.episodeNumber}
                      {ep.runtime ? ` · ${ep.runtime}m` : ""}
                      {progress >= 95 && (
                        <span className="ml-1.5 text-[var(--accent-primary)]">✓ Watched</span>
                      )}
                    </p>
                    <h4 className={`text-[13px] font-semibold leading-snug mt-0.5 line-clamp-2 ${
                      isActive ? "text-[var(--accent-primary)]" : "text-white"
                    }`}>
                      {ep.title || `Episode ${ep.episodeNumber}`}
                    </h4>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
