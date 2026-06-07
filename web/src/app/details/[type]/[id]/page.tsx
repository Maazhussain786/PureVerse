"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useUserState } from "../../../components/UserStateContext";
import SeasonSelector from "../../../components/SeasonSelector";
import MediaRow from "../../../components/MediaRow";

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
}

export default function DetailsPage() {
  const params = useParams();
  const type = params.type as string;
  const id = params.id as string;

  const { isInWatchlist, addToWatchlist, removeFromWatchlist } = useUserState();

  const [media, setMedia] = useState<MediaDetailsData | null>(null);
  const [recommendations, setRecommendations] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchDetails() {
      try {
        setLoading(true);
        const res = await fetch(`${API_BASE}/media/details/${type}/${id}`, {
          cache: "no-store",
        });
        if (res.ok) {
          const json = await res.json();
          setMedia(json.data || null);
        }
      } catch { /* ignore */ } finally {
        setLoading(false);
      }
    }
    fetchDetails();
  }, [type, id]);

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

  if (loading) {
    return (
      <main className="min-h-screen pt-16">
        <div className="relative w-full h-[50vh] md:h-[60vh] bg-[var(--bg-secondary)]">
          <div className="absolute inset-0 bg-gradient-to-t from-[var(--bg-primary)] via-[var(--bg-primary)]/60 to-transparent" />
        </div>
        <div className="relative z-10 -mt-52 md:-mt-64 px-6 md:px-10 lg:px-14 max-w-[1400px] mx-auto">
          <div className="flex flex-col md:flex-row gap-8 md:gap-12 animate-pulse">
            <div className="skeleton w-[200px] md:w-[260px] aspect-[2/3] rounded-2xl mx-auto md:mx-0" />
            <div className="flex-1 pt-4 md:pt-20 space-y-4">
              <div className="skeleton w-24 h-6 rounded-full" />
              <div className="skeleton w-3/4 h-12 rounded-lg" />
              <div className="skeleton w-full h-4 rounded" />
              <div className="skeleton w-2/3 h-4 rounded" />
              <div className="flex gap-4 mt-6">
                <div className="skeleton w-40 h-12 rounded-lg" />
                <div className="skeleton w-32 h-12 rounded-lg" />
              </div>
            </div>
          </div>
        </div>
      </main>
    );
  }

  if (!media) {
    return (
      <main className="min-h-screen pt-24 flex items-center justify-center">
        <div className="text-center">
          <div className="w-20 h-20 rounded-full bg-[var(--bg-card)] flex items-center justify-center mx-auto mb-4">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="1.5">
              <circle cx="12" cy="12" r="10" />
              <path d="M12 8v4" />
              <path d="M12 16h.01" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-white mb-3">Media Not Found</h1>
          <p className="text-[var(--text-muted)] mb-6">
            Could not load details. Make sure the backend is running.
          </p>
          <Link href="/" className="btn-primary">
            Back to Home
          </Link>
        </div>
      </main>
    );
  }

  const ratingColor =
    media.rating >= 7
      ? "text-green-400"
      : media.rating >= 5
        ? "text-yellow-400"
        : "text-red-400";

  const inWatchlist = isInWatchlist(media.id);

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

  return (
    <main className="min-h-screen">
      {/* Backdrop Banner */}
      <div className="relative w-full h-[50vh] md:h-[60vh]">
        {media.bannerUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={proxyImage(media.bannerUrl)}
            alt=""
            className="absolute inset-0 w-full h-full object-cover"
            referrerPolicy="no-referrer"
          />
        ) : (
          <div className="absolute inset-0 bg-[var(--bg-secondary)]" />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-[var(--bg-primary)] via-[var(--bg-primary)]/60 to-transparent" />
        <div className="absolute inset-0 bg-gradient-to-r from-[var(--bg-primary)]/70 via-transparent to-transparent" />
      </div>

      {/* Content */}
      <div className="relative z-10 -mt-52 md:-mt-64 px-6 md:px-10 lg:px-14 max-w-[1400px] mx-auto">
        <div className="flex flex-col md:flex-row gap-8 md:gap-12">
          {/* Poster */}
          <div className="flex-shrink-0 w-[200px] md:w-[260px] mx-auto md:mx-0">
            <div className="aspect-[2/3] rounded-2xl overflow-hidden shadow-2xl ring-1 ring-white/10">
              {media.posterUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={proxyImage(media.posterUrl)}
                  alt={media.title}
                  className="w-full h-full object-cover"
                  referrerPolicy="no-referrer"
                />
              ) : (
                <div className="w-full h-full bg-[var(--bg-card)] flex items-center justify-center text-[var(--text-muted)]">
                  No Image
                </div>
              )}
            </div>
          </div>

          {/* Info */}
          <div className="flex-1 pt-4 md:pt-20">
            {/* Type & Rating */}
            <div className="flex flex-wrap items-center gap-2 mb-4">
              <span className={`type-pill type-pill-${media.type}`}>
                {media.type === "tv" ? "Series" : media.type}
              </span>
              {media.rating > 0 && (
                <span className={`text-sm font-semibold ${ratingColor} flex items-center gap-1`}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                    <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                  </svg>
                  {media.rating.toFixed(1)}
                </span>
              )}
              {media.releaseYear > 0 && (
                <span className="text-sm text-[var(--text-muted)]">
                  {media.releaseYear}
                </span>
              )}
              {media.runtime && (
                <span className="text-sm text-[var(--text-muted)]">
                  {media.runtime} min
                </span>
              )}
              {media.status && (
                <span className="text-xs text-[var(--text-muted)] glass-panel px-2 py-0.5 rounded-full">
                  {media.status}
                </span>
              )}
            </div>

            {/* Title */}
            <h1
              className="text-3xl md:text-4xl lg:text-5xl font-bold mb-4 leading-tight"
              style={{ fontFamily: "var(--font-space)" }}
            >
              {media.title}
            </h1>

            {/* Genres */}
            {media.genres && media.genres.length > 0 && (
              <div className="flex flex-wrap gap-2 mb-5">
                {media.genres.map((genre: string) => (
                  <span
                    key={genre}
                    className="text-xs text-[var(--text-secondary)] border border-white/10 rounded-full px-3 py-1 hover:border-white/20 transition-colors"
                  >
                    {genre}
                  </span>
                ))}
              </div>
            )}

            {/* Synopsis */}
            <p className="text-[var(--text-secondary)] text-sm md:text-base leading-relaxed mb-6 max-w-3xl">
              {media.synopsis || "No synopsis available."}
            </p>

            {/* Season/Episode Stats */}
            {(media.totalSeasons || media.totalEpisodes) && (
              <div className="flex gap-6 mb-6">
                {media.totalSeasons && (
                  <div>
                    <p className="text-2xl font-bold text-white">{media.totalSeasons}</p>
                    <p className="text-xs text-[var(--text-muted)] uppercase tracking-wider">Seasons</p>
                  </div>
                )}
                {media.totalEpisodes && (
                  <div>
                    <p className="text-2xl font-bold text-white">{media.totalEpisodes}</p>
                    <p className="text-xs text-[var(--text-muted)] uppercase tracking-wider">Episodes</p>
                  </div>
                )}
              </div>
            )}

            {/* CTA Buttons */}
            <div className="flex flex-wrap items-center gap-3">
              <Link
                href={`/watch/${type}/${id}`}
                className="bg-[var(--accent-primary)] hover:bg-[var(--accent-hover)] text-black font-black uppercase tracking-wider text-sm px-8 py-3.5 rounded-lg flex items-center gap-2.5 transition-all shadow-[0_0_20px_var(--accent-glow)] hover:shadow-[0_0_30px_var(--accent-glow)] hover:scale-[1.03] active:scale-[0.98]"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                  <polygon points="5 3 19 12 5 21 5 3" />
                </svg>
                Watch Now
              </Link>
              <button
                onClick={handleWatchlistToggle}
                className={`btn-glass text-sm px-6 py-3 ${inWatchlist ? "border-[var(--accent-primary)]/40 text-[var(--accent-primary)]" : ""}`}
              >
                {inWatchlist ? (
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" strokeWidth="2">
                    <path d="M20 6 9 17l-5-5" />
                  </svg>
                ) : (
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M12 5v14M5 12h14" />
                  </svg>
                )}
                {inWatchlist ? "In My List" : "Add to List"}
              </button>
              {media.trailerUrl && (
                <a
                  href={media.trailerUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn-glass text-sm"
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="m16 13 5.223 3.482a.5.5 0 0 0 .777-.416V7.934a.5.5 0 0 0-.777-.416L16 11" />
                    <rect width="14" height="12" x="2" y="6" rx="2" />
                  </svg>
                  Trailer
                </a>
              )}
            </div>
          </div>
        </div>

        {/* Cast Section */}
        {media.cast && media.cast.length > 0 && (
          <section className="mt-14">
            <h2
              className="text-xl font-bold mb-6 flex items-center gap-3"
              style={{ fontFamily: "var(--font-space)" }}
            >
              <div className="w-1 h-5 rounded-full bg-[var(--accent-primary)]" />
              Cast
            </h2>
            <div className="flex gap-4 overflow-x-auto pb-4 hide-scrollbar">
              {media.cast.map((person: any, i: number) => (
                <div
                  key={`${person.name}-${i}`}
                  className="flex-none w-[100px] text-center group"
                >
                  <div className="w-[80px] h-[80px] mx-auto rounded-full overflow-hidden glass-panel mb-2 ring-2 ring-transparent group-hover:ring-[var(--accent-primary)]/30 transition-all">
                    {person.profileUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={proxyImage(person.profileUrl)}
                        alt={person.name}
                        className="w-full h-full object-cover"
                        loading="lazy"
                        referrerPolicy="no-referrer"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-[var(--text-muted)] text-lg bg-[var(--bg-elevated)]">
                        {person.name?.charAt(0) || "?"}
                      </div>
                    )}
                  </div>
                  <p className="text-xs font-medium text-white truncate">
                    {person.name}
                  </p>
                  <p className="text-[10px] text-[var(--text-muted)] truncate">
                    {person.character}
                  </p>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Season & Episode Selector (for TV shows with seasons) */}
        {media.totalSeasons && media.totalSeasons > 0 && (
          <section className="mt-14">
            <SeasonSelector
              mediaId={media.id}
              mediaType={media.type}
              totalSeasons={media.totalSeasons}
              initialEpisodes={media.episodes}
              initialSeason={media.totalSeasons}
              mode="details"
            />
          </section>
        )}

        {/* Episodes for anime (no season concept) */}
        {!media.totalSeasons && media.episodes && media.episodes.length > 0 && (
          <section className="mt-14">
            <h2
              className="text-xl font-bold mb-6 flex items-center gap-3"
              style={{ fontFamily: "var(--font-space)" }}
            >
              <div className="w-1 h-5 rounded-full bg-[var(--accent-primary)]" />
              Episodes
            </h2>
            <div className="grid gap-3">
              {media.episodes.map((ep: any) => (
                <Link
                  key={ep.id}
                  href={`/watch/${type}/${id}?season=${ep.seasonNumber || 1}&episode=${ep.episodeNumber}`}
                  className="episode-card rounded-xl p-4 flex gap-4 items-center border border-white/5 group"
                >
                  <div className="flex-shrink-0 w-[120px] md:w-[160px] aspect-video rounded-lg overflow-hidden bg-[var(--bg-card)] relative">
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
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor" className="opacity-30">
                          <polygon points="5 3 19 12 5 21 5 3" />
                        </svg>
                      </div>
                    )}
                    <div className="absolute bottom-1 right-1 bg-black/70 text-[10px] font-bold text-white px-1.5 py-0.5 rounded">
                      {ep.episodeNumber}
                    </div>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-[var(--text-muted)] mb-1">
                      {ep.seasonNumber ? `S${ep.seasonNumber} · ` : ""}E{ep.episodeNumber}
                      {ep.airDate ? ` · ${ep.airDate}` : ""}
                    </p>
                    <h3 className="text-sm font-medium text-white truncate group-hover:text-[var(--accent-primary)] transition-colors">
                      {ep.title}
                    </h3>
                    {ep.synopsis && (
                      <p className="text-xs text-[var(--text-muted)] mt-1 line-clamp-2">
                        {ep.synopsis}
                      </p>
                    )}
                  </div>
                </Link>
              ))}
            </div>
          </section>
        )}

        {/* Trailer Embed */}
        {media.trailerUrl && (
          <section className="mt-14">
            <h2
              className="text-xl font-bold mb-6 flex items-center gap-3"
              style={{ fontFamily: "var(--font-space)" }}
            >
              <div className="w-1 h-5 rounded-full bg-[var(--accent-primary)]" />
              Trailer
            </h2>
            <div className="w-full max-w-3xl aspect-video rounded-2xl overflow-hidden ring-1 ring-white/10">
              <iframe
                src={media.trailerUrl}
                className="w-full h-full"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
                title="Trailer"
              />
            </div>
          </section>
        )}

        {/* More Like This */}
        {recommendations.length > 0 && (
          <section className="mt-14">
            <MediaRow
              title="More Like This"
              items={recommendations}
            />
          </section>
        )}

        {/* Bottom Spacer */}
        <div className="h-20" />
      </div>
    </main>
  );
}
