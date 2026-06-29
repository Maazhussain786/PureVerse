"use client";

import React from "react";
import HeroSection from "./components/HeroSection";
import MediaRow from "./components/MediaRow";
import AnimeSpotlight from "./components/AnimeSpotlight";
import AppPromoBanner from "./components/AppPromoBanner";
import { useUserState } from "./components/UserStateContext";
import { HeroSkeleton, MediaRowSkeleton } from "./components/Skeletons";
import Link from "next/link";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000/api";

// Genres for the discovery strip — each links to real search results.
const GENRES = [
  "Action", "Adventure", "Comedy", "Drama", "Fantasy", "Sci-Fi",
  "Romance", "Thriller", "Horror", "Mystery", "Animation", "Crime",
];

// Client-side data fetcher
function useApiData(endpoint: string) {
  const [data, setData] = React.useState<any[]>([]);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    async function fetchData() {
      try {
        const res = await fetch(`${API_BASE}${endpoint}`);
        if (!res.ok) { setData([]); return; }
        const json = await res.json();
        setData(json.data || []);
      } catch {
        setData([]);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, [endpoint]);

  return { data, loading };
}

// Personalized "More Like This" — seeded from the user's most recent activity,
// using the real per-title recommendations endpoint (no fake data).
function usePersonalizedRecs(seedId?: string, seedType?: string) {
  const [data, setData] = React.useState<any[]>([]);

  React.useEffect(() => {
    if (!seedId || !seedType) { setData([]); return; }
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`${API_BASE}/media/recommendations/${seedType}/${seedId}`);
        if (!res.ok) return;
        const json = await res.json();
        if (!cancelled) setData(json.data || []);
      } catch { /* ignore */ }
    })();
    return () => { cancelled = true; };
  }, [seedId, seedType]);

  return data;
}

// Section icons
const icons = {
  fire: (
    <div className="w-7 h-7 rounded-lg bg-[rgba(249,115,22,0.15)] flex items-center justify-center">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#f97316" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z" />
      </svg>
    </div>
  ),
  movie: (
    <div className="w-7 h-7 rounded-lg bg-[rgba(0,216,246,0.15)] flex items-center justify-center">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#00D8F6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect width="18" height="18" x="3" y="3" rx="2" />
        <path d="M7 3v18" />
        <path d="M3 7.5h4" />
        <path d="M3 12h18" />
        <path d="M3 16.5h4" />
        <path d="M17 3v18" />
        <path d="M17 7.5h4" />
        <path d="M17 16.5h4" />
      </svg>
    </div>
  ),
  tv: (
    <div className="w-7 h-7 rounded-lg bg-[rgba(59,130,246,0.15)] flex items-center justify-center">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#3b82f6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="m16 13 5.223 3.482a.5.5 0 0 0 .777-.416V7.934a.5.5 0 0 0-.777-.416L16 11" />
        <rect width="14" height="12" x="2" y="6" rx="2" />
      </svg>
    </div>
  ),
  anime: (
    <div className="w-7 h-7 rounded-lg bg-[rgba(236,72,153,0.15)] flex items-center justify-center">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#ec4899" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 2L2 7l10 5 10-5-10-5Z" />
        <path d="m2 17 10 5 10-5" />
        <path d="m2 12 10 5 10-5" />
      </svg>
    </div>
  ),
  star: (
    <div className="w-7 h-7 rounded-lg bg-[rgba(234,179,8,0.15)] flex items-center justify-center">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#eab308" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
      </svg>
    </div>
  ),
  sparkle: (
    <div className="w-7 h-7 rounded-lg bg-[rgba(6,182,212,0.15)] flex items-center justify-center">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#06b6d4" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z" />
      </svg>
    </div>
  ),
  clock: (
    <div className="w-7 h-7 rounded-lg bg-[rgba(163,230,53,0.15)] flex items-center justify-center">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#a3e635" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10" />
        <polyline points="12 6 12 12 16 14" />
      </svg>
    </div>
  ),
  heart: (
    <div className="w-7 h-7 rounded-lg bg-[rgba(244,63,94,0.15)] flex items-center justify-center">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#f43f5e" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z" />
      </svg>
    </div>
  ),
  trophy: (
    <div className="w-7 h-7 rounded-lg bg-[var(--accent-subtle)] flex items-center justify-center">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--accent-primary)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6" />
        <path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18" />
        <path d="M4 22h16" />
        <path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22" />
        <path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22" />
        <path d="M18 2H6v7a6 6 0 0 0 12 0V2Z" />
      </svg>
    </div>
  ),
};

