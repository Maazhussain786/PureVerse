"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useAuth } from "../components/AuthContext";
import { useUserState } from "../components/UserStateContext";
import { useNotifications } from "../components/NotificationContext";
import AvatarPicker from "../components/AvatarPicker";
import MediaCard from "../components/MediaCard";
import { defaultAvatar } from "../lib/avatars";
import { proxyImage } from "../lib/api";

function joinDate(timestamp?: number): string {
  if (!timestamp) return "—";
  return new Date(timestamp).toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
  });
}

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

function watchHref(item: { type: string; id: string; season?: number; episode?: number }) {
  return item.season && item.episode
    ? `/watch/${item.type}/${item.id}?season=${item.season}&episode=${item.episode}`
    : `/watch/${item.type}/${item.id}`;
}

// ─── Small building blocks ─────────────────────────────────

function Toggle({
  checked,
  onChange,
  label,
  description,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
  description?: string;
}) {
  return (
    <button
      onClick={() => onChange(!checked)}
      className="w-full flex items-center justify-between gap-4 py-3.5 text-left group"
      role="switch"
      aria-checked={checked}
    >
      <span>
        <span className="block text-sm font-medium text-white">{label}</span>
        {description && (
          <span className="block text-xs text-[var(--text-muted)] mt-0.5">{description}</span>
        )}
      </span>
      <span
        className={`relative flex-shrink-0 w-11 h-6 rounded-full transition-colors duration-300 ${
          checked ? "bg-[var(--accent-primary)]" : "bg-white/10 group-hover:bg-white/15"
        }`}
      >
        <span
          className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform duration-300 ${
            checked ? "translate-x-[22px]" : "translate-x-0.5"
          }`}
        />
      </span>
    </button>
  );
}

function StatTile({ value, label, icon, accent }: { value: number; label: string; icon: React.ReactNode; accent: string }) {
  return (
    <div className="glass-panel rounded-2xl p-5 flex items-center gap-4">
      <div className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: `${accent}1f`, color: accent }}>
        {icon}
      </div>
      <div>
        <p className="text-2xl font-bold text-white leading-none" style={{ fontFamily: "var(--font-space)" }}>{value}</p>
        <p className="text-xs text-[var(--text-muted)] mt-1.5">{label}</p>
      </div>
    </div>
  );
}

function SectionHeading({ title, action }: { title: string; action?: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between mb-4">
      <h2 className="text-lg md:text-xl font-bold text-white" style={{ fontFamily: "var(--font-space)" }}>
        {title}
      </h2>
      {action}
    </div>
  );
}

// ─── Page ──────────────────────────────────────────────────

export default function ProfilePage() {
  const { user, isSignedIn, booting, signIn, signOut, updateProfile } = useAuth();
  const {
    watchHistory,
    watchlist,
    favorites,
    continueWatching,
    removeFromHistory,
    clearHistory,
  } = useUserState();
  const { unreadCount } = useNotifications();

  const [avatarOpen, setAvatarOpen] = useState(false);
  const [editingName, setEditingName] = useState(false);
  const [nameDraft, setNameDraft] = useState("");
  const [confirmClear, setConfirmClear] = useState(false);

  // ─── Signed-out state ───
  if (!booting && !isSignedIn) {
    return (
      <main className="min-h-screen pt-32 px-6 flex flex-col items-center text-center">
        <div className="w-24 h-24 rounded-3xl bg-gradient-to-tr from-[var(--accent-primary)]/20 to-[var(--accent-teal)]/10 border border-[var(--accent-primary)]/20 flex items-center justify-center mb-6">
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="var(--accent-primary)" strokeWidth="1.5">
            <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" />
            <circle cx="12" cy="7" r="4" />
          </svg>
        </div>
        <h1 className="text-2xl md:text-3xl font-bold text-white mb-3" style={{ fontFamily: "var(--font-space)" }}>
          Your PureVerse profile awaits
        </h1>
        <p className="text-sm text-[var(--text-secondary)] max-w-md mb-8 leading-relaxed">
          Sign in to sync your watchlist, favorites, watch history and continue-watching
          across every device — plus notifications and watch parties.
        </p>
        <button onClick={signIn} className="btn-primary text-sm px-8 py-3">
          Sign In to PureVerse
        </button>
      </main>
    );
  }

  if (booting || !user) {
    return (
      <main className="min-h-screen pt-32 flex justify-center">
        <div className="w-10 h-10 border-2 border-[var(--accent-primary)] border-t-transparent rounded-full animate-spin" />
      </main>
    );
  }

  const avatar = user.avatar || defaultAvatar(user.name);
  const recentHistory = watchHistory.slice(0, 12);

  const saveName = () => {
    const clean = nameDraft.trim();
    if (clean.length >= 2 && clean !== user.name) updateProfile({ name: clean });
    setEditingName(false);
  };

  return (
    <main className="min-h-screen pt-24 pb-28 lg:pb-16 px-5 md:px-10 lg:px-14 max-w-[1200px] mx-auto">
      {/* ─── Identity card ─── */}
      <section className="relative overflow-hidden rounded-3xl border border-white/[0.07] mb-8">
        <div className="absolute inset-0 bg-gradient-to-br from-[var(--accent-primary)]/[0.12] via-transparent to-[var(--accent-teal)]/[0.08]" />
        <div className="absolute -top-24 -right-24 w-72 h-72 rounded-full bg-[var(--accent-primary)]/10 blur-3xl" />
        <div className="relative p-6 md:p-10 flex flex-col sm:flex-row items-center sm:items-start gap-6">
          {/* Avatar */}
          <button
            onClick={() => setAvatarOpen(true)}
            className="group relative flex-shrink-0"
            aria-label="Change avatar"
          >
            <div className="w-28 h-28 md:w-32 md:h-32 rounded-3xl overflow-hidden ring-2 ring-[var(--accent-primary)]/40 shadow-[0_0_40px_var(--accent-subtle)]">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={avatar} alt={user.name} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
            </div>
            <span className="absolute inset-0 rounded-3xl bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center gap-1">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
                <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
              </svg>
              <span className="text-[10px] font-bold text-white uppercase tracking-wider">Change</span>
            </span>
          </button>

          {/* Identity */}
          <div className="flex-1 min-w-0 text-center sm:text-left">
            <div className="flex items-center justify-center sm:justify-start gap-3 flex-wrap">
              {editingName ? (
                <span className="flex items-center gap-2">
                  <input
                    autoFocus
                    value={nameDraft}
                    onChange={(e) => setNameDraft(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") saveName();
                      if (e.key === "Escape") setEditingName(false);
                    }}
                    maxLength={40}
                    className="px-3 py-1.5 rounded-lg bg-black/40 border border-[var(--accent-primary)]/40 text-xl md:text-2xl font-bold text-white outline-none w-56"
                    style={{ fontFamily: "var(--font-space)" }}
                  />
                  <button onClick={saveName} className="p-2 rounded-lg bg-[var(--accent-primary)] text-black" aria-label="Save name">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M20 6 9 17l-5-5" /></svg>
                  </button>
                </span>
              ) : (
                <>
                  <h1 className="text-2xl md:text-3xl font-bold text-white truncate" style={{ fontFamily: "var(--font-space)" }}>
                    {user.name}
                  </h1>
                  <button
                    onClick={() => { setNameDraft(user.name); setEditingName(true); }}
                    className="p-1.5 rounded-lg text-[var(--text-muted)] hover:text-white hover:bg-white/10 transition-colors"
                    title="Edit username"
                  >
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
                    </svg>
                  </button>
                </>
              )}
              <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${user.isGuest ? "bg-white/10 text-[var(--text-secondary)]" : "bg-[var(--accent-primary)]/15 text-[var(--accent-primary)]"}`}>
                {user.isGuest ? "Guest" : "Google"}
              </span>
            </div>
            <p className="text-sm text-[var(--text-secondary)] mt-1.5">{user.email}</p>
            <p className="text-xs text-[var(--text-muted)] mt-1">
              Member since {joinDate(user.createdAt)}
              {unreadCount > 0 && (
                <span className="ml-3 text-[var(--accent-primary)] font-semibold">
                  {unreadCount} unread notification{unreadCount !== 1 ? "s" : ""}
                </span>
              )}
            </p>

            <div className="flex items-center justify-center sm:justify-start gap-2.5 mt-5 flex-wrap">
              <button onClick={() => setAvatarOpen(true)} className="btn-glass text-xs px-4 py-2">
                Change Avatar
              </button>
              <Link href="/mylist" className="btn-glass text-xs px-4 py-2">My List</Link>
              <Link href="/history" className="btn-glass text-xs px-4 py-2">Watch History</Link>
              <button
                onClick={signOut}
                className="btn-glass text-xs px-4 py-2 text-red-400 border-red-400/20 hover:border-red-400/40"
              >
                Sign Out
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* ─── Stats ─── */}
      <section className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-12">
        <StatTile
          value={watchHistory.length}
          label="Titles watched"
          accent="#34D399"
          icon={<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></svg>}
        />
        <StatTile
          value={watchlist.length}
          label="In My List"
          accent="#00F5D4"
          icon={<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 5v14M5 12h14" /></svg>}
        />
        <StatTile
          value={favorites.length}
          label="Favorites"
          accent="#f43f5e"
          icon={<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z" /></svg>}
        />
      </section>

      {/* ─── Continue Watching ─── */}
      {continueWatching.length > 0 && (
        <section className="mb-12">
          <SectionHeading title="Continue Watching" />
          <div className="flex gap-4 overflow-x-auto hide-scrollbar row-scroller -my-6">
            {continueWatching.map((item) => (
              <MediaCard
                key={item.key}
                id={item.id}
                type={item.type}
                title={item.title}
                posterUrl={item.posterUrl}
                rating={item.rating}
                releaseYear={item.releaseYear}
                progress={item.progress}
                episodeLabel={item.season && item.episode ? `S${item.season} E${item.episode}` : undefined}
                href={watchHref(item)}
                onRemove={() => removeFromHistory(item.key)}
              />
            ))}
          </div>
        </section>
      )}

      {/* ─── Recently Watched ─── */}
      <section className="mb-12">
        <SectionHeading
          title="Recently Watched"
          action={
            watchHistory.length > 0 ? (
              <div className="flex items-center gap-3">
                <Link href="/history" className="text-xs font-semibold text-[var(--accent-primary)] hover:text-[var(--accent-hover)] transition-colors">
                  View all →
                </Link>
              </div>
            ) : undefined
          }
        />
        {recentHistory.length === 0 ? (
          <div className="glass-panel rounded-2xl p-10 text-center">
            <p className="text-sm text-[var(--text-muted)]">
              Nothing watched yet — your recent titles will appear here.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {recentHistory.map((item) => (
              <div key={item.key} className="glass-panel glass-panel-hover rounded-xl p-3 flex gap-3 items-center group relative">
                <Link href={watchHref(item)} className="flex gap-3 items-center flex-1 min-w-0">
                  <div className="flex-shrink-0 w-[52px] aspect-[2/3] rounded-lg overflow-hidden bg-[var(--bg-card)] relative">
                    {item.posterUrl && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={proxyImage(item.posterUrl)} alt="" className="w-full h-full object-cover" loading="lazy" referrerPolicy="no-referrer" />
                    )}
                    <div className="absolute bottom-0 left-0 right-0 h-[3px] bg-white/10">
                      <div className="h-full bg-[var(--accent-primary)]" style={{ width: `${item.progress}%` }} />
                    </div>
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="text-sm font-semibold text-white truncate group-hover:text-[var(--accent-primary)] transition-colors">
                      {item.title}
                    </h3>
                    <p className="text-xs text-[var(--text-muted)] mt-0.5">
                      {item.season && item.episode ? `S${item.season} E${item.episode} · ` : ""}
                      {timeAgo(item.lastWatched)} · {item.progress}% watched
                    </p>
                  </div>
                </Link>
                <button
                  onClick={() => removeFromHistory(item.key)}
                  className="flex-shrink-0 w-7 h-7 rounded-full bg-white/5 hover:bg-red-500/80 flex items-center justify-center text-[var(--text-muted)] hover:text-white transition-all"
                  title="Remove from history"
                  aria-label={`Remove ${item.title} from history`}
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <path d="M18 6 6 18M6 6l12 12" />
                  </svg>
                </button>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* ─── Settings ─── */}
      <section className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-12">
        {/* Playback */}
        <div className="glass-panel rounded-2xl p-6">
          <h3 className="text-base font-bold text-white mb-2" style={{ fontFamily: "var(--font-space)" }}>
            Playback
          </h3>
          <div className="divide-y divide-white/[0.05]">
            <Toggle
              checked={user.preferences.autoplayNext}
              onChange={(v) => updateProfile({ preferences: { autoplayNext: v } })}
              label="Autoplay next episode"
              description="Show the up-next prompt when an episode ends"
            />
            <div className="py-3.5 flex items-center justify-between gap-4">
              <span>
                <span className="block text-sm font-medium text-white">Preferred anime audio</span>
                <span className="block text-xs text-[var(--text-muted)] mt-0.5">Pre-selects SUB or DUB servers</span>
              </span>
              <div className="flex rounded-full bg-white/5 border border-white/10 p-0.5">
                {(["sub", "dub"] as const).map((opt) => (
                  <button
                    key={opt}
                    onClick={() => updateProfile({ preferences: { preferredAudio: opt } })}
                    className={`px-4 py-1.5 rounded-full text-xs font-bold uppercase tracking-wide transition-all ${
                      user.preferences.preferredAudio === opt
                        ? "bg-[var(--accent-primary)] text-black"
                        : "text-[var(--text-secondary)] hover:text-white"
                    }`}
                  >
                    {opt}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Notifications */}
        <div className="glass-panel rounded-2xl p-6">
          <h3 className="text-base font-bold text-white mb-2" style={{ fontFamily: "var(--font-space)" }}>
            Notifications
          </h3>
          <div className="divide-y divide-white/[0.05]">
            <Toggle
              checked={user.preferences.notifyNewEpisodes}
              onChange={(v) => updateProfile({ preferences: { notifyNewEpisodes: v } })}
              label="New episodes & seasons"
              description="For series and anime in your list or favorites"
            />
            <Toggle
              checked={user.preferences.notifyPartyInvites}
              onChange={(v) => updateProfile({ preferences: { notifyPartyInvites: v } })}
              label="Watch party invitations"
              description="When someone invites you to a room"
            />
            <Toggle
              checked={user.preferences.notifyAnnouncements}
              onChange={(v) => updateProfile({ preferences: { notifyAnnouncements: v } })}
              label="PureVerse announcements"
              description="Product news and feature updates"
            />
          </div>
        </div>
      </section>

      {/* ─── Danger zone ─── */}
      <section className="glass-panel rounded-2xl p-6 border-red-500/10">
        <h3 className="text-base font-bold text-white mb-4" style={{ fontFamily: "var(--font-space)" }}>
          Data & Account
        </h3>
        <div className="flex flex-wrap items-center gap-3">
          {confirmClear ? (
            <span className="flex items-center gap-2">
              <span className="text-sm text-red-400">Clear all {watchHistory.length} history items?</span>
              <button
                onClick={() => { clearHistory(); setConfirmClear(false); }}
                className="px-4 py-2 rounded-full text-xs font-bold text-white bg-red-500 hover:bg-red-600 transition-colors"
              >
                Yes, clear
              </button>
              <button onClick={() => setConfirmClear(false)} className="btn-glass text-xs px-4 py-2">
                Cancel
              </button>
            </span>
          ) : (
            <button
              onClick={() => setConfirmClear(true)}
              disabled={watchHistory.length === 0}
              className="btn-glass text-xs px-4 py-2 text-red-400 border-red-400/20 hover:border-red-400/40 disabled:opacity-40"
            >
              Clear watch history
            </button>
          )}
          <button onClick={signOut} className="btn-glass text-xs px-4 py-2">
            Sign out of PureVerse
          </button>
        </div>
      </section>

      {/* ─── Avatar Picker ─── */}
      <AvatarPicker
        open={avatarOpen}
        currentAvatar={user.avatar}
        onSelect={(url) => {
          updateProfile({ avatar: url });
          setAvatarOpen(false);
        }}
        onClose={() => setAvatarOpen(false)}
      />
    </main>
  );
}
