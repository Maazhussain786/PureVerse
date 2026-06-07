import React from "react";
import MediaCard from "../components/MediaCard";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000/api";

interface SearchPageProps {
  searchParams: Promise<{ q?: string }>;
}

async function searchMedia(query: string) {
  try {
    const res = await fetch(
      `${API_BASE}/search?q=${encodeURIComponent(query)}`,
      { cache: "no-store" }
    );
    if (!res.ok) return [];
    const json = await res.json();
    return json.data || [];
  } catch {
    return [];
  }
}

export default async function SearchPage({ searchParams }: SearchPageProps) {
  const params = await searchParams;
  const query = params.q || "";
  const results = query ? await searchMedia(query) : [];

  return (
    <main className="min-h-screen pt-24 px-6 md:px-10 lg:px-14 max-w-[1600px] mx-auto">
      {/* Search Header */}
      <div className="mb-10">
        <h1
          className="text-3xl md:text-4xl font-bold mb-3"
          style={{ fontFamily: "var(--font-space)" }}
        >
          {query ? (
            <>
              Results for{" "}
              <span className="text-[var(--accent-primary)]">&ldquo;{query}&rdquo;</span>
            </>
          ) : (
            "Search"
          )}
        </h1>
        <p className="text-[var(--text-secondary)] text-sm">
          {results.length > 0
            ? `Found ${results.length} results across movies, series, and anime`
            : query
              ? "No results found. Try a different search term."
              : "Use the search bar above to find movies, series, and anime."}
        </p>
      </div>

      {/* Search Form */}
      <form action="/search" method="GET" className="mb-10">
        <div className="glass-panel rounded-xl flex items-center px-5 py-4 max-w-2xl">
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="var(--accent-primary)"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="mr-4 flex-shrink-0"
          >
            <circle cx="11" cy="11" r="8" />
            <path d="m21 21-4.3-4.3" />
          </svg>
          <input
            type="text"
            name="q"
            defaultValue={query}
            placeholder="Search movies, series, anime..."
            className="flex-1 bg-transparent text-white placeholder:text-[var(--text-muted)] outline-none text-base"
          />
          <button
            type="submit"
            className="btn-primary text-sm px-6 py-2 ml-4"
          >
            Search
          </button>
        </div>
      </form>

      {/* Results Grid */}
      {results.length > 0 && (
        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-7 gap-4 md:gap-6">
          {results.map((item: any) => (
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
      )}

      {/* Empty State */}
      {query && results.length === 0 && (
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <svg
            width="64"
            height="64"
            viewBox="0 0 24 24"
            fill="none"
            stroke="var(--text-muted)"
            strokeWidth="1"
            className="mb-6 opacity-50"
          >
            <circle cx="11" cy="11" r="8" />
            <path d="m21 21-4.3-4.3" />
          </svg>
          <p className="text-[var(--text-muted)] text-lg mb-2">
            No results found
          </p>
          <p className="text-[var(--text-muted)] text-sm max-w-md">
            Try searching for something else, or browse our trending content on the home page.
          </p>
        </div>
      )}
    </main>
  );
}
