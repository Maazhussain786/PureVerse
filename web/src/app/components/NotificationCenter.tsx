"use client";

import React from "react";
import { useRouter } from "next/navigation";
import { useNotifications, NotificationItem } from "./NotificationContext";
import { useAuth } from "./AuthContext";

function timeAgo(timestamp: number): string {
  const diff = Date.now() - timestamp;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(timestamp).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function KindIcon({ kind }: { kind: NotificationItem["kind"] }) {
  if (kind === "episode")
    return (
      <span className="w-9 h-9 rounded-xl bg-[var(--accent-primary)]/12 text-[var(--accent-primary)] flex items-center justify-center flex-shrink-0">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="12" cy="12" r="10" />
          <polygon points="10 8 16 12 10 16 10 8" fill="currentColor" stroke="none" />
        </svg>
      </span>
    );
  if (kind === "season")
    return (
      <span className="w-9 h-9 rounded-xl bg-[var(--accent-teal-subtle)] text-[var(--accent-teal)] flex items-center justify-center flex-shrink-0">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="m12 3-1.9 5.8a2 2 0 0 1-1.3 1.3L3 12l5.8 1.9a2 2 0 0 1 1.3 1.3L12 21l1.9-5.8a2 2 0 0 1 1.3-1.3L21 12l-5.8-1.9a2 2 0 0 1-1.3-1.3Z" />
        </svg>
      </span>
    );
  if (kind === "party_invite")
    return (
      <span className="w-9 h-9 rounded-xl bg-violet-500/12 text-violet-400 flex items-center justify-center flex-shrink-0">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
          <circle cx="9" cy="7" r="4" />
          <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
          <path d="M16 3.13a4 4 0 0 1 0 7.75" />
        </svg>
      </span>
    );
  return (
    <span className="w-9 h-9 rounded-xl bg-white/8 text-[var(--text-secondary)] flex items-center justify-center flex-shrink-0">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
        <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
      </svg>
    </span>
  );
}

export default function NotificationCenter({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const { isSignedIn, signIn } = useAuth();
  const { notifications, unreadCount, markRead, markAllRead, remove, clearAll } = useNotifications();

  const open = (n: NotificationItem) => {
    markRead(n.id);
    onClose();
    if (n.link) router.push(n.link);
  };

  return (
    <div className="fixed sm:absolute inset-x-3 sm:inset-x-auto top-[72px] sm:top-[calc(100%+10px)] sm:right-0 z-[80] w-auto sm:w-[400px] max-h-[72vh] flex flex-col rounded-2xl bg-[var(--bg-card)] border border-white/10 shadow-[0_24px_70px_rgba(0,0,0,0.8)] overflow-hidden animate-slide-down">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-white/[0.06] flex-shrink-0">
        <h3 className="text-sm font-bold text-white flex items-center gap-2" style={{ fontFamily: "var(--font-space)" }}>
          Notifications
          {unreadCount > 0 && (
            <span className="px-1.5 py-0.5 rounded-full bg-[var(--accent-primary)] text-black text-[10px] font-black">
              {unreadCount}
            </span>
          )}
        </h3>
        {isSignedIn && notifications.length > 0 && (
          <div className="flex items-center gap-3">
            {unreadCount > 0 && (
              <button
                onClick={markAllRead}
                className="text-xs font-semibold text-[var(--accent-primary)] hover:text-[var(--accent-hover)] transition-colors"
              >
                Mark all read
              </button>
            )}
            <button
              onClick={clearAll}
              className="text-xs text-[var(--text-muted)] hover:text-red-400 transition-colors"
            >
              Clear
            </button>
          </div>
        )}
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto custom-scrollbar">
        {!isSignedIn ? (
          <div className="px-6 py-10 text-center">
            <p className="text-sm text-[var(--text-secondary)] mb-4">
              Sign in to get alerts when new episodes of your shows drop.
            </p>
            <button
              onClick={() => { onClose(); signIn(); }}
              className="btn-primary btn-sm"
            >
              Sign In
            </button>
          </div>
        ) : notifications.length === 0 ? (
          <div className="px-6 py-12 text-center">
            <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="1.5" className="mx-auto mb-3 opacity-50">
              <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
              <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
            </svg>
            <p className="text-sm text-[var(--text-muted)]">
              You&apos;re all caught up. New-episode alerts for shows in your list will land here.
            </p>
          </div>
        ) : (
          <ul>
            {notifications.map((n) => (
              <li
                key={n.id}
                className={`group relative flex gap-3 px-4 py-3.5 border-b border-white/[0.04] cursor-pointer transition-colors hover:bg-white/[0.04] ${
                  !n.read ? "bg-[var(--accent-primary)]/[0.045]" : ""
                }`}
                onClick={() => open(n)}
              >
                {n.image ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={n.image} alt="" className="w-9 h-[52px] rounded-lg object-cover flex-shrink-0" loading="lazy" />
                ) : (
                  <KindIcon kind={n.kind} />
                )}
                <div className="flex-1 min-w-0 pr-5">
                  <p className={`text-[13px] leading-snug ${!n.read ? "text-white font-semibold" : "text-[var(--text-secondary)] font-medium"}`}>
                    {n.title}
                  </p>
                  <p className="text-xs text-[var(--text-muted)] mt-0.5 line-clamp-2">{n.body}</p>
                  <p className="text-[10px] text-[var(--text-muted)] mt-1">{timeAgo(n.createdAt)}</p>
                </div>
                {!n.read && (
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 w-2 h-2 rounded-full bg-[var(--accent-primary)] shadow-[0_0_8px_var(--accent-glow)] group-hover:opacity-0 transition-opacity" />
                )}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    remove(n.id);
                  }}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 w-6 h-6 rounded-full bg-white/5 hover:bg-red-500/80 text-[var(--text-muted)] hover:text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all"
                  title="Delete notification"
                  aria-label="Delete notification"
                >
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <path d="M18 6 6 18M6 6l12 12" />
                  </svg>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
