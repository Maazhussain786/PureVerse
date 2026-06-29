"use client";

import React, { useState } from "react";
import { useUserState } from "../components/UserStateContext";
import MediaCard from "../components/MediaCard";
import Link from "next/link";

type FilterType = "all" | "movie" | "tv" | "anime";

export default function MyListPage() {
  const { watchlist, removeFromWatchlist, favorites, removeFromFavorites } = useUserState();
  const [filter, setFilter] = useState<FilterType>("all");
  const [list, setList] = useState<"watchlist" | "favorites">("watchlist");

  const activeItems = list === "watchlist" ? watchlist : favorites;
  const removeItem = list === "watchlist" ? removeFromWatchlist : removeFromFavorites;

  const filteredItems = filter === "all"
    ? activeItems
    : activeItems.filter((item) => item.type === filter);

  const filters: { key: FilterType; label: string }[] = [
    { key: "all", label: "All" },
    { key: "movie", label: "Movies" },
    { key: "tv", label: "Series" },
    { key: "anime", label: "Anime" },
  ];

  return (
    <main className="min-h-screen pt-32 pb-28 lg:pb-16 px-6 md:px-10 lg:px-14 max-w-[1600px] mx-auto">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-10 h-10 rounded-xl bg-[rgba(244,63,94,0.12)] flex items-center justify-center">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#f43f5e" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z" />
            </svg>
          </div>
          <h1
            className="text-3xl md:text-4xl font-bold"
            style={{ fontFamily: "var(--font-space)" }}
          >
            My List
          </h1>
        </div>
        <p className="text-[var(--text-secondary)] text-sm">
          {activeItems.length > 0
            ? `${activeItems.length} title${activeItems.length !== 1 ? "s" : ""} in ${list === "watchlist" ? "your list" : "favorites"}`
            : list === "watchlist" ? "Your watchlist is empty" : "No favorites yet"}
        </p>
      </div>

      {/* List Switcher */}
      <div className="flex rounded-full bg-white/5 border border-white/10 p-1 w-fit mb-6" style={{ padding: "4px", marginBottom: "24px" }}>
        {([
          { key: "watchlist", label: "My List" },
          { key: "favorites", label: "Favorites" },
        ] as const).map((opt) => (
          <button
            key={opt.key}
            onClick={() => setList(opt.key)}
            className={`px-5 py-2 rounded-full text-sm font-bold transition-all ${
              list === opt.key
                ? "bg-[var(--accent-primary)] text-black"
                : "text-[var(--text-secondary)] hover:text-white"
            }`}
            style={{ padding: "8px 20px" }}
          >
            {opt.label}
            <span className="ml-2 text-[10px] opacity-70">
              {opt.key === "watchlist" ? watchlist.length : favorites.length}
            </span>
          </button>
        ))}
      </div>

      {/* Filter Tabs */}
      {activeItems.length > 0 && (
        <div className="flex gap-2 mb-8" style={{ gap: "8px", marginBottom: "32px" }}>
          {filters.map((f) => (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                filter === f.key
                  ? "bg-[var(--accent-primary)] text-black font-bold shadow-[0_0_12px_var(--accent-glow)]"
                  : "glass-panel text-[var(--text-secondary)] hover:text-white hover:bg-white/10"
              }`}
              style={{ padding: "8px 16px" }}
            >
              {f.label}
            </button>
          ))}
        </div>
      )}

      {/* Grid */}
      {filteredItems.length > 0 ? (
        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-7 gap-4 md:gap-6" style={{ gap: "24px" }}>
          {filteredItems.map((item) => (
            <MediaCard
              key={item.id}
              id={item.id}
              type={item.type}
              title={item.title}
              posterUrl={item.posterUrl}
              rating={item.rating}
              releaseYear={item.releaseYear}
              onRemove={() => removeItem(item.id)}
            />
          ))}
        </div>
      ) : activeItems.length > 0 ? (
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <p className="text-[var(--text-muted)] text-lg mb-2">
            No {filter === "all" ? "" : filter} titles match this filter
          </p>
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <div className="w-20 h-20 rounded-full bg-[var(--bg-card)] flex items-center justify-center mb-6">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="1.5">
              <path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z" />
            </svg>
          </div>
          <p className="text-[var(--text-muted)] text-lg mb-2">
            {list === "watchlist" ? "Your watchlist is empty" : "No favorites yet"}
          </p>
          <p className="text-[var(--text-muted)] text-sm mb-6 max-w-md">
            {list === "watchlist"
              ? "Start adding movies, series, and anime to your list by clicking the + button on any title."
              : "Tap the heart on any title's watch page to keep your favorites here."}
          </p>
          <Link href="/" className="btn-primary">
            Browse Content
          </Link>
        </div>
      )}
    </main>
  );
}
