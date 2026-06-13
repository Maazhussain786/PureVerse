"use client";

import React, { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useUserState } from "../../../components/UserStateContext";
import EpisodeBrowser from "../../../components/EpisodeBrowser";
import MediaRow from "../../../components/MediaRow";
import useDragScroll from "../../../hooks/useDragScroll";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000/api";

function proxyImage(url: string): string {
  if (!url) return "";
  if (url.includes("myanimelist.net")) {
    return `${API_BASE}/proxy/image?url=${encodeURIComponent(url)}`;
  }
  return url;
}

interface MediaDetailsData {
  id: string;
  type: string;
  source: string;
  title: string;
  posterUrl: string;
  bannerUrl: string;
  rating: number;
  releaseYear: number;
  genres: string[];
  synopsis: string;
  cast: { name: string; character: string; profileUrl: string }[];
  episodes: any[];
  trailerUrl?: string;
  runtime?: number;
  status?: string;
  totalSeasons?: number;
  totalEpisodes?: number;
  originalTitle?: string;
  tagline?: string;
  voteCount?: number;
  popularity?: number;
  language?: string;
  studios?: string[];
  ageRating?: string;
  releaseDate?: string;
}

// ── Formatting helpers ──
function formatRuntime(min?: number): string | null {
  if (!min) return null;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}
function formatCompact(n?: number): string | null {
  if (n === undefined || n === null) return null;
  if (n >= 1e6) return (n / 1e6).toFixed(1).replace(/\.0$/, "") + "M";
  if (n >= 1e3) return (n / 1e3).toFixed(1).replace(/\.0$/, "") + "K";
  return String(Math.round(n));
}
function formatDate(iso?: string): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}
function typeLabel(type: string): string {
  if (type === "tv") return "Series";
  if (type === "movie") return "Movie";
  if (type === "anime") return "Anime";
  return type;
}

const focusRing =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-primary)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--bg-primary)]";

