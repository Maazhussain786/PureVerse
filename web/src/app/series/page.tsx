import React from "react";
import MediaCard from "../components/MediaCard";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000/api";

async function getTrendingSeries() {
  try {
    const res = await fetch(`${API_BASE}/trending/series`, {
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
  title: "Series — PureVerse",
  description: "Browse trending and popular TV series on PureVerse.",
};

export default async function SeriesPage() {
  const series = await getTrendingSeries();

  return (
    <main className="min-h-screen pt-24 px-6 md:px-10 lg:px-14 max-w-[1600px] mx-auto">
      {/* Page Header */}
      <div className="mb-10">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-10 h-10 rounded-xl bg-[rgba(59,130,246,0.12)] flex items-center justify-center">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#3b82f6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="m16 13 5.223 3.482a.5.5 0 0 0 .777-.416V7.934a.5.5 0 0 0-.777-.416L16 11" />
              <rect width="14" height="12" x="2" y="6" rx="2" />
            </svg>
          </div>
          <h1
            className="text-3xl md:text-4xl font-bold"
            style={{ fontFamily: "var(--font-space)" }}
          >
            Series
          </h1>
        </div>
        <p className="text-[var(--text-secondary)] text-sm">
          Discover the latest trending and popular TV series
        </p>
      </div>

      {/* Series Grid */}
      {series.length > 0 ? (
        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-7 gap-4 md:gap-6">
          {series.map((item: any) => (
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
            Unable to load series. Make sure the backend is running.
          </p>
        </div>
      )}
    </main>
  );
}
