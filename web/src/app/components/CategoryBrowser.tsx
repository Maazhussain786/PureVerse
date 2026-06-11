"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import Link from "next/link";
import MediaRow from "./MediaRow";
import MediaCard from "./MediaCard";
import { MediaRowSkeleton } from "./Skeletons";
import { useUserState } from "./UserStateContext";
import useDragScroll from "../hooks/useDragScroll";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000/api";

// ─── Per-category configuration (TMDB genre ids are stable public constants) ───
type Category = "movies" | "series" | "anime";

interface RowConfig {
  title: string;
  endpoint: string;
  layout?: "portrait" | "landscape";
  ranked?: boolean;
}

interface GenreConfig {
  label: string;
  id: number;
}

const CONFIG: Record<
  Category,
  {
    heading: string;
    tagline: string;
    heroEndpoint: string;
    historyType: string; // matching type in watch history for "Because you watched"
    baseRows: RowConfig[];
    genres: GenreConfig[];
  }
> = {
  movies: {
    heading: "Movies",
    tagline: "Blockbusters, hidden gems and everything in between.",
    heroEndpoint: "/trending/movies",
    historyType: "movie",
    baseRows: [
      { title: "Trending Now", endpoint: "/trending/movies", layout: "landscape", ranked: true },
      { title: "New Releases", endpoint: "/now-playing", layout: "landscape" },
      { title: "Top Rated", endpoint: "/top-rated/movies" },
    ],
    genres: [
      { label: "Action", id: 28 },
      { label: "Comedy", id: 35 },
      { label: "Sci-Fi", id: 878 },
      { label: "Horror", id: 27 },
      { label: "Romance", id: 10749 },
      { label: "Thriller", id: 53 },
      { label: "Adventure", id: 12 },
      { label: "Fantasy", id: 14 },
      { label: "Drama", id: 18 },
      { label: "Mystery", id: 9648 },
      { label: "Animation", id: 16 },
      { label: "Family", id: 10751 },
    ],
  },
  series: {
    heading: "TV Series",
    tagline: "Binge-worthy shows, from prestige drama to cult comedy.",
    heroEndpoint: "/trending/series",
    historyType: "tv",
    baseRows: [
      { title: "Trending Now", endpoint: "/trending/series", layout: "landscape", ranked: true },
      { title: "Top Rated", endpoint: "/top-rated/series" },
    ],
    genres: [
      { label: "Action & Adventure", id: 10759 },
      { label: "Comedy", id: 35 },
      { label: "Drama", id: 18 },
      { label: "Sci-Fi & Fantasy", id: 10765 },
      { label: "Crime", id: 80 },
      { label: "Mystery", id: 9648 },
      { label: "Animation", id: 16 },
      { label: "Family", id: 10751 },
      { label: "War & Politics", id: 10768 },
      { label: "Documentary", id: 99 },
    ],
  },
  anime: {
    heading: "Anime",
    tagline: "From shonen juggernauts to seasonal sleepers.",
    heroEndpoint: "/trending/anime",
    historyType: "anime",
    baseRows: [
      { title: "Trending This Season", endpoint: "/trending/anime", layout: "landscape", ranked: true },
      { title: "All-Time Popular", endpoint: "/popular/anime" },
    ],
    genres: [
      { label: "Action & Adventure", id: 10759 },
      { label: "Comedy", id: 35 },
      { label: "Drama", id: 18 },
      { label: "Sci-Fi & Fantasy", id: 10765 },
      { label: "Mystery", id: 9648 },
      { label: "Crime", id: 80 },
      { label: "Family", id: 10751 },
    ],
  },
};

const SORTS: { value: string; label: string }[] = [
  { value: "popular", label: "Most Popular" },
  { value: "top_rated", label: "Top Rated" },
  { value: "newest", label: "Newest First" },
];

function proxyImage(url: string): string {
  if (!url) return "";
  if (url.includes("myanimelist.net")) {
    return `/api/proxy/image?url=${encodeURIComponent(url)}`;
  }
  return url;
}

