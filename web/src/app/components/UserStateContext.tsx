"use client";

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useMemo,
} from "react";
import { useAuth } from "./AuthContext";
import { api, apiSilent } from "../lib/api";

// ─── Types ─────────────────────────────────────────────────
export interface WatchHistoryItem {
  key: string; // `${id}:${season ?? 0}:${episode ?? 0}`
  id: string;
  type: string;
  title: string;
  posterUrl: string;
  rating: number;
  releaseYear: number;
  season?: number;
  episode?: number;
  episodeTitle?: string;
  progress: number; // 0-100
  positionSec?: number;
  durationSec?: number;
  lastWatched: number; // timestamp
}

export interface WatchlistItem {
  id: string;
  type: string;
  title: string;
  posterUrl: string;
  rating: number;
  releaseYear: number;
  addedAt: number;
}

export function historyKey(id: string, season?: number, episode?: number): string {
  return `${id}:${season ?? 0}:${episode ?? 0}`;
}

interface UserStateContextType {
  // Watch History
  watchHistory: WatchHistoryItem[];
  addToHistory: (item: Omit<WatchHistoryItem, "lastWatched" | "key">) => void;
  removeFromHistory: (key: string) => void;
  clearHistory: () => void;
  getWatchProgress: (id: string) => WatchHistoryItem | undefined;

  // Continue Watching (derived: progress < 95, newest first)
  continueWatching: WatchHistoryItem[];

  // Watchlist (My List)
  watchlist: WatchlistItem[];
  addToWatchlist: (item: Omit<WatchlistItem, "addedAt">) => void;
  removeFromWatchlist: (id: string) => void;
  isInWatchlist: (id: string) => boolean;

  // Favorites
  favorites: WatchlistItem[];
  addToFavorites: (item: Omit<WatchlistItem, "addedAt">) => void;
  removeFromFavorites: (id: string) => void;
  isInFavorites: (id: string) => boolean;

  // Recent searches
  recentSearches: string[];
  addRecentSearch: (q: string) => void;
  removeRecentSearch: (q: string) => void;
  clearRecentSearches: () => void;

  // True once the signed-in state has loaded from the server
  hydrated: boolean;
}

const noop = () => {};
const UserStateContext = createContext<UserStateContextType>({
  watchHistory: [],
  addToHistory: noop,
  removeFromHistory: noop,
  clearHistory: noop,
  getWatchProgress: () => undefined,
  continueWatching: [],
  watchlist: [],
  addToWatchlist: noop,
  removeFromWatchlist: noop,
  isInWatchlist: () => false,
  favorites: [],
  addToFavorites: noop,
  removeFromFavorites: noop,
  isInFavorites: () => false,
  recentSearches: [],
  addRecentSearch: noop,
  removeRecentSearch: noop,
  clearRecentSearches: noop,
  hydrated: false,
});

export function useUserState() {
  return useContext(UserStateContext);
}

function storageKey(base: string, userId?: string) {
  return userId ? `pureverse_${base}_${userId}` : `pureverse_${base}_guest`;
}

function readLocal<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function writeLocal(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* ignore */
  }
}

// Older saved history items predate the `key` field — backfill it.
function normalizeHistory(items: any[]): WatchHistoryItem[] {
  if (!Array.isArray(items)) return [];
  return items
    .filter((h) => h && typeof h.id === "string")
    .map((h) => ({ ...h, key: h.key || historyKey(h.id, h.season, h.episode) }));
}

