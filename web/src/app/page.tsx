import React from "react";
import Link from "next/link";
import HeroSection from "./components/HeroSection";
import MediaRow from "./components/MediaRow";
import { HeroSkeleton, MediaRowSkeleton } from "./components/Skeletons";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000/api";

async function fetchData(endpoint: string) {
  try {
    const res = await fetch(`${API_BASE}${endpoint}`, {
      next: { revalidate: 3600 },
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
    <div key="fire" className="w-7 h-7 rounded-lg bg-[rgba(249,115,22,0.15)] flex items-center justify-center">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#f97316" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z" />
      </svg>
    </div>
  );
  const movieIcon = (
    <div key="movie" className="w-7 h-7 rounded-lg bg-[var(--accent-subtle)] flex items-center justify-center">
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
    <div key="tv" className="w-7 h-7 rounded-lg bg-[rgba(59,130,246,0.15)] flex items-center justify-center">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#3b82f6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="m16 13 5.223 3.482a.5.5 0 0 0 .777-.416V7.934a.5.5 0 0 0-.777-.416L16 11" />
        <rect width="14" height="12" x="2" y="6" rx="2" />
      </svg>
    </div>
  );
  const animeIcon = (
    <div key="anime" className="w-7 h-7 rounded-lg bg-[rgba(236,72,153,0.15)] flex items-center justify-center">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#ec4899" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 2L2 7l10 5 10-5-10-5Z" />
        <path d="m2 17 10 5 10-5" />
        <path d="m2 12 10 5 10-5" />
      </svg>
    </div>
  );
  const starIcon = (
    <div key="star" className="w-7 h-7 rounded-lg bg-[rgba(234,179,8,0.15)] flex items-center justify-center">
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
      <div className="relative z-10 -mt-8 px-4 md:px-8 max-w-[1600px] mx-auto">
        <div className="flex flex-col lg:flex-row gap-6 xl:gap-10">
          
          {/* ── Main Content Column ──────────────────────── */}
          <div className="flex-1 min-w-0 flex flex-col gap-8">
            
            {/* Quick Update Banner */}
            <div className="bg-[#18181d] border border-white/5 rounded-lg p-3 flex items-center gap-3 text-sm shadow-[0_4px_20px_rgba(0,0,0,0.5)]">
              <div className="text-[var(--accent-primary)]">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                  <path d="M18.5 2.5a2.12 2.12 0 0 1 3 3L12 15l-4 1 1-4Z" />
                </svg>
              </div>
              <p className="text-[var(--text-primary)] font-medium flex-1">Quick update about ad network change , server upgrades & More...</p>
              <button className="text-[var(--text-muted)] hover:text-white transition-colors">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M18 6 6 18M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* ── Continue Watching (Using Anime) ─────────── */}
            <div>
              {trendingAnime.length > 0 ? (
                <MediaRow
                  title="Continue Watching"
                  items={trendingAnime}
                  viewAllHref="/anime"
                  icon={animeIcon}
                />
              ) : (
                <MediaRowSkeleton />
              )}
            </div>

            {/* ── 🔥 Trending Now (Movies & TV) ───────────── */}
            <div>
              {trendingAll.length > 1 ? (
                <MediaRow
                  title="Trending Now"
                  items={trendingAll.slice(1, 16)}
                  icon={fireIcon}
                />
              ) : (
                <MediaRowSkeleton />
              )}
            </div>

            {/* ── 🎬 Movies Section ──────────────────────── */}
            <div>
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
            <div>
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
          </div>

          {/* ── Sidebar Column (Top Trending) ──────────────── */}
          <div className="w-full lg:w-[320px] xl:w-[360px] shrink-0 mt-2">
            <div className="bg-[var(--bg-card)] rounded-xl border border-[var(--glass-border)] p-5 sticky top-24 shadow-[0_8px_30px_rgba(0,0,0,0.6)]">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-bold text-white tracking-tight" style={{ fontFamily: "var(--font-space)" }}>Top Trending</h2>
                <div className="flex bg-[#1a1a24] rounded border border-white/5 p-1 text-[10px] font-bold tracking-wider text-[var(--text-muted)]">
                  <button className="px-2 py-1 bg-[#2a2a36] text-white rounded shadow-sm">DAY</button>
                  <button className="px-2 py-1 hover:text-white transition-colors">WEEK</button>
                  <button className="px-2 py-1 hover:text-white transition-colors">MONTH</button>
                </div>
              </div>

              <div className="flex flex-col gap-5">
                {trendingAll.slice(1, 10).map((item, index) => (
                  <Link href={`/details/${item.type}/${item.id}`} key={item.id} className="flex gap-4 group items-center">
                    <div className="w-8 text-center text-5xl font-black italic text-transparent bg-clip-text bg-gradient-to-b from-[var(--text-secondary)] to-[var(--bg-primary)] opacity-50 group-hover:opacity-100 group-hover:from-[var(--accent-primary)] group-hover:to-white transition-all drop-shadow-md">
                      {index + 1}
                    </div>
                    <div className="flex-1 min-w-0 border-b border-white/5 pb-3 group-last:border-0 group-last:pb-0">
                      <h4 className="text-sm font-semibold text-white truncate group-hover:text-[var(--accent-primary)] transition-colors">
                        {item.title}
                      </h4>
                      <div className="flex items-center gap-2 mt-1.5 text-[10px] text-[var(--text-muted)] font-medium tracking-wide">
                        <span className="flex items-center gap-1 text-[#facc15]">
                          <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
                          {item.rating > 0 ? item.rating.toFixed(1) : "N/A"}
                        </span>
                        <span className="uppercase text-[var(--accent-primary)]">{item.type === "tv" ? "TV" : item.type}</span>
                        <div className="flex items-center gap-1">
                          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><rect x="2" y="2" width="20" height="20" rx="2.18" ry="2.18"/><line x1="7" y1="2" x2="7" y2="22"/><line x1="17" y1="2" x2="17" y2="22"/><line x1="2" y1="12" x2="22" y2="12"/><line x1="2" y1="7" x2="7" y2="7"/><line x1="2" y1="17" x2="7" y2="17"/><line x1="17" y1="17" x2="22" y2="17"/><line x1="17" y1="7" x2="22" y2="7"/></svg>
                          {item.releaseYear > 0 ? item.releaseYear : "TBA"}
                        </div>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          </div>
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
