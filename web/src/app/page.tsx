import React from "react";
import HeroSection from "./components/HeroSection";
import MediaRow from "./components/MediaRow";
import { HeroSkeleton, MediaRowSkeleton } from "./components/Skeletons";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000/api";

async function fetchData(endpoint: string) {
  try {
    const res = await fetch(`${API_BASE}${endpoint}`, {
      cache: "no-store",
    });
    if (!res.ok) return [];
    const json = await res.json();
    return json.data || [];
  } catch {
    return [];
  }
}

export default async function Home() {
  const [trendingAll, trendingMovies, trendingSeries, trendingAnime, popularAnime] =
    await Promise.all([
      fetchData("/trending"),
      fetchData("/trending/movies"),
      fetchData("/trending/series"),
      fetchData("/trending/anime"),
      fetchData("/popular/anime"),
    ]);

  const heroItem = trendingAll[0];
  const hasData = trendingAll.length > 0;

  // Section icons as JSX
  const fireIcon = (
    <div className="w-7 h-7 rounded-lg bg-[rgba(249,115,22,0.15)] flex items-center justify-center">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#f97316" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z" />
      </svg>
    </div>
  );
  const movieIcon = (
    <div className="w-7 h-7 rounded-lg bg-[var(--accent-subtle)] flex items-center justify-center">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--accent-primary)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
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
  );
  const tvIcon = (
    <div className="w-7 h-7 rounded-lg bg-[rgba(59,130,246,0.15)] flex items-center justify-center">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#3b82f6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="m16 13 5.223 3.482a.5.5 0 0 0 .777-.416V7.934a.5.5 0 0 0-.777-.416L16 11" />
        <rect width="14" height="12" x="2" y="6" rx="2" />
      </svg>
    </div>
  );
  const animeIcon = (
    <div className="w-7 h-7 rounded-lg bg-[rgba(236,72,153,0.15)] flex items-center justify-center">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#ec4899" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M6 3h12l4 6-10 13L2 9Z" />
        <path d="M11 3 8 9l4 13 4-13-3-6" />
        <path d="M2 9h20" />
      </svg>
    </div>
  );
  const starIcon = (
    <div className="w-7 h-7 rounded-lg bg-[rgba(234,179,8,0.15)] flex items-center justify-center">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#eab308" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
      </svg>
    </div>
  );

  return (
    <main className="min-h-screen">
      {/* Hero Section */}
      {hasData && heroItem ? (
        <HeroSection item={heroItem} />
      ) : (
        <HeroSkeleton />
      )}

      {/* Content Rows */}
      <div className="relative z-10 -mt-16 px-6 md:px-10 lg:px-14 max-w-[1600px] mx-auto">

        {/* ── 🔥 Trending Now (mixed) ────────────────── */}
        {trendingAll.length > 1 ? (
          <MediaRow
            title="Trending Now"
            items={trendingAll.slice(1, 16)}
            icon={fireIcon}
          />
        ) : (
          <MediaRowSkeleton />
        )}

        {/* ── 🎬 Movies Section ──────────────────────── */}
        <div className="mt-2">
          {trendingMovies.length > 0 ? (
            <MediaRow
              title="Trending Movies"
              items={trendingMovies}
              viewAllHref="/movies"
              icon={movieIcon}
            />
          ) : (
            <MediaRowSkeleton />
          )}
        </div>

        {/* ── 📺 Series Section ──────────────────────── */}
        <div className="mt-2">
          {trendingSeries.length > 0 ? (
            <MediaRow
              title="Popular Series"
              items={trendingSeries}
              viewAllHref="/series"
              icon={tvIcon}
            />
          ) : (
            <MediaRowSkeleton />
          )}
        </div>

        {/* ── 💎 Top Anime Section ───────────────────── */}
        <div className="mt-2">
          {trendingAnime.length > 0 ? (
            <MediaRow
              title="Top Airing Anime"
              items={trendingAnime}
              viewAllHref="/anime"
              icon={animeIcon}
            />
          ) : (
            <MediaRowSkeleton />
          )}
        </div>

        {/* ── ⭐ Popular Anime Section ──────────────── */}
        <div className="mt-2">
          {popularAnime.length > 0 ? (
            <MediaRow
              title="Most Popular Anime"
              items={popularAnime}
              viewAllHref="/anime"
              icon={starIcon}
            />
          ) : null}
        </div>

        {/* Footer */}
        <footer className="mt-16 mb-10 pt-8 border-t border-white/5">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-md bg-[var(--accent-primary)] flex items-center justify-center text-white font-bold text-[10px]">P</div>
              <span className="text-sm text-[var(--text-muted)]">PureVerse</span>
            </div>
            <p className="text-xs text-[var(--text-muted)] text-center">
              Powered by TMDB & Jikan • Data provided by The Movie Database and MyAnimeList
            </p>
            <div className="flex items-center gap-4">
              <a href="/movies" className="text-xs text-[var(--text-muted)] hover:text-white transition-colors">Movies</a>
              <a href="/series" className="text-xs text-[var(--text-muted)] hover:text-white transition-colors">Series</a>
              <a href="/anime" className="text-xs text-[var(--text-muted)] hover:text-white transition-colors">Anime</a>
            </div>
          </div>
        </footer>
      </div>
    </main>
  );
}
