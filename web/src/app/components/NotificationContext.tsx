"use client";

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useRef,
} from "react";
import { useAuth } from "./AuthContext";
import { api, apiSilent } from "../lib/api";

export interface NotificationItem {
  id: string;
  kind: "episode" | "season" | "party_invite" | "system";
  title: string;
  body: string;
  image?: string;
  link?: string;
  createdAt: number;
  read: boolean;
}

interface NotificationContextType {
  notifications: NotificationItem[];
  unreadCount: number;
  markRead: (id: string) => void;
  markAllRead: () => void;
  remove: (id: string) => void;
  clearAll: () => void;
  refresh: () => void;
}

const noop = () => {};
const NotificationContext = createContext<NotificationContextType>({
  notifications: [],
  unreadCount: 0,
  markRead: noop,
  markAllRead: noop,
  remove: noop,
  clearAll: noop,
  refresh: noop,
});

export function useNotifications() {
  return useContext(NotificationContext);
}

const POLL_MS = 60_000;

export function NotificationProvider({ children }: { children: React.ReactNode }) {
  const { isSignedIn, sessionEpoch } = useAuth();
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const lastServerRefresh = useRef(0);

  const fetchNotifications = useCallback(async () => {
    if (!isSignedIn) return;
    // Ask the backend to re-check TMDB at most every 5 minutes
    const wantsRefresh = Date.now() - lastServerRefresh.current > 5 * 60_000;
    if (wantsRefresh) lastServerRefresh.current = Date.now();
    try {
      const data = await api<{ notifications: NotificationItem[] }>(
        `/user/notifications${wantsRefresh ? "?refresh=1" : ""}`
      );
      setNotifications(data.notifications || []);
    } catch {
      /* keep stale list */
    }
  }, [isSignedIn]);

  useEffect(() => {
    if (!isSignedIn) {
      setNotifications([]);
      return;
    }
    fetchNotifications();
    const interval = setInterval(fetchNotifications, POLL_MS);
    return () => clearInterval(interval);
  }, [isSignedIn, sessionEpoch, fetchNotifications]);

  const markRead = useCallback((id: string) => {
    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)));
    apiSilent(`/user/notifications/${id}/read`, { method: "POST" });
  }, []);

  const markAllRead = useCallback(() => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    apiSilent("/user/notifications/read-all", { method: "POST" });
  }, []);

  const remove = useCallback((id: string) => {
    setNotifications((prev) => prev.filter((n) => n.id !== id));
    apiSilent(`/user/notifications/${id}`, { method: "DELETE" });
  }, []);

  const clearAll = useCallback(() => {
    setNotifications([]);
    apiSilent("/user/notifications", { method: "DELETE" });
  }, []);

  return (
    <NotificationContext.Provider
      value={{
        notifications,
        unreadCount: notifications.filter((n) => !n.read).length,
        markRead,
        markAllRead,
        remove,
        clearAll,
        refresh: fetchNotifications,
      }}
    >
      {children}
    </NotificationContext.Provider>
  );
}
