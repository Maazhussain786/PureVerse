import React from "react";
import MediaCard from "../components/MediaCard";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000/api";

async function getAnime() {
  try {
    const [trendingRes, popularRes] = await Promise.all([
      fetch(`${API_BASE}/trending/anime`, { next: { revalidate: 60 } }),
      fetch(`${API_BASE}/popular/anime`, { next: { revalidate: 60 } }),
    ]);

    const trending = trendingRes.ok
      ? (await trendingRes.json()).data || []
      : [];
    const popular = popularRes.ok
      ? (await popularRes.json()).data || []
      : [];

    // Merge and deduplicate
    const seen = new Set<string>();
    const combined: any[] = [];
    for (const item of [...trending, ...popular]) {
      if (!seen.has(item.id)) {
        seen.add(item.id);
        combined.push(item);
      }
    }
    return combined;
  } catch {
    return [];
  }
}

export const metadata = {
  title: "Anime — PureVerse",
  description:
    "Browse trending and popular anime on PureVerse. Powered by Jikan API.",
};

export default async function AnimePage() {
  const anime = await getAnime();

  return (
    <main className="min-h-screen pt-24 px-6 md:px-10 lg:px-14 max-w-[1600px] mx-auto">
      {/* Page Header */}
      <div className="mb-10">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-10 h-10 rounded-xl bg-[rgba(236,72,153,0.12)] flex items-center justify-center">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#ec4899" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M6 3h12l4 6-10 13L2 9Z" />
              <path d="M11 3 8 9l4 13 4-13-3-6" />
              <path d="M2 9h20" />
            </svg>
          </div>
          <h1
            className="text-3xl md:text-4xl font-bold"
            style={{ fontFamily: "var(--font-space)" }}
          >
            Anime
          </h1>
        </div>
        <p className="text-[var(--text-secondary)] text-sm">
          Discover top airing and popular anime from MyAnimeList
        </p>
      </div>

      {/* Anime Grid */}
      {anime.length > 0 ? (
        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-7 gap-4 md:gap-6">
          {anime.map((item: any) => (
            <MediaCard
              key={item.id}
              id={item.id}
              type={item.type}
              title={item.title}
              posterUrl={item.posterUrl}
              rating={item.rating}
              releaseYear={item.releaseYear}
            />
          ))}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <p className="text-[var(--text-muted)] text-lg">
            Unable to load anime. Make sure the backend is running.
          </p>
        </div>
      )}
    </main>
  );
}