export default function DetailsPage() {
  const params = useParams();
  const type = params.type as string;
  const id = params.id as string;

  const { isInWatchlist, addToWatchlist, removeFromWatchlist, watchHistory, addToHistory } = useUserState();

  const [media, setMedia] = useState<MediaDetailsData | null>(null);
  const [recommendations, setRecommendations] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [shareState, setShareState] = useState<"idle" | "copied">("idle");
  const [watchedState, setWatchedState] = useState<"idle" | "done">("idle");
  const trailerRef = useRef<HTMLDivElement>(null);
  const castRef = useRef<HTMLDivElement>(null);
  useDragScroll(castRef);

  useEffect(() => {
    let cancelled = false;
    async function fetchDetails() {
      try {
        setLoading(true);
        const res = await fetch(`${API_BASE}/media/details/${type}/${id}`, { cache: "no-store" });
        if (res.ok) {
          const json = await res.json();
          if (!cancelled) setMedia(json.data || null);
        }
      } catch { /* ignore */ } finally {
        if (!cancelled) setLoading(false);
      }
    }
    fetchDetails();
    return () => { cancelled = true; };
  }, [type, id]);

  useEffect(() => {
    let cancelled = false;
    async function fetchRecs() {
      try {
        const res = await fetch(`${API_BASE}/media/recommendations/${type}/${id}`);
        if (res.ok) {
          const json = await res.json();
          if (!cancelled) setRecommendations(json.data || []);
        }
      } catch { /* ignore */ }
    }
    fetchRecs();
    return () => { cancelled = true; };
  }, [type, id]);

  // ── Loading skeleton ──
  if (loading) {
    return (
      <main className="min-h-screen flex items-center justify-center">
        <LoadingSpinner />
      </main>
    );
  }

  // ── Not found ──
  if (!media) {
    return (
      <main className="min-h-screen pt-24 flex items-center justify-center">
        <div className="text-center">
          <img src="/logos/Small_logo.png" alt="PureVerse" className="w-14 h-14 mx-auto mb-5 rounded-xl object-contain opacity-80" />
          <h1 className="text-2xl font-bold text-white mb-3">Title unavailable</h1>
          <p className="text-[var(--text-muted)] mb-6">We couldn&apos;t load this title. Make sure the backend is running.</p>
          <Link href="/" className="btn-primary inline-flex">Back to Home</Link>
        </div>
      </main>
    );
  }

  const inWatchlist = isInWatchlist(media.id);

  // Continue-watching detection (most recent in-progress entry for this title)
  const continueEntry = watchHistory
    .filter((h) => h.id === media.id && h.progress > 0 && h.progress < 95)
    .sort((a, b) => b.lastWatched - a.lastWatched)[0];

  const primaryHref = continueEntry
    ? `/watch/${type}/${id}?season=${continueEntry.season || 1}&episode=${continueEntry.episode || 1}`
    : `/watch/${type}/${id}`;
  const primaryLabel = continueEntry
    ? `Continue${continueEntry.season ? ` S${continueEntry.season} E${continueEntry.episode}` : " Watching"}`
    : "Watch Now";

  const handleWatchlistToggle = () => {
    if (inWatchlist) {
      removeFromWatchlist(media.id);
    } else {
      addToWatchlist({
        id: media.id,
        type: media.type,
        title: media.title,
        posterUrl: media.posterUrl,
        rating: media.rating,
        releaseYear: media.releaseYear,
      });
    }
  };

  const handleShare = async () => {
    const url = typeof window !== "undefined" ? window.location.href : "";
    try {
      if (navigator.share) {
        await navigator.share({ title: media.title, url });
      } else {
        await navigator.clipboard.writeText(url);
        setShareState("copied");
        setTimeout(() => setShareState("idle"), 2000);
      }
    } catch { /* user cancelled */ }
  };

  const handleMarkWatched = () => {
    addToHistory({
      id: media.id,
      type: media.type,
      title: media.title,
      posterUrl: media.posterUrl,
      rating: media.rating,
      releaseYear: media.releaseYear,
      progress: 100,
    });
    setWatchedState("done");
    setTimeout(() => setWatchedState("idle"), 2000);
  };

  const scrollToTrailer = () => trailerRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });

  const backdrop = proxyImage(media.bannerUrl || media.posterUrl);

  // Metadata chips (only those with real data)
  const chips: { label: string; tone?: "rating" | "default" | "outline" }[] = [];
  if (media.rating > 0) chips.push({ label: `★ ${media.rating.toFixed(1)}`, tone: "rating" });
  if (media.releaseYear > 0) chips.push({ label: String(media.releaseYear) });
  const runtimeStr = formatRuntime(media.runtime);
  if (runtimeStr) chips.push({ label: runtimeStr });
  if (media.ageRating) chips.push({ label: media.ageRating, tone: "outline" });
  if (media.status) chips.push({ label: media.status, tone: "outline" });
  if (media.language) chips.push({ label: media.language });

  const recsTitle =
    type === "anime" ? "Similar Anime" : type === "movie" ? "Similar Movies" : type === "tv" ? "Similar Series" : "More Like This";

  return (
    <main className="min-h-screen pb-24 lg:pb-0">
      {/* ─── Cinematic Hero Section ─── */}
      <div className="relative w-full min-h-[85vh] lg:min-h-screen flex items-end pb-12 pt-32" style={{ paddingTop: "140px", paddingBottom: "48px", minHeight: "100vh" }}>
        {/* Background Image & Gradients */}
        <div className="absolute inset-0 overflow-hidden">
          {backdrop ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={backdrop}
              alt=""
              className="absolute inset-0 w-full h-full object-cover object-top animate-ken-burns"
              referrerPolicy="no-referrer"
            />
          ) : (
            <div className="absolute inset-0 bg-gradient-to-br from-[var(--bg-secondary)] to-[var(--bg-primary)]" />
          )}
          {/* Cinematic charcoal gradients (on-brand, no purple cast) */}
          <div className="absolute inset-0 bg-gradient-to-t from-[var(--bg-primary)] via-[var(--bg-primary)]/30 to-transparent opacity-100" />
          <div className="absolute inset-0 bg-gradient-to-r from-[var(--bg-primary)] via-[var(--bg-primary)]/70 to-transparent" />
          <div className="absolute inset-0 bg-[rgba(9,9,12,0.32)]" /> {/* neutral deepen */}
        </div>

        {/* ─── Content ─── */}
        <div className="relative z-10 px-5 md:px-10 lg:px-16 max-w-screen-2xl w-full">
          <div className="max-w-3xl">
            {/* Title */}
            <h1 
              className="text-5xl md:text-7xl lg:text-[5.5rem] font-bold leading-[1.05] text-white drop-shadow-[0_4px_24px_rgba(0,0,0,0.8)] mb-8 animate-fade-in-up"
              style={{ fontFamily: "var(--font-cinzel), serif", animationDelay: "200ms", marginBottom: "32px", lineHeight: "1.15" }}
            >
              {media.title}
            </h1>

            {/* Metadata (Year | Seasons | Genre | Stars) */}
            <div className="flex flex-wrap items-center gap-4 text-[15px] font-semibold text-white/95 drop-shadow-md mb-10 animate-fade-in-up" style={{ animationDelay: "300ms", marginBottom: "40px" }}>
              <span>{media.releaseYear || new Date().getFullYear()}</span>
              {media.totalSeasons ? <span>{media.totalSeasons} Seasons</span> : null}
              {!media.totalSeasons && runtimeStr ? <span>{runtimeStr}</span> : null}
              {media.genres?.[0] && (
                <span className="px-3 py-0.5 rounded-full border border-white/40 bg-white/10 backdrop-blur-sm">
                  {media.genres[0]}
                </span>
              )}
              {media.rating > 0 && (
                <div className="flex items-center gap-1 text-[#F6AD55]">
                  <div className="flex tracking-widest text-sm">★★★★★</div>
                  <span className="text-white ml-1.5 font-bold">{media.rating.toFixed(1)}</span>
                </div>
              )}
            </div>

            {/* Synopsis */}
            <p className="text-[15px] md:text-[17px] text-white/80 leading-relaxed mb-12 max-w-2xl drop-shadow-md animate-fade-in-up" style={{ animationDelay: "400ms", marginBottom: "48px" }}>
              {media.synopsis || "No synopsis available."}
            </p>

            {/* Action buttons */}
            <div className="flex items-center gap-4 animate-fade-in-up" style={{ animationDelay: "500ms" }}>
              {/* Play Button */}
              <Link href={primaryHref} className="flex items-center gap-4 group">
                <div className="w-[60px] h-[60px] rounded-full bg-white/10 backdrop-blur-md border border-white/20 flex items-center justify-center text-white group-hover:bg-white group-hover:text-black transition-all shadow-[0_0_20px_rgba(255,255,255,0.1)] group-hover:shadow-[0_0_30px_rgba(255,255,255,0.4)] group-active:scale-95">
                  <svg width="28" height="28" viewBox="0 0 24 24" fill="currentColor" className="ml-1">
                    <polygon points="5 3 19 12 5 21 5 3" />
                  </svg>
                </div>
                <span className="font-bold text-lg text-white group-hover:text-white/90 drop-shadow-md">
                  {primaryLabel}
                </span>
              </Link>

              {/* Add to Watchlist */}
              <button 
                onClick={handleWatchlistToggle} 
                className="w-12 h-12 rounded-full bg-white/10 backdrop-blur-md border border-white/20 flex items-center justify-center text-white hover:bg-white/20 transition-all ml-4 active:scale-95 shadow-lg"
                title={inWatchlist ? "Remove from Watchlist" : "Add to Watchlist"}
              >
                {inWatchlist ? (
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M20 6 9 17l-5-5" /></svg>
                ) : (
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M12 5v14M5 12h14" /></svg>
                )}
              </button>

              {/* Info / Trailer */}
              {media.trailerUrl && (
                <button 
                  onClick={scrollToTrailer} 
                  className="w-12 h-12 rounded-full bg-white/10 backdrop-blur-md border border-white/20 flex items-center justify-center text-white hover:bg-white/20 transition-all active:scale-95 shadow-lg"
                  title="Watch Trailer"
                >
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/></svg>
                </button>
              )}
            </div>

            {/* Additional Details (Netflix style) */}
            <div className="mt-16 mb-8 flex flex-col sm:flex-row gap-6 sm:gap-16 text-[15px] leading-relaxed text-[var(--text-muted)] animate-fade-in-up" style={{ animationDelay: "600ms", marginTop: "64px", marginBottom: "32px" }}>
              <div className="space-y-2.5">
                {media.genres && media.genres.length > 0 && (
                  <p><span className="text-white/60 font-semibold mr-2">Genres:</span> <span className="text-white/90">{media.genres.join(", ")}</span></p>
                )}
                {media.cast && media.cast.length > 0 && (
                  <p><span className="text-white/60 font-semibold mr-2">Cast:</span> <span className="text-white/90">{media.cast.slice(0, 3).map(c => c.name).join(", ")}{media.cast.length > 3 ? "..." : ""}</span></p>
                )}
              </div>
              <div className="space-y-2.5">
                {media.language && (
                  <p><span className="text-white/60 font-semibold mr-2">Language:</span> <span className="text-white/90">{media.language}</span></p>
                )}
                {media.status && (
                  <p><span className="text-white/60 font-semibold mr-2">Status:</span> <span className="text-white/90">{media.status}</span></p>
                )}
                {media.releaseDate && (
                  <p><span className="text-white/60 font-semibold mr-2">Released:</span> <span className="text-white/90">{formatDate(media.releaseDate)}</span></p>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="relative z-10 px-5 md:px-10 lg:px-16 max-w-screen-2xl mx-auto mt-16 md:mt-24" style={{ marginTop: "96px" }}>
        {/* ─── Cast ─── */}
        {media.cast && media.cast.length > 0 && (
          <section className="mt-14">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-1.5 h-7 rounded-full bg-[var(--accent-primary)] shadow-[0_0_10px_var(--accent-glow)]" />
              <h2 className="text-xl md:text-[26px] font-bold text-white tracking-tight" style={{ fontFamily: "var(--font-space)" }}>
                Cast &amp; Characters
              </h2>
            </div>
            <div ref={castRef} className="drag-scroll flex gap-5 overflow-x-auto pb-4 hide-scrollbar -mx-1 px-1">
              {media.cast.map((person, i) => (
                <div key={`${person.name}-${i}`} className="flex-none w-[104px] text-center group">
                  <div className="w-[96px] h-[96px] mx-auto rounded-full overflow-hidden mb-3 ring-2 ring-white/10 group-hover:ring-[var(--accent-primary)]/60 group-hover:shadow-[0_0_22px_var(--accent-glow)] transition-all duration-300 group-hover:scale-105">
                    {person.profileUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={proxyImage(person.profileUrl)} alt={person.name} className="w-full h-full object-cover" loading="lazy" referrerPolicy="no-referrer" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-xl font-bold text-[var(--text-muted)] bg-[var(--bg-elevated)]">
                        {person.name?.charAt(0) || "?"}
                      </div>
                    )}
                  </div>
                  <p className="text-xs font-semibold text-white truncate px-1">{person.name}</p>
                  {person.character && <p className="text-[11px] text-[var(--text-muted)] truncate px-1 mt-0.5">{person.character}</p>}
                </div>
              ))}
            </div>
          </section>
        )}

        {/* ─── Episodes (TV / Anime) ─── */}
        {((media.totalSeasons && media.totalSeasons > 0) || (media.episodes && media.episodes.length > 0)) && (
          <section className="mt-14">
            <EpisodeBrowser
              mediaId={media.id}
              mediaType={media.type}
              totalSeasons={media.totalSeasons || 1}
              initialSeason={1}
              initialEpisodes={!media.totalSeasons || media.totalSeasons <= 1 ? media.episodes : undefined}
            />
          </section>
        )}

        {/* ─── Trailer ─── */}
        {media.trailerUrl && (
          <section className="mt-14" ref={trailerRef}>
            <div className="flex items-center gap-3 mb-6">
              <div className="w-1.5 h-7 rounded-full bg-[var(--accent-teal)] shadow-[0_0_10px_var(--accent-teal-glow)]" />
              <h2 className="text-xl md:text-[26px] font-bold text-white tracking-tight" style={{ fontFamily: "var(--font-space)" }}>
                Official Trailer
              </h2>
            </div>
            <div className="w-full max-w-4xl aspect-video rounded-2xl overflow-hidden ring-1 ring-white/10 shadow-[0_16px_50px_rgba(0,0,0,0.5)]">
              <iframe
                src={media.trailerUrl}
                className="w-full h-full"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
                title={`${media.title} trailer`}
              />
            </div>
          </section>
        )}

        {/* ─── Recommendations ─── */}
        {recommendations.length > 0 && (
          <section className="mt-14">
            <MediaRow title={recsTitle} items={recommendations} layout="landscape" />
          </section>
        )}

        <div className="h-16" />
      </div>

      {/* ─── Sticky mobile CTA (sits above the bottom tab bar) ─── */}
      <div className="lg:hidden fixed bottom-0 inset-x-0 z-40 px-4 pt-10 pb-[calc(env(safe-area-inset-bottom)+72px)] bg-gradient-to-t from-[var(--bg-primary)] via-[var(--bg-primary)]/95 to-transparent pointer-events-none">
        <Link
          href={primaryHref}
          className={`pointer-events-auto btn-primary btn-lg btn-block ${focusRing}`}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><polygon points="6 4 20 12 6 20 6 4" /></svg>
          {primaryLabel}
        </Link>
      </div>
    </main>
  );
}
