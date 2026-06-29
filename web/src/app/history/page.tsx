"use client";

import React from "react";
import { useUserState } from "../components/UserStateContext";
import Link from "next/link";

function proxyImage(url: string): string {
  if (!url) return "";
  if (url.includes("myanimelist.net")) {
    return `/api/proxy/image?url=${encodeURIComponent(url)}`;
  }
  return url;
}

function formatDate(timestamp: number): string {
  const date = new Date(timestamp);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return "Just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export default function HistoryPage() {
  const { watchHistory, clearHistory, removeFromHistory } = useUserState();

  return (
    <main className="min-h-screen pt-32 pb-28 lg:pb-16 px-6 md:px-10 lg:px-14 max-w-[1600px] mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-xl bg-[rgba(163,230,53,0.12)] flex items-center justify-center">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#a3e635" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" />
                <polyline points="12 6 12 12 16 14" />
              </svg>
            </div>
            <h1
              className="text-3xl md:text-4xl font-bold"
              style={{ fontFamily: "var(--font-space)" }}
            >
              Watch History
            </h1>
          </div>
          <p className="text-[var(--text-secondary)] text-sm">
            {watchHistory.length > 0
              ? `${watchHistory.length} title${watchHistory.length !== 1 ? "s" : ""} watched`
              : "No watch history yet"}
          </p>
        </div>

        {watchHistory.length > 0 && (
          <button onClick={clearHistory} className="btn-danger btn-sm">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M3 6h18" />
              <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" />
              <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
            </svg>
            Clear All
          </button>
        )}
      </div>

      {/* History List */}
      {watchHistory.length > 0 ? (
        <div className="grid gap-3">
          {watchHistory.map((item, index) => (
            <div
              key={`${item.key}-${index}`}
              className="relative group"
            >
              {/* Remove button — instant per-item delete */}
              <button
                onClick={() => removeFromHistory(item.key)}
                className="absolute top-1/2 -translate-y-1/2 right-3 z-10 w-8 h-8 rounded-full bg-white/5 hover:bg-red-500/80 flex items-center justify-center text-[var(--text-muted)] hover:text-white opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-all"
                title="Remove from history"
                aria-label={`Remove ${item.title} from history`}
              >
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <path d="M18 6 6 18M6 6l12 12" />
                </svg>
              </button>
            <Link
              href={
                item.season && item.episode
                  ? `/watch/${item.type}/${item.id}?season=${item.season}&episode=${item.episode}`
                  : `/watch/${item.type}/${item.id}`
              }
              className="glass-panel glass-panel-hover rounded-xl p-4 pr-12 flex gap-4 items-center transition-all"
            >
              {/* Poster Thumbnail */}
              <div className="flex-shrink-0 w-[60px] md:w-[80px] aspect-[2/3] rounded-lg overflow-hidden bg-[var(--bg-card)] relative">
                {item.posterUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={proxyImage(item.posterUrl)}
                    alt={item.title}
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
                {/* Progress overlay */}
                <div className="absolute bottom-0 left-0 right-0 h-1 bg-white/10">
                  <div
                    className="h-full bg-[var(--accent-primary)]"
                    style={{ width: `${item.progress}%` }}
                  />
                </div>
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <h3 className="text-sm md:text-base font-semibold text-white truncate group-hover:text-[var(--accent-primary)] transition-colors">
                  {item.title}
                </h3>
                <div className="flex items-center gap-2 mt-1 text-xs text-[var(--text-muted)]">
                  <span className={`type-pill type-pill-${item.type}`}>
                    {item.type === "tv" ? "Series" : item.type}
                  </span>
                  {item.season && item.episode && (
                    <span className="font-medium">S{item.season} E{item.episode}</span>
                  )}
                  {item.episodeTitle && (
                    <span className="truncate hidden sm:inline">· {item.episodeTitle}</span>
                  )}
                </div>
                <div className="flex items-center gap-3 mt-1.5">
                  <span className="text-[10px] text-[var(--text-muted)]">
                    {formatDate(item.lastWatched)}
                  </span>
                  <span className="text-[10px] text-[var(--text-muted)]">
                    {item.progress}% watched
                  </span>
                </div>
              </div>

              {/* Resume Play */}
              <div className="flex-shrink-0">
                <div className="w-10 h-10 rounded-full bg-[var(--accent-primary)]/10 flex items-center justify-center group-hover:bg-[var(--accent-primary)]/20 transition-colors">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="var(--accent-primary)">
                    <polygon points="5 3 19 12 5 21 5 3" />
                  </svg>
                </div>
              </div>
            </Link>
            </div>
          ))}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <div className="w-20 h-20 rounded-full bg-[var(--bg-card)] flex items-center justify-center mb-6">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="1.5">
              <circle cx="12" cy="12" r="10" />
              <polyline points="12 6 12 12 16 14" />
            </svg>
          </div>
          <p className="text-[var(--text-muted)] text-lg mb-2">
            No watch history yet
          </p>
          <p className="text-[var(--text-muted)] text-sm mb-6 max-w-md">
            Start watching movies, series, and anime. Your history will appear here so you can easily resume.
          </p>
          <Link href="/" className="btn-primary">
            Start Watching
          </Link>
        </div>
      )}
    </main>
  );
}
