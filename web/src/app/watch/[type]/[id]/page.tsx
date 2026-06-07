"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";

const API_BASE =
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000/api";

interface StreamSource {
  server: string;
  quality: string;
  url: string;
  type: string;
}

interface StreamData {
  sources: StreamSource[];
  subtitles: any[];
}

export default function WatchPage() {
  const params = useParams();
  const searchParams = useSearchParams();

  const type = params.type as string;
  const id = params.id as string;
  const season = searchParams.get("season");
  const episode = searchParams.get("episode");

  const [streamData, setStreamData] = useState<StreamData | null>(null);
  const [activeSourceIdx, setActiveSourceIdx] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    async function fetchStream() {
      try {
        setLoading(true);
        let url = `${API_BASE}/media/stream/${type}/${id}`;
        const queryParts: string[] = [];
        if (season) queryParts.push(`season=${season}`);
        if (episode) queryParts.push(`episode=${episode}`);
        if (queryParts.length > 0) url += `?${queryParts.join("&")}`;

        const res = await fetch(url);
        if (!res.ok) throw new Error("Failed to fetch");
        const json = await res.json();
        setStreamData(json.data);
      } catch {
        setError(true);
      } finally {
        setLoading(false);
      }
    }
    fetchStream();
  }, [type, id, season, episode]);

  const activeSource = streamData?.sources?.[activeSourceIdx];

  return (
    <main className="min-h-screen bg-[var(--bg-primary)] pt-16">
      {/* Player Container */}
      <div className="w-full max-w-[1400px] mx-auto px-4 md:px-6 pt-6">
        {/* Video Player */}
        <div className="relative w-full aspect-video rounded-2xl overflow-hidden bg-black ring-1 ring-white/5 shadow-2xl">
          {loading && (
            <div className="absolute inset-0 flex items-center justify-center bg-black">
              <div className="flex flex-col items-center gap-4">
                <div className="w-10 h-10 border-2 border-[var(--accent-primary)] border-t-transparent rounded-full animate-spin" />
                <p className="text-sm text-[var(--text-muted)]">
                  Loading stream...
                </p>
              </div>
            </div>
          )}

          {error && (
            <div className="absolute inset-0 flex items-center justify-center bg-black">
              <div className="text-center">
                <p className="text-lg font-medium text-white mb-2">
                  Stream Unavailable
                </p>
                <p className="text-sm text-[var(--text-muted)] mb-4">
                  Make sure the backend API is running
                </p>
                <Link href="/" className="btn-primary text-sm px-6 py-2">
                  Back to Home
                </Link>
              </div>
            </div>
          )}

          {!loading && !error && activeSource && (
            <iframe
              key={activeSource.url}
              src={activeSource.url}
              className="w-full h-full border-none"
              allowFullScreen
              allow="autoplay; fullscreen; encrypted-media; picture-in-picture"
              referrerPolicy="origin"
              sandbox="allow-forms allow-scripts allow-same-origin allow-popups allow-presentation"
            />
          )}
        </div>

        {/* Controls Bar */}
        <div className="mt-4 glass-panel rounded-xl p-5">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            {/* Media Info */}
            <div>
              <h1
                className="text-lg md:text-xl font-bold text-white mb-1"
                style={{ fontFamily: "var(--font-space)" }}
              >
                Now Playing
              </h1>
              <p className="text-sm text-[var(--text-secondary)]">
                {type.toUpperCase()} • {id}
                {season && episode && ` • S${season}E${episode}`}
              </p>
            </div>

            {/* Navigation */}
            <div className="flex items-center gap-3">
              <Link
                href={`/details/${type}/${id}`}
                className="btn-glass text-xs px-4 py-2"
              >
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <circle cx="12" cy="12" r="10" />
                  <path d="M12 16v-4" />
                  <path d="M12 8h.01" />
                </svg>
                Details
              </Link>
              <Link href="/" className="btn-glass text-xs px-4 py-2">
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
                  <polyline points="9 22 9 12 15 12 15 22" />
                </svg>
                Home
              </Link>
            </div>
          </div>
        </div>

        {/* Server Selector */}
        {streamData && streamData.sources.length > 0 && (
          <div className="mt-4 glass-panel rounded-xl p-5">
            <h3 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="var(--accent-primary)"
                strokeWidth="2"
              >
                <rect width="20" height="8" x="2" y="2" rx="2" ry="2" />
                <rect width="20" height="8" x="2" y="14" rx="2" ry="2" />
                <line x1="6" x2="6.01" y1="6" y2="6" />
                <line x1="6" x2="6.01" y1="18" y2="18" />
              </svg>
              Select Server
            </h3>
            <div className="flex flex-wrap gap-2">
              {streamData.sources.map((source, idx) => (
                <button
                  key={`${source.server}-${idx}`}
                  onClick={() => setActiveSourceIdx(idx)}
                  className={`px-4 py-2 rounded-lg text-xs font-medium transition-all duration-200 ${
                    activeSourceIdx === idx
                      ? "bg-[var(--accent-primary)] text-white shadow-[0_0_15px_var(--accent-glow)]"
                      : "glass-panel text-[var(--text-secondary)] hover:text-white hover:bg-white/10"
                  }`}
                >
                  {source.server}
                  <span className="ml-2 opacity-60">{source.quality}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Bottom Spacer */}
        <div className="h-10" />
      </div>
    </main>
  );
}
