import React from "react";
import MediaCard from "../components/MediaCard";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000/api";

async function getMovies() {
  try {
    const res = await fetch(`${API_BASE}/trending/movies`, {
      next: { revalidate: 3600 },
    });
    if (!res.ok) return [];
    const json = await res.json();
    return json.data || [];
  } catch {
    return [];
  }
}

export const metadata = {
  title: "Movies — PureVerse",
  description: "Browse trending and popular movies on PureVerse.",
};

export default async function MoviesPage() {
  const movies = await getMovies();

  return (
    <main className="min-h-screen pt-24 px-6 md:px-10 lg:px-14 max-w-[1600px] mx-auto">
      {/* Page Header */}
      <div className="mb-10">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-10 h-10 rounded-xl bg-[var(--accent-subtle)] flex items-center justify-center">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--accent-primary)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
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
          <h1
            className="text-3xl md:text-4xl font-bold"
            style={{ fontFamily: "var(--font-space)" }}
          >
            Movies
          </h1>
        </div>
        <p className="text-[var(--text-secondary)] text-sm">
          Discover the latest trending and popular movies
        </p>
      </div>

      {/* Movies Grid */}
      {movies.length > 0 ? (
        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-7 gap-4 md:gap-6">
          {movies.map((item: any) => (
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
            Unable to load movies. Make sure the backend is running.
          </p>
        </div>
      )}
    </main>
  );
}