// ─── Lazy row: fetches only when scrolled near the viewport ───
function LazyRow({ title, endpoint, layout, ranked }: RowConfig) {
  const anchorRef = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  const [items, setItems] = useState<any[] | null>(null);

  useEffect(() => {
    const el = anchorRef.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          setVisible(true);
          obs.disconnect();
        }
      },
      { rootMargin: "700px" }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  useEffect(() => {
    if (!visible) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`${API_BASE}${endpoint}`);
        const json = res.ok ? await res.json() : null;
        if (!cancelled) setItems(json?.data || []);
      } catch {
        if (!cancelled) setItems([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [visible, endpoint]);

  return (
    <div ref={anchorRef}>
      {items === null ? (
        visible ? <MediaRowSkeleton landscape={layout === "landscape"} /> : <div className="h-40" />
      ) : items.length > 0 ? (
        <MediaRow title={title} items={items} layout={layout} ranked={ranked} />
      ) : null}
    </div>
  );
}

// ─── Category hero: compact cinematic spotlight from real trending data ───
function CategoryHero({ items, heading, tagline }: { items: any[]; heading: string; tagline: string }) {
  const item = items[0];
  if (!item) return null;
  const backdrop = proxyImage(item.bannerUrl || item.posterUrl || "");

  return (
    <div className="relative w-full h-[56vh] min-h-[420px] overflow-hidden">
      {backdrop ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={backdrop}
          alt=""
          className="absolute inset-0 w-full h-full object-cover object-top animate-ken-burns"
          referrerPolicy="no-referrer"
        />
      ) : (
        <div className="absolute inset-0 bg-gradient-to-br from-[var(--bg-secondary)] to-[var(--bg-primary)]" />
      )}
      <div
        className="absolute inset-0"
        style={{ background: "linear-gradient(to top, var(--bg-primary) 2%, rgba(9,9,12,0.6) 36%, rgba(9,9,12,0.15) 100%)" }}
      />
      <div
        className="absolute inset-0"
        style={{ background: "linear-gradient(to right, rgba(9,9,12,0.9) 0%, rgba(9,9,12,0.45) 42%, rgba(9,9,12,0) 72%)" }}
      />

      <div className="absolute inset-0 flex items-end">
        <div className="w-full max-w-screen-2xl mx-auto px-5 md:px-10 lg:px-16 pb-10 md:pb-14">
          {/* Brand + section eyebrow */}
          <div className="flex items-center gap-2.5 mb-3">
            <img src="/logos/Small_logo.png" alt="" className="w-6 h-6 rounded-md object-contain" />
            <span className="text-[11px] sm:text-xs font-bold uppercase tracking-[0.2em] text-[var(--accent-primary)]">
              PureVerse · {heading}
            </span>
          </div>

          <h1
            className="text-4xl md:text-6xl font-extrabold tracking-tight text-white mb-3 drop-shadow-[0_4px_30px_rgba(0,0,0,0.8)]"
            style={{ fontFamily: "var(--font-space)" }}
          >
            {heading}
          </h1>
          <p className="text-sm md:text-base text-[var(--text-secondary)] max-w-lg mb-6">{tagline}</p>

          {/* Featured title strip */}
          <div className="flex items-center gap-3">
            <span className="text-[11px] font-bold uppercase tracking-[0.14em] text-[var(--text-muted)]">
              Now trending:
            </span>
            <Link
              href={`/details/${item.type}/${item.id}`}
              className="group inline-flex items-center gap-2 text-sm font-bold text-white hover:text-[var(--accent-primary)] transition-colors"
            >
              {item.title}
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="transition-transform group-hover:translate-x-0.5">
                <path d="m9 18 6-6-6-6" />
              </svg>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Main browser ───
export default function CategoryBrowser({ category }: { category: Category }) {
  const cfg = CONFIG[category];
  const { watchHistory } = useUserState();

  const [heroItems, setHeroItems] = useState<any[]>([]);
  const [activeGenre, setActiveGenre] = useState<GenreConfig | null>(null);
  const [sort, setSort] = useState("popular");
  const [gridItems, setGridItems] = useState<any[]>([]);
  const [gridLoading, setGridLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const chipsRef = useRef<HTMLDivElement>(null);
  useDragScroll(chipsRef);

  // Grid mode is active when the user narrows the catalogue
  const isGridMode = activeGenre !== null || sort !== "popular";

  // Hero data
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`${API_BASE}${cfg.heroEndpoint}`);
        const json = res.ok ? await res.json() : null;
        if (!cancelled) setHeroItems(json?.data || []);
      } catch {
        /* ignore */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [cfg.heroEndpoint]);

  // Grid fetching (genre / sort narrowed)
  const fetchGrid = useCallback(
    async (pageNum: number, append: boolean) => {
      const params = new URLSearchParams();
      if (activeGenre) params.set("genre", String(activeGenre.id));
      params.set("sort", sort);
      params.set("page", String(pageNum));
      try {
        if (append) setLoadingMore(true);
        else setGridLoading(true);
        const res = await fetch(`${API_BASE}/discover/${category}?${params.toString()}`);
        const json = res.ok ? await res.json() : null;
        const items = json?.data || [];
        setHasMore(items.length >= 20);
        setGridItems((prev) => (append ? [...prev, ...items] : items));
      } catch {
        if (!append) setGridItems([]);
      } finally {
        setGridLoading(false);
        setLoadingMore(false);
      }
    },
    [activeGenre, sort, category]
  );

  useEffect(() => {
    if (!isGridMode) return;
    setPage(1);
    fetchGrid(1, false);
  }, [isGridMode, fetchGrid]);

  const loadMore = () => {
    const next = page + 1;
    setPage(next);
    fetchGrid(next, true);
  };

  // "Because you watched" seed — most recent history item of this category's type
  const seed = watchHistory.find((h) => h.type === cfg.historyType);

  return (
    <main className="min-h-screen">
      <CategoryHero items={heroItems} heading={cfg.heading} tagline={cfg.tagline} />

      {/* ─── Sticky filter bar ─── */}
      <div className="sticky top-[68px] z-30 bg-[rgba(9,9,12,0.82)] backdrop-blur-2xl backdrop-saturate-150 border-b border-white/[0.05]">
        <div className="max-w-screen-2xl mx-auto px-5 md:px-10 lg:px-16 py-3 flex items-center gap-3">
          {/* Genre chips (drag-scrollable) */}
          <div ref={chipsRef} className="drag-scroll flex items-center gap-2 overflow-x-auto hide-scrollbar flex-1 min-w-0">
            <button
              onClick={() => setActiveGenre(null)}
              className={`flex-none px-4 py-1.5 rounded-full text-[13px] font-semibold transition-all duration-200 ${
                activeGenre === null
                  ? "bg-white text-black shadow-[0_4px_18px_rgba(255,255,255,0.25)]"
                  : "bg-white/[0.07] text-[var(--text-secondary)] ring-1 ring-white/10 hover:text-white hover:bg-white/[0.12]"
              }`}
            >
              All
            </button>
            {cfg.genres.map((g) => {
              const active = activeGenre?.id === g.id;
              return (
                <button
                  key={g.id}
                  onClick={() => setActiveGenre(active ? null : g)}
                  className={`flex-none px-4 py-1.5 rounded-full text-[13px] font-semibold transition-all duration-200 ${
                    active
                      ? "bg-[var(--accent-primary)] text-black shadow-[0_0_18px_var(--accent-glow)]"
                      : "bg-white/[0.07] text-[var(--text-secondary)] ring-1 ring-white/10 hover:text-white hover:bg-white/[0.12]"
                  }`}
                >
                  {g.label}
                </button>
              );
            })}
          </div>

          {/* Sort */}
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value)}
            className="season-dropdown flex-none !py-1.5 !text-[13px]"
            aria-label="Sort by"
          >
            {SORTS.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* ─── Content ─── */}
      <div className="max-w-screen-2xl mx-auto px-5 md:px-10 lg:px-16 pt-10 pb-20">
        {isGridMode ? (
          /* ── Narrowed: responsive grid + Load More ── */
          <section>
            <div className="flex items-center gap-3 mb-7">
              <div className="w-1.5 h-7 rounded-full bg-[var(--accent-primary)] shadow-[0_0_10px_var(--accent-glow)]" />
              <h2 className="text-xl md:text-[26px] font-bold text-white tracking-tight" style={{ fontFamily: "var(--font-space)" }}>
                {activeGenre ? `${activeGenre.label} ${cfg.heading}` : cfg.heading}
              </h2>
              <span className="text-sm text-[var(--text-muted)] font-medium mb-0.5">
                {SORTS.find((s) => s.value === sort)?.label}
              </span>
            </div>

            {gridLoading ? (
              <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-7 gap-x-4 gap-y-8">
                {Array.from({ length: 14 }).map((_, i) => (
                  <div key={i}>
                    <div className="skeleton aspect-[2/3] rounded-xl" />
                    <div className="skeleton w-[75%] h-3.5 mt-2.5 rounded" />
                  </div>
                ))}
              </div>
            ) : gridItems.length > 0 ? (
              <>
                <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-7 gap-x-4 gap-y-8">
                  {gridItems.map((item, i) => (
                    <MediaCard
                      key={`${item.id}-${i}`}
                      id={item.id}
                      type={item.type}
                      title={item.title}
                      posterUrl={item.posterUrl}
                      rating={item.rating}
                      releaseYear={item.releaseYear}
                    />
                  ))}
                </div>
                {hasMore && (
                  <div className="flex justify-center mt-12">
                    <button
                      onClick={loadMore}
                      disabled={loadingMore}
                      className="h-12 px-10 rounded-full bg-white/[0.07] ring-1 ring-white/10 text-white font-semibold text-sm hover:bg-white/[0.12] hover:ring-white/25 transition-all disabled:opacity-50 inline-flex items-center gap-2.5"
                    >
                      {loadingMore ? (
                        <>
                          <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                          Loading…
                        </>
                      ) : (
                        "Load More"
                      )}
                    </button>
                  </div>
                )}
              </>
            ) : (
              /* Empty state */
              <div className="text-center py-24 rounded-2xl ring-1 ring-white/5 bg-[var(--bg-card)]/30">
                <img src="/logos/Small_logo.png" alt="" className="w-12 h-12 mx-auto mb-4 rounded-xl object-contain opacity-60" />
                <p className="text-base font-semibold text-white mb-1.5">Nothing found here</p>
                <p className="text-sm text-[var(--text-muted)] mb-6">Try a different genre or sorting option.</p>
                <button
                  onClick={() => {
                    setActiveGenre(null);
                    setSort("popular");
                  }}
                  className="h-10 px-6 rounded-full bg-[var(--accent-primary)] text-black text-sm font-bold hover:bg-[var(--accent-hover)] transition-colors"
                >
                  Reset filters
                </button>
              </div>
            )}
          </section>
        ) : (
          /* ── Browse mode: rich rows, lazily loaded ── */
          <>
            {cfg.baseRows.map((row) => (
              <LazyRow key={row.endpoint + row.title} {...row} />
            ))}

            {/* Personalized — only with real watch history of this type */}
            {seed && (
              <LazyRow
                title={`Because you watched ${seed.title}`}
                endpoint={`/media/recommendations/${seed.type}/${seed.id}`}
                layout="landscape"
              />
            )}

            {/* Genre rows */}
            {cfg.genres.map((g) => (
              <LazyRow
                key={g.id}
                title={g.label}
                endpoint={`/discover/${category}?genre=${g.id}`}
              />
            ))}
          </>
        )}
      </div>
    </main>
  );
}
