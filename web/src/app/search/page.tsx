"use client";

import React, { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import MediaCard from "../components/MediaCard";
import { useUserState } from "../components/UserStateContext";
import { API_BASE } from "../lib/api";

// ─── Filter config ─────────────────────────────────────────

type TabKey = "all" | "anime" | "movie" | "tv";

const TABS: { key: TabKey; label: string }[] = [
  { key: "all", label: "All" },
  { key: "anime", label: "Anime" },
  { key: "movie", label: "Movies" },
  { key: "tv", label: "Series" },
];

const GENRES = [
  "Action", "Adventure", "Animation", "Comedy", "Crime", "Drama", "Family",
  "Fantasy", "Horror", "Mystery", "Romance", "Sci-Fi", "Thriller", "War",
];

const YEAR_OPTIONS: { label: string; from?: number; to?: number }[] = [
  { label: "Any year" },
  { label: "2026", from: 2026, to: 2026 },
  { label: "2025", from: 2025, to: 2025 },
  { label: "2024", from: 2024, to: 2024 },
  { label: "2020s", from: 2020, to: 2029 },
  { label: "2010s", from: 2010, to: 2019 },
  { label: "2000s", from: 2000, to: 2009 },
  { label: "1990s", from: 1990, to: 1999 },
  { label: "Older", to: 1989 },
];

const RATING_OPTIONS = [
  { label: "Any rating", value: 0 },
  { label: "9+ Masterpiece", value: 9 },
  { label: "8+ Great", value: 8 },
  { label: "7+ Good", value: 7 },
  { label: "6+ Decent", value: 6 },
];

interface ResultItem {
  id: string;
  type: string;
  title: string;
  posterUrl: string;
  rating: number;
  releaseYear: number;
  genres?: string[];
}

function SkeletonGrid() {
  return (
    <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-7 gap-4 md:gap-6">
      {Array.from({ length: 14 }).map((_, i) => (
        <div key={i}>
          <div className="skeleton aspect-[2/3] rounded-xl" />
          <div className="skeleton h-3.5 w-3/4 rounded mt-2.5" />
          <div className="skeleton h-2.5 w-1/2 rounded mt-1.5" />
        </div>
      ))}
    </div>
  );
}

function SearchClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { recentSearches, addRecentSearch, clearRecentSearches } = useUserState();

  const [query, setQuery] = useState(searchParams.get("q") || "");
  const [results, setResults] = useState<ResultItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);

  const [tab, setTab] = useState<TabKey>("all");
  const [genre, setGenre] = useState("");
  const [yearIdx, setYearIdx] = useState(0);
  const [minRating, setMinRating] = useState(0);
  const [trending, setTrending] = useState<{ id: string; type: string; title: string; posterUrl: string }[]>([]);

  const inputRef = useRef<HTMLInputElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const recordTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ─── Trending searches (once) ───
  useEffect(() => {
    fetch(`${API_BASE}/search/trending`)
      .then((r) => r.json())
      .then((j) => setTrending(j.data || []))
      .catch(() => {});
  }, []);

  // ─── Debounced live search + URL sync ───
  useEffect(() => {
    const q = query.trim();
    if (!q) {
      setResults([]);
      setSearched(false);
      setLoading(false);
      router.replace("/search", { scroll: false });
      return;
    }
    setLoading(true);
    const timeout = setTimeout(async () => {
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;
      try {
        const res = await fetch(`${API_BASE}/search?q=${encodeURIComponent(q)}`, {
          signal: controller.signal,
        });
        const json = await res.json();
        setResults(json.data || []);
        setSearched(true);
        router.replace(`/search?q=${encodeURIComponent(q)}`, { scroll: false });
      } catch (err: any) {
        if (err?.name !== "AbortError") {
          setResults([]);
          setSearched(true);
        }
      } finally {
        if (abortRef.current === controller) setLoading(false);
      }
    }, 300);
    return () => clearTimeout(timeout);
  }, [query, router]);

  // Record a "real" search into recents after the query settles
  useEffect(() => {
    if (recordTimer.current) clearTimeout(recordTimer.current);
    const q = query.trim();
    if (!q || q.length < 2) return;
    recordTimer.current = setTimeout(() => addRecentSearch(q), 2000);
    return () => {
      if (recordTimer.current) clearTimeout(recordTimer.current);
    };
  }, [query, addRecentSearch]);

  // ─── Client-side filtering (instant) ───
  const filtered = useMemo(() => {
    let items = results;
    if (tab !== "all") items = items.filter((i) => i.type === tab);
    if (genre) {
      const g = genre.toLowerCase();
      items = items.filter((i) => (i.genres || []).some((x) => x.toLowerCase().includes(g)));
    }
    const yearOpt = YEAR_OPTIONS[yearIdx];
    if (yearOpt.from) items = items.filter((i) => i.releaseYear >= yearOpt.from!);
    if (yearOpt.to) items = items.filter((i) => i.releaseYear > 0 && i.releaseYear <= yearOpt.to!);
    if (minRating > 0) items = items.filter((i) => i.rating >= minRating);
    return items;
  }, [results, tab, genre, yearIdx, minRating]);

  const tabCounts = useMemo(() => {
    const counts: Record<TabKey, number> = { all: results.length, anime: 0, movie: 0, tv: 0 };
    for (const item of results) {
      if (item.type === "anime") counts.anime++;
      else if (item.type === "movie") counts.movie++;
      else if (item.type === "tv") counts.tv++;
    }
    return counts;
  }, [results]);

  const activeFilterCount = (genre ? 1 : 0) + (yearIdx > 0 ? 1 : 0) + (minRating > 0 ? 1 : 0);

  const runSearch = useCallback(
    (q: string) => {
      setQuery(q);
      addRecentSearch(q);
      inputRef.current?.focus();
    },
    [addRecentSearch]
  );

  const hasQuery = !!query.trim();

  return (
    <main className="min-h-screen pt-24 pb-28 lg:pb-16 px-5 md:px-10 lg:px-14 max-w-[1600px] mx-auto">
      {/* ─── Search input ─── */}
      <div className="max-w-3xl mx-auto mb-8">
        <div className="relative group">
          <div className="absolute -inset-px rounded-2xl bg-gradient-to-r from-[var(--accent-primary)]/40 via-transparent to-[var(--accent-teal)]/30 opacity-0 group-focus-within:opacity-100 transition-opacity blur-sm pointer-events-none" />
          <div className="relative flex items-center gap-4 px-6 py-4 rounded-2xl bg-[var(--bg-card)] border border-white/10 group-focus-within:border-[var(--accent-primary)]/50 transition-colors">
            {loading ? (
              <div className="w-[22px] h-[22px] border-2 border-[var(--accent-primary)] border-t-transparent rounded-full animate-spin flex-shrink-0" />
            ) : (
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="var(--accent-primary)" strokeWidth="2.5" className="flex-shrink-0">
                <circle cx="11" cy="11" r="8" />
                <path d="m21 21-4.3-4.3" />
              </svg>
            )}
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && query.trim()) addRecentSearch(query.trim());
              }}
              placeholder="Search anime, movies, series…"
              autoFocus
              className="flex-1 bg-transparent text-lg text-white placeholder:text-[var(--text-muted)] outline-none min-w-0"
              aria-label="Search"
            />
            {query && (
              <button
                onClick={() => { setQuery(""); inputRef.current?.focus(); }}
                className="p-1.5 rounded-full text-[var(--text-muted)] hover:text-white hover:bg-white/10 transition-colors flex-shrink-0"
                aria-label="Clear search"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <path d="M18 6 6 18M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ─── Idle state: recent + trending ─── */}
      {!hasQuery && (
        <div className="max-w-3xl mx-auto space-y-10 animate-fade-in-up">
          {recentSearches.length > 0 && (
            <section>
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-sm font-bold text-[var(--text-secondary)] uppercase tracking-widest">Recent searches</h2>
                <button
                  onClick={clearRecentSearches}
                  className="text-xs text-[var(--text-muted)] hover:text-red-400 transition-colors"
                >
                  Clear all
                </button>
              </div>
              <div className="flex flex-wrap gap-2">
                {recentSearches.map((s) => (
                  <button
                    key={s}
                    onClick={() => runSearch(s)}
                    className="flex items-center gap-2 px-4 py-2 rounded-full text-sm text-[var(--text-secondary)] bg-white/[0.04] border border-white/10 hover:text-white hover:border-[var(--accent-primary)]/40 transition-all"
                  >
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="opacity-50">
                      <circle cx="12" cy="12" r="10" />
                      <polyline points="12 6 12 12 16 14" />
                    </svg>
                    {s}
                  </button>
                ))}
              </div>
            </section>
          )}

          {trending.length > 0 && (
            <section>
              <h2 className="text-sm font-bold text-[var(--text-secondary)] uppercase tracking-widest mb-3">
                Trending now
              </h2>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {trending.slice(0, 9).map((t, idx) => (
                  <Link
                    key={t.id}
                    href={`/details/${t.type}/${t.id}`}
                    className="group flex items-center gap-3 p-2.5 rounded-xl bg-white/[0.03] border border-white/[0.06] hover:border-[var(--accent-primary)]/40 hover:bg-white/[0.06] transition-all"
                  >
                    <span className="text-lg font-black text-[var(--accent-primary)]/70 w-6 text-center flex-shrink-0" style={{ fontFamily: "var(--font-space)" }}>
                      {idx + 1}
                    </span>
                    {t.posterUrl && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={t.posterUrl} alt="" className="w-9 h-12 rounded-md object-cover flex-shrink-0" loading="lazy" />
                    )}
                    <span className="text-sm font-medium text-[var(--text-secondary)] group-hover:text-white truncate transition-colors">
                      {t.title}
                    </span>
                  </Link>
                ))}
              </div>
            </section>
          )}

          {recentSearches.length === 0 && trending.length === 0 && (
            <p className="text-center text-sm text-[var(--text-muted)] pt-10">
              Start typing to search across anime, movies and series.
            </p>
          )}
        </div>
      )}

      {/* ─── Results ─── */}
      {hasQuery && (
        <>
          {/* Tabs */}
          <div className="flex items-center gap-1.5 mb-4 overflow-x-auto hide-scrollbar">
            {TABS.map((t) => (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                className={`flex-shrink-0 flex items-center gap-2 px-4 py-2 rounded-full text-sm font-semibold transition-all ${
                  tab === t.key
                    ? "bg-[var(--accent-primary)] text-black shadow-[0_0_14px_var(--accent-glow)]"
                    : "bg-white/[0.04] text-[var(--text-secondary)] border border-white/10 hover:text-white"
                }`}
              >
                {t.label}
                {searched && (
                  <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${tab === t.key ? "bg-black/20 text-black" : "bg-white/10 text-[var(--text-muted)]"}`}>
                    {tabCounts[t.key]}
                  </span>
                )}
              </button>
            ))}

            <div className="flex-1" />

            {/* Filters */}
            <div className="flex items-center gap-2 flex-shrink-0">
              <select
                value={genre}
                onChange={(e) => setGenre(e.target.value)}
                className="season-dropdown !py-2 !text-xs"
                aria-label="Genre filter"
              >
                <option value="">All genres</option>
                {GENRES.map((g) => (
                  <option key={g} value={g}>{g}</option>
                ))}
              </select>
              <select
                value={yearIdx}
                onChange={(e) => setYearIdx(parseInt(e.target.value, 10))}
                className="season-dropdown !py-2 !text-xs"
                aria-label="Year filter"
              >
                {YEAR_OPTIONS.map((y, i) => (
                  <option key={y.label} value={i}>{y.label}</option>
                ))}
              </select>
              <select
                value={minRating}
                onChange={(e) => setMinRating(parseFloat(e.target.value))}
                className="season-dropdown !py-2 !text-xs"
                aria-label="Rating filter"
              >
                {RATING_OPTIONS.map((r) => (
                  <option key={r.value} value={r.value}>{r.label}</option>
                ))}
              </select>
              {activeFilterCount > 0 && (
                <button
                  onClick={() => { setGenre(""); setYearIdx(0); setMinRating(0); }}
                  className="text-xs font-semibold text-[var(--accent-primary)] hover:text-[var(--accent-hover)] transition-colors whitespace-nowrap"
                >
                  Reset ({activeFilterCount})
                </button>
              )}
            </div>
          </div>

          {/* Status line */}
          <p className="text-sm text-[var(--text-secondary)] mb-6">
            {loading
              ? "Searching…"
              : filtered.length > 0
                ? <>Found <span className="text-white font-semibold">{filtered.length}</span> result{filtered.length !== 1 ? "s" : ""} for <span className="text-[var(--accent-primary)] font-semibold">&ldquo;{query.trim()}&rdquo;</span></>
                : null}
          </p>

          {loading && results.length === 0 ? (
            <SkeletonGrid />
          ) : filtered.length > 0 ? (
            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-7 gap-4 md:gap-6 animate-fade-in">
              {filtered.map((item) => (
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
          ) : searched && !loading ? (
            <div className="flex flex-col items-center justify-center py-24 text-center">
              <svg width="56" height="56" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="1" className="mb-5 opacity-50">
                <circle cx="11" cy="11" r="8" />
                <path d="m21 21-4.3-4.3" />
              </svg>
              <p className="text-[var(--text-muted)] text-lg mb-2">
                No {activeFilterCount > 0 || tab !== "all" ? "matching " : ""}results for &ldquo;{query.trim()}&rdquo;
              </p>
              <p className="text-[var(--text-muted)] text-sm max-w-md">
                {activeFilterCount > 0 || tab !== "all"
                  ? "Try removing some filters, or search for something else."
                  : "Check the spelling or try a different title."}
              </p>
              {(activeFilterCount > 0 || tab !== "all") && (
                <button
                  onClick={() => { setGenre(""); setYearIdx(0); setMinRating(0); setTab("all"); }}
                  className="btn-secondary btn-sm mt-6"
                >
                  Clear filters
                </button>
              )}
            </div>
          ) : null}
        </>
      )}
    </main>
  );
}

export default function SearchPage() {
  return (
    <Suspense fallback={<main className="min-h-screen pt-24" />}>
      <SearchClient />
    </Suspense>
  );
}
