"use client";

import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import { useAuth } from "./AuthContext";

// ── Types ─────────────────────────────────────────────────
export interface WatchHistoryItem {
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

interface UserStateContextType {
  // Watch History
  watchHistory: WatchHistoryItem[];
  addToHistory: (item: Omit<WatchHistoryItem, "lastWatched">) => void;
  clearHistory: () => void;
  getWatchProgress: (id: string) => WatchHistoryItem | undefined;

  // Continue Watching (derived from history: items with progress < 95)
  continueWatching: WatchHistoryItem[];

  // Watchlist (My List)
  watchlist: WatchlistItem[];
  addToWatchlist: (item: Omit<WatchlistItem, "addedAt">) => void;
  removeFromWatchlist: (id: string) => void;
  isInWatchlist: (id: string) => boolean;
}

const UserStateContext = createContext<UserStateContextType>({
  watchHistory: [],
  addToHistory: () => {},
  clearHistory: () => {},
  getWatchProgress: () => undefined,
  continueWatching: [],
  watchlist: [],
  addToWatchlist: () => {},
  removeFromWatchlist: () => {},
  isInWatchlist: () => false,
});

export function useUserState() {
  return useContext(UserStateContext);
}

function getStorageKey(base: string, userId?: string) {
  return userId ? `pureverse_${base}_${userId}` : `pureverse_${base}_guest`;
}

export function UserStateProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const userId = user?.email;

  const [watchHistory, setWatchHistory] = useState<WatchHistoryItem[]>([]);
  const [watchlist, setWatchlist] = useState<WatchlistItem[]>([]);

  // Load from localStorage on mount and user change
  useEffect(() => {
    try {
      const historyKey = getStorageKey("history", userId);
      const listKey = getStorageKey("watchlist", userId);

      const storedHistory = localStorage.getItem(historyKey);
      const storedList = localStorage.getItem(listKey);

      setWatchHistory(storedHistory ? JSON.parse(storedHistory) : []);
      setWatchlist(storedList ? JSON.parse(storedList) : []);
    } catch {
      // ignore
    }
  }, [userId]);

  // Persist history
  const persistHistory = useCallback(
    (items: WatchHistoryItem[]) => {
      try {
        localStorage.setItem(getStorageKey("history", userId), JSON.stringify(items));
      } catch { /* ignore */ }
    },
    [userId]
  );

  // Persist watchlist
  const persistWatchlist = useCallback(
    (items: WatchlistItem[]) => {
      try {
        localStorage.setItem(getStorageKey("watchlist", userId), JSON.stringify(items));
      } catch { /* ignore */ }
    },
    [userId]
  );

  const addToHistory = useCallback(
    (item: Omit<WatchHistoryItem, "lastWatched">) => {
      setWatchHistory((prev) => {
        // Remove existing entry for this item (update in place)
        const filtered = prev.filter((h) => !(h.id === item.id && h.season === item.season && h.episode === item.episode));
        const newItem: WatchHistoryItem = { ...item, lastWatched: Date.now() };
        const updated = [newItem, ...filtered].slice(0, 100); // Keep last 100
        persistHistory(updated);
        return updated;
      });
    },
    [persistHistory]
  );

  const clearHistory = useCallback(() => {
    setWatchHistory([]);
    persistHistory([]);
  }, [persistHistory]);

  const getWatchProgress = useCallback(
    (id: string) => {
      return watchHistory.find((h) => h.id === id);
    },
    [watchHistory]
  );

  // Continue watching: items with < 95% progress, sorted by most recent
  const continueWatching = watchHistory
    .filter((h) => h.progress < 95)
    .sort((a, b) => b.lastWatched - a.lastWatched)
    .slice(0, 20);

  const addToWatchlist = useCallback(
    (item: Omit<WatchlistItem, "addedAt">) => {
      setWatchlist((prev) => {
        if (prev.some((w) => w.id === item.id)) return prev;
        const updated = [{ ...item, addedAt: Date.now() }, ...prev];
        persistWatchlist(updated);
        return updated;
      });
    },
    [persistWatchlist]
  );

  const removeFromWatchlist = useCallback(
    (id: string) => {
      setWatchlist((prev) => {
        const updated = prev.filter((w) => w.id !== id);
        persistWatchlist(updated);
        return updated;
      });
    },
    [persistWatchlist]
  );

  const isInWatchlist = useCallback(
    (id: string) => {
      return watchlist.some((w) => w.id === id);
    },
    [watchlist]
  );

  return (
    <UserStateContext.Provider
      value={{
        watchHistory,
        addToHistory,
        clearHistory,
        getWatchProgress,
        continueWatching,
        watchlist,
        addToWatchlist,
        removeFromWatchlist,
        isInWatchlist,
      }}
    >
      {children}
    </UserStateContext.Provider>
  );
}