export default function Home() {
  const { continueWatching, watchlist, removeFromHistory } = useUserState();

  const { data: trendingAll, loading: loadingTrending } = useApiData("/trending");
  const { data: trendingMovies, loading: loadingMovies } = useApiData("/trending/movies");
  const { data: trendingSeries, loading: loadingSeries } = useApiData("/trending/series");
  const { data: trendingAnime, loading: loadingAnime } = useApiData("/trending/anime");
  const { data: popularAnime, loading: loadingPopularAnime } = useApiData("/popular/anime");
  const { data: topRatedMovies, loading: loadingTopMovies } = useApiData("/top-rated/movies");
  const { data: topRatedSeries, loading: loadingTopSeries } = useApiData("/top-rated/series");
  const { data: nowPlaying, loading: loadingNowPlaying } = useApiData("/now-playing");
  const { data: latestSeries, loading: loadingLatestSeries } = useApiData("/latest/series");

  // Personalized recommendations seeded from the most recent user activity.
  const recSeed = continueWatching[0] || watchlist[0];
  const personalized = usePersonalizedRecs(recSeed?.id, recSeed?.type);

  return (
    <main className="min-h-screen">
      {/* Hero Section — Carousel */}
      {!loadingTrending && trendingAll.length > 0 ? (
        <HeroSection items={trendingAll.slice(0, 5)} />
      ) : (
        <HeroSkeleton />
      )}

      {/* App Promotion Banner */}
      <AppPromoBanner />

      {/* Content Rows — premium OTT spacing (96px from hero, 64/32/20 padding) */}
      <div
        className="relative z-10 px-5 md:px-8 lg:px-16 w-full mx-auto"
        style={{ paddingTop: "var(--space-hero-to-section)" }}
      >

        {/* Continue Watching (real user data, resumes playback, X to remove) */}
        {continueWatching.length > 0 && (
          <MediaRow
            title="Continue Watching"
            items={continueWatching.map((item) => ({
              ...item,
              progress: item.progress,
              episodeLabel: item.season && item.episode ? `S${item.season} E${item.episode}` : undefined,
              href:
                item.season && item.episode
                  ? `/watch/${item.type}/${item.id}?season=${item.season}&episode=${item.episode}`
                  : `/watch/${item.type}/${item.id}`,
              onRemove: () => removeFromHistory(item.key),
            }))}
            icon={icons.clock}
          />
        )}

        {/* My List (real user data) */}
        {watchlist.length > 0 && (
          <MediaRow
            title="My List"
            items={watchlist}
            viewAllHref="/mylist"
            icon={icons.heart}
          />
        )}

        {/* Trending Now */}
        {!loadingTrending && trendingAll.length > 1 ? (
          <MediaRow
            title="Trending Now"
            items={trendingAll.slice(1, 20)}
            icon={icons.fire}
            layout="landscape"
          />
        ) : loadingTrending ? (
          <MediaRowSkeleton landscape />
        ) : null}

        {/* Top 10 Today (ranked landscape row) */}
        {!loadingTrending && trendingAll.length >= 3 ? (
          <MediaRow
            title="Top 10 Today"
            items={trendingAll.slice(0, 10)}
            icon={icons.trophy}
            ranked
            layout="landscape"
          />
        ) : null}

        {/* New & Now Airing — the latest series (currently airing + newest
            premieres), so brand-new shows surface in browse, not just by id. */}
        {!loadingLatestSeries && latestSeries.length > 0 ? (
          <MediaRow
            title="New & Now Airing"
            items={latestSeries}
            viewAllHref="/series"
            icon={icons.sparkle}
            layout="landscape"
          />
        ) : loadingLatestSeries ? (
          <MediaRowSkeleton landscape />
        ) : null}

        {/* Trending Movies — cinematic wide cards */}
        {!loadingMovies && trendingMovies.length > 0 ? (
          <MediaRow
            title="Trending Movies"
            items={trendingMovies}
            viewAllHref="/movies"
            icon={icons.movie}
            layout="landscape"
          />
        ) : loadingMovies ? (
          <MediaRowSkeleton landscape />
        ) : null}

        {/* Popular TV Series */}
        {!loadingSeries && trendingSeries.length > 0 ? (
          <MediaRow
            title="Popular TV Series"
            items={trendingSeries}
            viewAllHref="/series"
            icon={icons.tv}
            layout="landscape"
          />
        ) : loadingSeries ? (
          <MediaRowSkeleton landscape />
        ) : null}

        {/* Anime Spotlight — cinematic feature band (real trending-anime data) */}
        {!loadingAnime && trendingAnime.length > 0 && (
          <AnimeSpotlight item={trendingAnime[0]} />
        )}

        {/* Top Anime — poster cards */}
        {!loadingAnime && trendingAnime.length > 1 ? (
          <MediaRow
            title="Top Anime"
            items={trendingAnime.slice(1)}
            viewAllHref="/anime"
            icon={icons.anime}
          />
        ) : loadingAnime ? (
          <MediaRowSkeleton />
        ) : null}

        {/* New Releases */}
        {!loadingNowPlaying && nowPlaying.length > 0 ? (
          <MediaRow
            title="New Releases"
            items={nowPlaying}
            icon={icons.sparkle}
            layout="landscape"
          />
        ) : loadingNowPlaying ? (
          <MediaRowSkeleton landscape />
        ) : null}

        {/* Personalized — More Like <recent title> (real recommendations API) */}
        {recSeed && personalized.length > 0 && (
          <MediaRow
            title={`More Like ${recSeed.title}`}
            items={personalized}
            icon={icons.sparkle}
            layout="landscape"
          />
        )}

        {/* Top Rated Series */}
        {!loadingTopSeries && topRatedSeries.length > 0 ? (
          <MediaRow
            title="Top Rated Series"
            items={topRatedSeries}
            viewAllHref="/series"
            icon={icons.star}
            layout="landscape"
          />
        ) : loadingTopSeries ? (
          <MediaRowSkeleton landscape />
        ) : null}

        {/* Top Rated Movies */}
        {!loadingTopMovies && topRatedMovies.length > 0 ? (
          <MediaRow
            title="Top Rated Movies"
            items={topRatedMovies}
            viewAllHref="/movies"
            icon={icons.star}
            layout="landscape"
          />
        ) : loadingTopMovies ? (
          <MediaRowSkeleton landscape />
        ) : null}

        {/* Popular Anime — poster cards */}
        {!loadingPopularAnime && popularAnime.length > 0 ? (
          <MediaRow
            title="Popular Anime"
            items={popularAnime}
            viewAllHref="/anime"
            icon={icons.anime}
          />
        ) : loadingPopularAnime ? (
          <MediaRowSkeleton />
        ) : null}

        {/* Browse by Genre — Search & Discovery */}
        <section style={{ marginBottom: "var(--space-section)" }}>
          <div className="flex items-center justify-between px-1" style={{ marginBottom: "var(--space-title-to-content)" }}>
            <div className="flex items-center gap-3">
              <div className="w-7 h-7 rounded-lg bg-[var(--accent-subtle)] flex items-center justify-center">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--accent-primary)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10" />
                  <polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76" />
                </svg>
              </div>
              <h2 className="text-xl md:text-[28px] font-bold text-white tracking-tight" style={{ fontFamily: "var(--font-space)" }}>
                Browse by Genre
              </h2>
            </div>
            <Link
              href="/search"
              className="group/all flex items-center gap-1.5 text-xs font-semibold text-[var(--text-secondary)] hover:text-[var(--accent-primary)] transition-colors mr-2"
            >
              Search all
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="transition-transform group-hover/all:translate-x-0.5">
                <path d="m9 18 6-6-6-6" />
              </svg>
            </Link>
          </div>
          <div className="flex flex-wrap gap-3">
            {GENRES.map((g) => (
              <Link
                key={g}
                href={`/search?q=${encodeURIComponent(g)}`}
                className="px-5 py-2.5 rounded-full glass-panel text-sm font-semibold text-[var(--text-secondary)] hover:text-black hover:bg-[var(--accent-primary)] hover:shadow-[0_0_18px_var(--accent-glow)] transition-all duration-200"
              >
                {g}
              </Link>
            ))}
          </div>
        </section>

        {/* Footer */}
        <footer className="mt-12 mb-10 pt-8 border-t border-white/5">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 mb-8">
            <div>
              <h4 className="text-sm font-semibold text-white mb-3">Browse</h4>
              <div className="flex flex-col gap-2">
                <Link href="/movies" className="footer-link">Movies</Link>
                <Link href="/series" className="footer-link">TV Series</Link>
                <Link href="/anime" className="footer-link">Anime</Link>
                <Link href="/search" className="footer-link">Search</Link>
              </div>
            </div>
            <div>
              <h4 className="text-sm font-semibold text-white mb-3">My Stuff</h4>
              <div className="flex flex-col gap-2">
                <Link href="/mylist" className="footer-link">My List</Link>
                <Link href="/history" className="footer-link">Watch History</Link>
              </div>
            </div>
            <div>
              <h4 className="text-sm font-semibold text-white mb-3">Discover</h4>
              <div className="flex flex-col gap-2">
                <span className="footer-link">Trending</span>
                <span className="footer-link">Top Rated</span>
                <span className="footer-link">New Releases</span>
              </div>
            </div>
            <div>
              <h4 className="text-sm font-semibold text-white mb-3">About</h4>
              <div className="flex flex-col gap-2">
                <span className="footer-link">Powered by TMDB</span>
                <span className="footer-link">Data from MAL</span>
              </div>
            </div>
          </div>
          <div className="flex flex-col md:flex-row items-center justify-between gap-4 pt-6 border-t border-white/5">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-md bg-[var(--accent-primary)] flex items-center justify-center text-black font-bold text-[10px]">P</div>
              <span className="text-sm font-bold text-white" style={{ fontFamily: "var(--font-space)" }}>
                <span className="text-[var(--accent-primary)]">Pure</span>Verse
              </span>
            </div>
            <p className="text-xs text-[var(--text-muted)] text-center">
              © 2026 PureVerse. All data provided by The Movie Database and MyAnimeList.
            </p>
          </div>
        </footer>
      </div>
    </main>
  );
}
