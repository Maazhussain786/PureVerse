"use client";

import React, { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import { useUserState } from "../../../components/UserStateContext";
import SeasonSelector from "../../../components/SeasonSelector";
import MediaRow from "../../../components/MediaRow";
import NativePlayer from "../../../components/NativePlayer";

const API_BASE =
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000/api";

interface StreamSource {
  server?: string; // For TV/Movie iframes
  quality?: string;
  url: string;
  type?: string;
  isM3U8?: boolean;
}

interface StreamData {
  sources: StreamSource[];
  subtitles: any[];
  provider?: string;
  activeFormat?: string;
}

interface MediaDetails {
  id: string;
  type: string;
  title: string;
  posterUrl: string;
  bannerUrl: string;
  rating: number;
  releaseYear: number;
  synopsis: string;
  genres?: string[];
  totalSeasons?: number;
  totalEpisodes?: number;
  episodes?: any[];
}

function proxyImage(url: string): string {
  if (!url) return "";
  if (url.includes("myanimelist.net")) {
    return `/api/proxy/image?url=${encodeURIComponent(url)}`;
  }
  return url;
}

export default function WatchPage() {
  const params = useParams();
  const searchParams = useSearchParams();

  const type = params.type as string;
  const id = params.id as string;
  const season = searchParams.get("season");
  const episode = searchParams.get("episode");

  const { addToHistory, isInWatchlist, addToWatchlist, removeFromWatchlist } = useUserState();

  const [streamData, setStreamData] = useState<StreamData | null>(null);
  const [activeSourceIdx, setActiveSourceIdx] = useState(0);
  const [animeFormat, setAnimeFormat] = useState<"sub" | "dub">("sub");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [details, setDetails] = useState<MediaDetails | null>(null);
  const [recommendations, setRecommendations] = useState<any[]>([]);
  const [animeFallback, setAnimeFallback] = useState(false);
  const [pingStatus, setPingStatus] = useState("");

  // Health check a mirror URL to bypass local ISP blocks
  const checkMirrorHealth = async (url: string) => {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 2000);
      
      // Send a silent no-cors ping. If the ISP blocks it, fetch will throw or abort.
      await fetch(url, { mode: 'no-cors', signal: controller.signal });
      clearTimeout(timeoutId);
      return true;
    } catch (e) {
      return false; // Mirror is blocked by ISP or dead
    }
  };

  // Fetch stream
  useEffect(() => {
    async function fetchStream() {
      try {
        setLoading(true);
        setError(false);
        setStreamData(null);
        setActiveSourceIdx(0);

        let url = "";
        if (type === "anime" && !animeFallback) {
          if (!details) return; // Wait until details are fetched for the title
          url = `${API_BASE}/anime/stream?title=${encodeURIComponent(details.title)}&episode=${episode || 1}&type=${animeFormat}`;
        } else {
          const queryType = type === "anime" ? "tv" : type;
          url = `${API_BASE}/media/stream/${queryType}/${id}`;
          const queryParts: string[] = [];
          if (season) queryParts.push(`season=${season}`);
          if (episode) queryParts.push(`episode=${episode}`);
          if (queryParts.length > 0) url += `?${queryParts.join("&")}`;
        }

        const res = await fetch(url);
        if (!res.ok) throw new Error("Failed to fetch stream");
        const json = await res.json();
        
        if (type === "anime" && !animeFallback) {
          if (json.status === "error") throw new Error(json.message);
          setStreamData(json);
        } else {
          // Fallback or Movie/TV: We got a list of iframe mirrors.
          // Now we must find one that isn't blocked by the local regional ISP.
          const sources = json.data?.sources || [];
          let foundHealthyMirror = false;
          
          for (let i = 0; i < sources.length; i++) {
            const mirror = sources[i];
            if (mirror.type === "embed") {
              setPingStatus(`Checking mirror: ${mirror.server}...`);
              const isHealthy = await checkMirrorHealth(mirror.url);
              if (isHealthy) {
                setStreamData(json.data);
                setActiveSourceIdx(i);
                foundHealthyMirror = true;
                setPingStatus("");
                break;
              }
            } else {
              // Direct video files don't need iframe proxy pinging
              setStreamData(json.data);
              setActiveSourceIdx(i);
              foundHealthyMirror = true;
              setPingStatus("");
              break;
            }
          }
          
          if (!foundHealthyMirror) {
            throw new Error("All proxy mirrors are blocked by local ISP");
          }
        }
      } catch (err) {
        if (type === "anime" && !animeFallback) {
          setAnimeFallback(true);
        } else {
          setError(true);
        }
      } finally {
        // Only set loading to false if we are not in the middle of a fallback state transition
        setLoading(false);
      }
    }
    
    if (type !== "anime" || details || animeFallback) {
      fetchStream();
    }
  }, [type, id, season, episode, details, animeFormat, animeFallback]);

  // Fetch details
  useEffect(() => {
    async function fetchDetails() {
      try {
        const res = await fetch(`${API_BASE}/media/details/${type}/${id}`);
        if (res.ok) {
          const json = await res.json();
          setDetails(json.data || null);
        }
      } catch { /* ignore */ }
    }
    fetchDetails();
  }, [type, id]);

  // Fetch recommendations
  useEffect(() => {
    async function fetchRecs() {
      try {
        const res = await fetch(`${API_BASE}/media/recommendations/${type}/${id}`);
        if (res.ok) {
          const json = await res.json();
          setRecommendations(json.data || []);
        }
      } catch { /* ignore */ }
    }
    fetchRecs();
  }, [type, id]);

  // Record watch history
  const recordHistory = useCallback(() => {
    if (!details) return;
    addToHistory({
      id: details.id,
      type: details.type,
      title: details.title,
      posterUrl: details.posterUrl,
      rating: details.rating,
      releaseYear: details.releaseYear,
      season: season ? parseInt(season) : undefined,
      episode: episode ? parseInt(episode) : undefined,
      progress: 30, // Initial progress marker
    });
  }, [details, season, episode, addToHistory]);

  useEffect(() => {
    if (details && !loading && !error) {
      recordHistory();
    }
  }, [details, loading, error, recordHistory]);

  const activeSource = streamData?.sources?.[activeSourceIdx];
  const inWatchlist = details ? isInWatchlist(details.id) : false;

  const handleWatchlistToggle = () => {
    if (!details) return;
    if (inWatchlist) {
      removeFromWatchlist(details.id);
    } else {
      addToWatchlist({
        id: details.id,
        type: details.type,
        title: details.title,
        posterUrl: details.posterUrl,
        rating: details.rating,
        releaseYear: details.releaseYear,
      });
    }
  };

  // Build episode title
  const episodeTitle = details?.episodes?.find(
    (ep: any) => ep.episodeNumber === (episode ? parseInt(episode) : 1)
  )?.title;

  return (
    <main className="min-h-screen bg-[var(--bg-primary)] pt-16">
      <div className="w-full max-w-[1400px] mx-auto px-4 md:px-6 pt-4">
        {/* ─── Video Player ─── */}
        <div className="relative w-full aspect-video rounded-2xl overflow-hidden bg-black ring-1 ring-white/5 shadow-[0_8px_40px_rgba(0,0,0,0.8)]">
          {loading && (
            <div className="absolute inset-0 flex items-center justify-center bg-black">
              <div className="flex flex-col items-center gap-4">
                <div className="w-12 h-12 border-2 border-[var(--accent-primary)] border-t-transparent rounded-full animate-spin" />
                <p className="text-sm text-[var(--text-muted)] font-medium">
                  {pingStatus || (type === "anime" && !animeFallback ? "Bypassing server security..." : "Loading stream...")}
                </p>
              </div>
            </div>
          )}

          {error && (
            <div className="absolute inset-0 flex items-center justify-center bg-black">
              <div className="text-center">
                <div className="w-16 h-16 rounded-full bg-red-500/10 flex items-center justify-center mx-auto mb-4">
                  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#f87171" strokeWidth="2">
                    <circle cx="12" cy="12" r="10" />
                    <path d="M12 8v4" />
                    <path d="M12 16h.01" />
                  </svg>
                </div>
                <p className="text-lg font-semibold text-white mb-2">
                  Stream Unavailable
                </p>
                <p className="text-sm text-[var(--text-muted)] mb-5 max-w-sm">
                  This could be a temporary issue. Try a different server or come back later.
                </p>
                <Link href="/" className="btn-primary text-sm px-6 py-2.5">
                  Back to Home
                </Link>
              </div>
            </div>
          )}

          {!loading && !error && activeSource && (
            type === "anime" && !animeFallback ? (
              <NativePlayer 
                url={activeSource.url} 
                subtitles={streamData?.subtitles} 
                poster={details?.bannerUrl || details?.posterUrl}
              />
            ) : (
              <iframe
                key={activeSource.url}
                src={activeSource.url}
                className="w-full h-full border-none"
                allowFullScreen
                allow="autoplay; fullscreen; encrypted-media; picture-in-picture"
                referrerPolicy="origin"
              />
            )
          )}
        </div>

        {/* ─── Content Info Bar ─── */}
        <div className="mt-5 glass-panel rounded-xl p-5 md:p-6">
          <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
            {/* Left: Media Info */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-2">
                <span className={`type-pill type-pill-${details?.type || type}`}>
                  {type === "tv" ? "Series" : type === "anime" ? "Anime" : "Movie"}
                </span>
                {details?.rating && details.rating > 0 && (
                  <span className="flex items-center gap-1 text-sm font-semibold text-[#facc15]">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
                      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                    </svg>
                    {details.rating.toFixed(1)}
                  </span>
                )}
                {details?.releaseYear && details.releaseYear > 0 && (
                  <span className="text-sm text-[var(--text-muted)]">{details.releaseYear}</span>
                )}
              </div>
              <h1
                className="text-xl md:text-2xl font-bold text-white mb-1"
                style={{ fontFamily: "var(--font-space)" }}
              >
                {details?.title || "Now Playing"}
              </h1>
              {season && episode && (
                <p className="text-sm text-[var(--accent-primary)] font-semibold mb-2">
                  Season {season} · Episode {episode}
                  {episodeTitle && ` — ${episodeTitle}`}
                </p>
              )}
              {details?.synopsis && (
                <p className="text-sm text-[var(--text-secondary)] line-clamp-2 max-w-3xl leading-relaxed">
                  {details.synopsis}
                </p>
              )}
            </div>

            {/* Right: Action Buttons & Anime Sub/Dub */}
            <div className="flex flex-col md:flex-row items-start md:items-center gap-4 flex-shrink-0">
              {/* Right: Sub/Dub Toggle for Anime */}
              {type === "anime" && !animeFallback && (
                <div className="flex bg-white/5 rounded-full p-1 mt-4 md:mt-0 border border-white/10 shadow-inner">
                  <button
                    onClick={() => setAnimeFormat("sub")}
                    className={`px-4 py-1.5 rounded-full text-xs font-bold transition-all ${
                      animeFormat === "sub" ? "bg-[var(--accent-primary)] text-black" : "text-white hover:text-[var(--accent-primary)]"
                    }`}
                  >
                    SUB
                  </button>
                  <button
                    onClick={() => setAnimeFormat("dub")}
                    className={`px-4 py-1.5 rounded-full text-xs font-bold transition-all ${
                      animeFormat === "dub" ? "bg-[var(--accent-primary)] text-black" : "text-white hover:text-[var(--accent-primary)]"
                    }`}
                  >
                    DUB
                  </button>
                </div>
              )}
              
              <div className="flex items-center gap-3">
                <button
                  onClick={handleWatchlistToggle}
                  className={`btn-glass text-xs px-4 py-2.5 ${inWatchlist ? "border-[var(--accent-primary)]/40 text-[var(--accent-primary)]" : ""}`}
                >
                  {inWatchlist ? (
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" strokeWidth="2">
                      <path d="M20 6 9 17l-5-5" />
                    </svg>
                  ) : (
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M12 5v14M5 12h14" />
                    </svg>
                  )}
                  {inWatchlist ? "In My List" : "My List"}
                </button>
                <Link
                  href={`/details/${type}/${id}`}
                  className="btn-glass text-xs px-4 py-2.5"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="12" cy="12" r="10" />
                    <path d="M12 16v-4" />
                    <path d="M12 8h.01" />
                  </svg>
                  Details
                </Link>
              </div>
            </div>
          </div>
        </div>

        {/* ─── Server Selector ─── */}
        {streamData && streamData.sources.length > 0 && (
          <div className="mt-4 glass-panel rounded-xl p-5">
            <h3 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--accent-primary)" strokeWidth="2">
                <rect width="20" height="8" x="2" y="2" rx="2" ry="2" />
                <rect width="20" height="8" x="2" y="14" rx="2" ry="2" />
                <line x1="6" x2="6.01" y1="6" y2="6" />
                <line x1="6" x2="6.01" y1="18" y2="18" />
              </svg>
              {type === "anime" ? "Select Quality" : "Select Server"}
              {streamData.provider && (
                <span className="ml-3 text-xs px-2 py-1 bg-[var(--accent-primary)]/10 text-[var(--accent-primary)] rounded border border-[var(--accent-primary)]/30">
                  {streamData.provider}
                </span>
              )}
            </h3>
            <div className="flex flex-wrap gap-2">
              {streamData.sources.map((source, idx) => {
                const label = type === "anime" ? `${source.quality}` : source.server;
                const subLabel = type === "anime" ? "" : source.quality;
                return (
                  <button
                    key={`${source.url}-${idx}`}
                    onClick={() => setActiveSourceIdx(idx)}
                    className={`px-4 py-2 rounded-lg text-xs font-medium transition-all duration-200 ${
                      activeSourceIdx === idx
                        ? "bg-[var(--accent-primary)] text-black shadow-[0_0_15px_var(--accent-glow)] font-bold"
                        : "glass-panel text-[var(--text-secondary)] hover:text-white hover:bg-white/10"
                    }`}
                  >
                    {label}
                    {subLabel && <span className="ml-2 opacity-60">{subLabel}</span>}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* ─── Season & Episode Selector (for TV/anime) ─── */}
        {details && (details.type === "tv" || details.type === "anime") && details.totalSeasons && details.totalSeasons > 0 && (
          <div className="mt-6 glass-panel rounded-xl p-5 md:p-6">
            <SeasonSelector
              mediaId={details.id}
              mediaType={details.type}
              totalSeasons={details.totalSeasons}
              initialEpisodes={details.episodes}
              initialSeason={details.totalSeasons}
              currentEpisode={episode ? parseInt(episode) : undefined}
              mode="watch"
            />
          </div>
        )}

        {/* ─── More Like This ─── */}
        {recommendations.length > 0 && (
          <div className="mt-8">
            <MediaRow
              title="More Like This"
              items={recommendations}
            />
          </div>
        )}

        {/* Bottom Spacer */}
        <div className="h-10" />
      </div>
    </main>
  );
}