export function UserStateProvider({ children }: { children: React.ReactNode }) {
  const { user, sessionEpoch } = useAuth();
  const userId = user?.id;
  const signedIn = !!user;

  const [watchHistory, setWatchHistory] = useState<WatchHistoryItem[]>([]);
  const [watchlist, setWatchlist] = useState<WatchlistItem[]>([]);
  const [favorites, setFavorites] = useState<WatchlistItem[]>([]);
  const [recentSearches, setRecentSearches] = useState<string[]>([]);
  const [hydrated, setHydrated] = useState(false);

  // ─── Load state: local cache first, then server when signed in ───
  useEffect(() => {
    setHydrated(false);
    // Local cache (guest data, or the per-user offline cache)
    setWatchHistory(normalizeHistory(readLocal(storageKey("history", userId), [])));
    setWatchlist(readLocal(storageKey("watchlist", userId), []));
    setFavorites(readLocal(storageKey("favorites", userId), []));
    setRecentSearches(readLocal(storageKey("searches", userId), []));

    if (!signedIn) {
      setHydrated(true);
      return;
    }

    let cancelled = false;
    api<{
      watchlist: WatchlistItem[];
      favorites: WatchlistItem[];
      history: any[];
      recentSearches: string[];
    }>("/user/state")
      .then((data) => {
        if (cancelled) return;
        const history = normalizeHistory(data.history);
        setWatchHistory(history);
        setWatchlist(data.watchlist || []);
        setFavorites(data.favorites || []);
        setRecentSearches(data.recentSearches || []);
        writeLocal(storageKey("history", userId), history);
        writeLocal(storageKey("watchlist", userId), data.watchlist || []);
        writeLocal(storageKey("favorites", userId), data.favorites || []);
        writeLocal(storageKey("searches", userId), data.recentSearches || []);
      })
      .catch(() => {})
      .finally(() => !cancelled && setHydrated(true));
    return () => {
      cancelled = true;
    };
    // sessionEpoch re-syncs after every fresh sign-in/out
  }, [userId, signedIn, sessionEpoch]);

  // ─── Watch history ───────────────────────────────────────
  const addToHistory = useCallback(
    (item: Omit<WatchHistoryItem, "lastWatched" | "key">) => {
      const key = historyKey(item.id, item.season, item.episode);
      const newItem: WatchHistoryItem = { ...item, key, lastWatched: Date.now() };
      setWatchHistory((prev) => {
        const updated = [newItem, ...prev.filter((h) => h.key !== key)].slice(0, 200);
        writeLocal(storageKey("history", userId), updated);
        return updated;
      });
      if (signedIn) apiSilent("/user/history", { method: "POST", body: newItem });
    },
    [userId, signedIn]
  );

  const removeFromHistory = useCallback(
    (key: string) => {
      setWatchHistory((prev) => {
        const updated = prev.filter((h) => h.key !== key);
        writeLocal(storageKey("history", userId), updated);
        return updated;
      });
      if (signedIn)
        apiSilent(`/user/history/${encodeURIComponent(key)}`, { method: "DELETE" });
    },
    [userId, signedIn]
  );

  const clearHistory = useCallback(() => {
    setWatchHistory([]);
    writeLocal(storageKey("history", userId), []);
    if (signedIn) apiSilent("/user/history", { method: "DELETE" });
  }, [userId, signedIn]);

  const getWatchProgress = useCallback(
    (id: string) => watchHistory.find((h) => h.id === id),
    [watchHistory]
  );

  const continueWatching = useMemo(
    () =>
      watchHistory
        .filter((h) => h.progress < 95)
        .sort((a, b) => b.lastWatched - a.lastWatched)
        .slice(0, 20),
    [watchHistory]
  );

  // ─── Watchlist & Favorites (shared logic) ────────────────
  const makeListOps = (
    field: "watchlist" | "favorites",
    items: WatchlistItem[],
    setItems: React.Dispatch<React.SetStateAction<WatchlistItem[]>>
  ) => ({
    add: (item: Omit<WatchlistItem, "addedAt">) => {
      setItems((prev) => {
        if (prev.some((w) => w.id === item.id)) return prev;
        const updated = [{ ...item, addedAt: Date.now() }, ...prev];
        writeLocal(storageKey(field, userId), updated);
        return updated;
      });
      if (signedIn) apiSilent(`/user/${field}`, { method: "POST", body: item });
    },
    remove: (id: string) => {
      setItems((prev) => {
        const updated = prev.filter((w) => w.id !== id);
        writeLocal(storageKey(field, userId), updated);
        return updated;
      });
      if (signedIn)
        apiSilent(`/user/${field}/${encodeURIComponent(id)}`, { method: "DELETE" });
    },
    has: (id: string) => items.some((w) => w.id === id),
  });

  const watchlistOps = makeListOps("watchlist", watchlist, setWatchlist);
  const favoritesOps = makeListOps("favorites", favorites, setFavorites);

  // ─── Recent searches ─────────────────────────────────────
  const addRecentSearch = useCallback(
    (q: string) => {
      const clean = q.trim().slice(0, 80);
      if (!clean) return;
      setRecentSearches((prev) => {
        const updated = [clean, ...prev.filter((s) => s.toLowerCase() !== clean.toLowerCase())].slice(0, 10);
        writeLocal(storageKey("searches", userId), updated);
        return updated;
      });
      if (signedIn) apiSilent("/user/searches", { method: "POST", body: { q: clean } });
    },
    [userId, signedIn]
  );

  const removeRecentSearch = useCallback(
    (q: string) => {
      setRecentSearches((prev) => {
        const updated = prev.filter((s) => s.toLowerCase() !== q.toLowerCase());
        writeLocal(storageKey("searches", userId), updated);
        return updated;
      });
      if (signedIn)
        apiSilent(`/user/searches/${encodeURIComponent(q)}`, { method: "DELETE" });
    },
    [userId, signedIn]
  );

  const clearRecentSearches = useCallback(() => {
    setRecentSearches([]);
    writeLocal(storageKey("searches", userId), []);
    if (signedIn) apiSilent("/user/searches", { method: "DELETE" });
  }, [userId, signedIn]);

  return (
    <UserStateContext.Provider
      value={{
        watchHistory,
        addToHistory,
        removeFromHistory,
        clearHistory,
        getWatchProgress,
        continueWatching,
        watchlist,
        addToWatchlist: watchlistOps.add,
        removeFromWatchlist: watchlistOps.remove,
        isInWatchlist: watchlistOps.has,
        favorites,
        addToFavorites: favoritesOps.add,
        removeFromFavorites: favoritesOps.remove,
        isInFavorites: favoritesOps.has,
        recentSearches,
        addRecentSearch,
        removeRecentSearch,
        clearRecentSearches,
        hydrated,
      }}
    >
      {children}
    </UserStateContext.Provider>
  );
}
