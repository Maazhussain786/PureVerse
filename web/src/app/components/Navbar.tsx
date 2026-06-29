"use client";

import React, { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "./AuthContext";
import { useUserState } from "./UserStateContext";
import { useNotifications } from "./NotificationContext";
import NotificationCenter from "./NotificationCenter";
import { defaultAvatar } from "../lib/avatars";
import { API_BASE, proxyImage } from "../lib/api";

const NAV_LINKS = [
  { href: "/", label: "Home" },
  { href: "/movies", label: "Movies" },
  { href: "/series", label: "Series" },
  { href: "/anime", label: "Anime" },
  { href: "/party", label: "Party" },
];

type SearchCat = "all" | "movie" | "tv" | "anime";

const SEARCH_CATS: { key: SearchCat; label: string }[] = [
  { key: "all", label: "All" },
  { key: "movie", label: "Movies" },
  { key: "tv", label: "Series" },
  { key: "anime", label: "Anime" },
];

function searchTypeLabel(type: string): string {
  if (type === "movie") return "Movie";
  if (type === "tv") return "Series";
  if (type === "anime") return "Anime";
  return type;
}

function ratingTone(rating: number): string {
  if (rating >= 7) return "rating-high";
  if (rating >= 5) return "rating-mid";
  return "rating-low";
}

export default function Navbar() {
  const { user, isSignedIn, signIn, signOut } = useAuth();
  const { recentSearches, addRecentSearch, removeRecentSearch, clearRecentSearches } = useUserState();
  const { unreadCount } = useNotifications();
  const router = useRouter();
  const pathname = usePathname();
  const isActive = (href: string) =>
    href === "/" ? pathname === "/" : pathname.startsWith(href);

  const [scrolled, setScrolled] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchCat, setSearchCat] = useState<SearchCat>("all");
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [trending, setTrending] = useState<any[]>([]);
  const [profileOpen, setProfileOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const profileRef = useRef<HTMLDivElement>(null);
  const notifRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 40);
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  // Ctrl+K shortcut
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setSearchOpen((prev) => !prev);
      }
      if (e.key === "Escape") {
        setSearchOpen(false);
        setProfileOpen(false);
        setNotifOpen(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  // Close dropdowns on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (profileRef.current && !profileRef.current.contains(e.target as Node)) {
        setProfileOpen(false);
      }
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) {
        setNotifOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Lazy-load rich trending suggestions when the overlay opens
  useEffect(() => {
    if (!searchOpen || trending.length > 0) return;
    fetch(`${API_BASE}/trending`)
      .then((r) => r.json())
      .then((j) => setTrending((j.data || []).slice(0, 12)))
      .catch(() => {});
  }, [searchOpen, trending.length]);

  // Auto-focus the input each time the overlay opens
  useEffect(() => {
    if (searchOpen) {
      const t = setTimeout(() => searchInputRef.current?.focus(), 60);
      return () => clearTimeout(t);
    }
  }, [searchOpen]);

  // Live search (fast suggest endpoint)
  useEffect(() => {
    if (!searchQuery.trim()) {
      setSearchResults([]);
      setIsSearching(false);
      return;
    }
    setIsSearching(true);
    const timeoutId = setTimeout(async () => {
      try {
        const res = await fetch(`${API_BASE}/search?q=${encodeURIComponent(searchQuery.trim())}&limit=18`);
        if (res.ok) {
          const json = await res.json();
          setSearchResults(json.data || []);
        }
      } catch {
        /* ignore */
      } finally {
        setIsSearching(false);
      }
    }, 300);
    return () => clearTimeout(timeoutId);
  }, [searchQuery]);

  const closeSearch = () => {
    setSearchOpen(false);
    setSearchQuery("");
    setSearchCat("all");
  };

  // Live results filtered by the active category tab
  const catCounts = searchResults.reduce(
    (acc, r) => {
      acc.all++;
      if (r.type === "movie") acc.movie++;
      else if (r.type === "tv") acc.tv++;
      else if (r.type === "anime") acc.anime++;
      return acc;
    },
    { all: 0, movie: 0, tv: 0, anime: 0 } as Record<SearchCat, number>
  );
  const visibleResults =
    searchCat === "all" ? searchResults : searchResults.filter((r) => r.type === searchCat);
  const visibleTrending =
    searchCat === "all" ? trending : trending.filter((t) => t.type === searchCat);

  const handleSearchSubmit = (e: React.FormEvent | React.MouseEvent) => {
    e.preventDefault();
    const q = searchQuery.trim();
    if (q) {
      addRecentSearch(q);
      router.push(`/search?q=${encodeURIComponent(q)}`);
      closeSearch();
    }
  };

  const avatarSrc = user?.avatar || defaultAvatar(user?.name || "U");

  return (
    <>
      <nav
        className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
          scrolled
            ? "bg-[rgba(9,9,12,0.85)] backdrop-blur-2xl backdrop-saturate-150 border-b border-white/[0.06] shadow-[0_8px_30px_rgba(0,0,0,0.5)]"
            : "bg-gradient-to-b from-black/80 via-black/40 to-transparent"
        }`}
      >
        <div className="relative w-full mx-auto px-5 md:px-8 lg:px-16 h-[68px] flex items-center justify-between gap-4">
          {/* Left: Logo */}
          <Link href="/" className="flex items-center group z-10">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/logos/Complete_logo.jpg"
              alt="PureVerse"
              className="h-10 md:h-12 w-auto object-contain transition-transform duration-300 group-hover:scale-105"
            />
          </Link>

          {/* Center: Desktop Nav Links */}
          <div className="absolute left-1/2 -translate-x-1/2 hidden lg:flex items-center gap-6 z-0">
            {NAV_LINKS.map((link) => {
              const active = isActive(link.href);
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  aria-current={active ? "page" : undefined}
                  className={`relative py-2 text-[15px] font-semibold transition-all duration-300 ${
                    active ? "text-white" : "text-[var(--text-secondary)] hover:text-white"
                  }`}
                >
                  {link.label}
                  {active && (
                    <span className="absolute left-1/2 -translate-x-1/2 -bottom-[18px] w-1.5 h-1.5 rounded-full bg-white shadow-[0_0_8px_rgba(255,255,255,0.8)]" />
                  )}
                </Link>
              );
            })}
          </div>

          {/* Right Side: Icons + Profile */}
          <div className="flex items-center gap-1.5 sm:gap-2.5">
            {/* Search */}
            <button
              onClick={() => setSearchOpen(true)}
              aria-label="Search (Ctrl+K)"
              className="relative p-2 flex items-center justify-center text-[var(--text-secondary)] hover:text-white transition-colors"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="11" cy="11" r="8" />
                <path d="m21 21-4.3-4.3" />
              </svg>
            </button>

            {/* Notifications */}
            <div className="relative flex items-center justify-center" ref={notifRef}>
              <button
                onClick={() => setNotifOpen((v) => !v)}
                className={`relative p-2 flex items-center justify-center transition-colors ${notifOpen ? "text-white" : "text-[var(--text-secondary)] hover:text-white"}`}
                aria-label={`Notifications${unreadCount > 0 ? ` (${unreadCount} unread)` : ""}`}
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
                  <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
                </svg>
                {unreadCount > 0 && (
                  <span className="absolute top-1 right-0.5 min-w-[16px] h-4 px-1 rounded-full bg-[var(--accent-primary)] text-black text-[9px] font-black flex items-center justify-center border-2 border-[var(--bg-primary)]">
                    {unreadCount > 9 ? "9+" : unreadCount}
                  </span>
                )}
              </button>
              {notifOpen && <NotificationCenter onClose={() => setNotifOpen(false)} />}
            </div>

            {/* User Profile / Sign In */}
            <div className="relative flex items-center justify-center" ref={profileRef}>
              {isSignedIn ? (
                <button
                  onClick={() => setProfileOpen(!profileOpen)}
                  className="w-9 h-9 flex items-center justify-center rounded-full overflow-hidden border-2 border-transparent hover:border-[var(--accent-primary)]/40 transition-all shadow-[0_0_10px_var(--accent-subtle)]"
                  aria-label="Profile menu"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={avatarSrc} alt={user?.name || "Profile"} referrerPolicy="no-referrer" className="w-full h-full object-cover block" />
                </button>
              ) : (
                <button
                  onClick={signIn}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[var(--accent-primary)] text-black text-sm font-bold hover:bg-[var(--accent-hover)] transition-all hover:shadow-[0_0_15px_var(--accent-glow)]"
                  style={{ padding: "8px 16px", gap: "8px" }}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" />
                    <circle cx="12" cy="7" r="4" />
                  </svg>
                  <span className="hidden sm:inline">Sign In</span>
                </button>
              )}

              {/* Profile Dropdown */}
              {profileOpen && isSignedIn && (
                <div className="profile-dropdown animate-slide-down">
                  <Link href="/profile" onClick={() => setProfileOpen(false)} className="px-3 py-3 flex items-center gap-3 rounded-lg hover:bg-white/[0.04] transition-colors">
                    <div className="w-10 h-10 rounded-full overflow-hidden flex-shrink-0 ring-1 ring-[var(--accent-primary)]/30">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={avatarSrc} alt="" referrerPolicy="no-referrer" className="w-full h-full object-cover" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-white truncate">{user?.name}</p>
                      <p className="text-xs text-[var(--text-muted)] truncate">{user?.email}</p>
                    </div>
                  </Link>

                  <div className="profile-dropdown-divider" />

                  <Link href="/profile" onClick={() => setProfileOpen(false)} className="profile-dropdown-item">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" />
                      <circle cx="12" cy="7" r="4" />
                    </svg>
                    My Profile
                  </Link>
                  <Link href="/mylist" onClick={() => setProfileOpen(false)} className="profile-dropdown-item">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M12 5v14M5 12h14" />
                    </svg>
                    My List
                  </Link>
                  <Link href="/history" onClick={() => setProfileOpen(false)} className="profile-dropdown-item">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <circle cx="12" cy="12" r="10" />
                      <polyline points="12 6 12 12 16 14" />
                    </svg>
                    Watch History
                  </Link>
                  <Link href="/party" onClick={() => setProfileOpen(false)} className="profile-dropdown-item">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
                      <circle cx="9" cy="7" r="4" />
                      <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
                      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                    </svg>
                    Watch Party
                  </Link>

                  <div className="profile-dropdown-divider" />

                  <button
                    onClick={() => { signOut(); setProfileOpen(false); }}
                    className="profile-dropdown-item text-red-400 hover:text-red-300"
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                      <polyline points="16 17 21 12 16 7" />
                      <line x1="21" x2="9" y1="12" y2="12" />
                    </svg>
                    Sign Out
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </nav>

      {/* ─── Search Overlay ─── */}
      {searchOpen && (
        <div className="search-overlay fixed inset-0 z-[60] flex items-start justify-center pt-[9vh] px-4 animate-fade-in" style={{ zIndex: 60, paddingTop: "9vh", paddingLeft: "16px", paddingRight: "16px" }}>
          <div className="absolute inset-0" onClick={closeSearch} style={{ backgroundColor: "rgba(0,0,0,0.6)", backdropFilter: "blur(4px)" }} />
          <div className="relative w-full max-w-2xl animate-scale-in">
            <div className="bg-[var(--bg-card)]/95 backdrop-blur-2xl rounded-2xl overflow-hidden shadow-[0_30px_90px_rgba(0,0,0,0.85)] border border-white/10 flex flex-col max-h-[80vh]">
              {/* Input area */}
              <form onSubmit={handleSearchSubmit} className="flex-shrink-0">
                <div className="flex items-center px-5 sm:px-6 h-[68px] gap-3.5" style={{ gap: "14px", paddingLeft: "24px", paddingRight: "24px" }}>
                  {isSearching ? (
                    <div className="w-[22px] h-[22px] border-2 border-[var(--accent-primary)] border-t-transparent rounded-full animate-spin flex-shrink-0" />
                  ) : (
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="var(--accent-primary)" strokeWidth="2.5" className="flex-shrink-0">
                      <circle cx="11" cy="11" r="8" />
                      <path d="m21 21-4.3-4.3" />
                    </svg>
                  )}
                  <input
                    ref={searchInputRef}
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search movies, series, anime…"
                    className="flex-1 bg-transparent text-base sm:text-lg text-white placeholder:text-[var(--text-muted)] outline-none min-w-0"
                    autoFocus
                  />
                  {searchQuery && (
                    <button
                      type="button"
                      onClick={() => { setSearchQuery(""); searchInputRef.current?.focus(); }}
                      className="p-1.5 rounded-full text-[var(--text-muted)] hover:text-white hover:bg-white/10 transition-colors flex-shrink-0"
                      aria-label="Clear search"
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                        <path d="M18 6 6 18M6 6l12 12" />
                      </svg>
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={closeSearch}
                    className="hidden sm:block text-[10px] font-mono font-bold text-[var(--text-muted)] border border-white/10 rounded-md px-2 py-1 hover:text-white transition-colors bg-white/5 flex-shrink-0"
                    style={{ padding: "4px 8px" }}
                  >
                    ESC
                  </button>
                </div>
              </form>

              {/* Category tabs */}
              <div className="flex items-center gap-1.5 px-4 sm:px-5 pb-3 pt-0.5 border-b border-white/[0.06] overflow-x-auto hide-scrollbar flex-shrink-0" style={{ gap: "6px", paddingLeft: "20px", paddingRight: "20px", paddingBottom: "12px", paddingTop: "2px" }}>
                {SEARCH_CATS.map((c) => {
                  const active = searchCat === c.key;
                  const count = searchQuery ? catCounts[c.key] : 0;
                  return (
                    <button
                      key={c.key}
                      type="button"
                      onClick={() => setSearchCat(c.key)}
                      className={`flex-shrink-0 flex items-center gap-1.5 px-3.5 h-8 rounded-full text-[13px] font-semibold transition-all ${
                        active
                          ? "bg-[var(--accent-primary)] text-[#04130d] shadow-[0_0_14px_var(--accent-glow)]"
                          : "bg-white/[0.05] text-[var(--text-secondary)] border border-white/10 hover:text-white"
                      }`}
                      style={{ padding: "0 14px", gap: "6px" }}
                    >
                      {c.label}
                      {searchQuery && (
                        <span className={`text-[10px] font-bold px-1.5 py-px rounded-full ${active ? "bg-black/20 text-[#04130d]" : "bg-white/10 text-[var(--text-muted)]"}`} style={{ padding: "1px 6px" }}>
                          {count}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>

              {/* ── Body ── */}
              <div className="flex-1 overflow-y-auto custom-scrollbar p-3 sm:p-4" style={{ padding: "16px" }}>
                {/* Query → live suggestions */}
                {searchQuery ? (
                  isSearching && searchResults.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-44 gap-3">
                      <div className="w-7 h-7 border-2 border-[var(--accent-primary)] border-t-transparent rounded-full animate-spin" />
                      <p className="text-xs text-[var(--text-muted)]">Searching…</p>
                    </div>
                  ) : visibleResults.length > 0 ? (
                    <>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-1" style={{ gap: "4px" }}>
                        {visibleResults.slice(0, 12).map((item) => (
                          <Link
                            key={`${item.type}-${item.id}`}
                            href={`/details/${item.type}/${item.id}`}
                            onClick={() => { if (searchQuery.trim()) addRecentSearch(searchQuery.trim()); closeSearch(); }}
                            className="group flex items-center gap-3.5 p-2.5 rounded-xl border border-transparent hover:bg-white/[0.05] hover:border-white/10 transition-all"
                            style={{ padding: "10px", gap: "14px" }}
                          >
                            <div className="relative w-[46px] h-[66px] rounded-lg overflow-hidden bg-[var(--bg-elevated)] flex-shrink-0 ring-1 ring-white/10">
                              {item.posterUrl ? (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img src={proxyImage(item.posterUrl)} alt="" className="w-full h-full object-cover" loading="lazy" referrerPolicy="no-referrer" />
                              ) : (
                                <div className="w-full h-full flex items-center justify-center text-[var(--text-muted)]">
                                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="opacity-40">
                                    <rect width="18" height="18" x="3" y="3" rx="2" /><circle cx="9" cy="9" r="2" /><path d="m21 15-3.1-3.1a2 2 0 0 0-2.8 0L6 21" />
                                  </svg>
                                </div>
                              )}
                            </div>
                            <div className="flex-1 min-w-0">
                              <h4 className="text-sm font-semibold text-white truncate group-hover:text-[var(--accent-primary)] transition-colors">{item.title}</h4>
                              <div className="flex items-center gap-2 mt-1.5 text-xs text-[var(--text-secondary)]">
                                {item.rating > 0 && (
                                  <span className={`flex items-center gap-1 font-semibold ${ratingTone(item.rating)}`}>
                                    <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" /></svg>
                                    {item.rating.toFixed(1)}
                                  </span>
                                )}
                                {item.releaseYear > 0 && <span>{item.releaseYear}</span>}
                                <span className={`type-pill type-pill-${item.type}`}>{searchTypeLabel(item.type)}</span>
                              </div>
                            </div>
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="text-[var(--text-muted)] opacity-0 group-hover:opacity-100 group-hover:text-[var(--accent-primary)] transition-all flex-shrink-0">
                              <path d="m9 18 6-6-6-6" />
                            </svg>
                          </Link>
                        ))}
                      </div>
                      <button
                        onClick={handleSearchSubmit}
                        className="w-full mt-2 flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-semibold text-[var(--accent-primary)] hover:bg-[var(--accent-primary)]/10 transition-colors"
                        style={{ padding: "12px", gap: "8px", marginTop: "8px" }}
                      >
                        See all results for “{searchQuery.trim()}”
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="m9 18 6-6-6-6" /></svg>
                      </button>
                    </>
                  ) : !isSearching ? (
                    <div className="flex flex-col items-center text-center py-14 px-6" style={{ padding: "56px 24px" }}>
                      <div className="w-14 h-14 rounded-2xl bg-white/[0.04] flex items-center justify-center mb-4">
                        <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="1.5">
                          <circle cx="11" cy="11" r="8" /><path d="m21 21-4.3-4.3" />
                        </svg>
                      </div>
                      <p className="text-sm font-semibold text-white mb-1">No {searchCat !== "all" ? `${searchTypeLabel(searchCat).toLowerCase()} ` : ""}matches for “{searchQuery.trim()}”</p>
                      <p className="text-xs text-[var(--text-muted)] max-w-xs">Check the spelling{searchCat !== "all" ? ", switch category," : ""} or try a different title.</p>
                    </div>
                  ) : null
                ) : (
                  /* ── Idle: recent + trending ── */
                  <div className="space-y-5 py-1">
                    {recentSearches.length > 0 && (
                      <div>
                        <div className="flex items-center justify-between px-1.5 mb-2">
                          <p className="text-[11px] font-bold uppercase tracking-widest text-[var(--text-muted)]">Recent searches</p>
                          <button onClick={clearRecentSearches} className="text-[11px] font-semibold text-[var(--text-muted)] hover:text-red-400 transition-colors">
                            Clear all
                          </button>
                        </div>
                        <div className="flex flex-col">
                          {recentSearches.slice(0, 6).map((s) => (
                            <div key={s} className="group flex items-center gap-3 px-2.5 py-2 rounded-xl hover:bg-white/[0.05] transition-colors" style={{ padding: "8px 10px", gap: "12px" }}>
                              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-[var(--text-muted)] flex-shrink-0">
                                <circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" />
                              </svg>
                              <button
                                onClick={() => { setSearchQuery(s); searchInputRef.current?.focus(); }}
                                className="flex-1 text-left text-sm text-[var(--text-secondary)] group-hover:text-white truncate transition-colors"
                              >
                                {s}
                              </button>
                              <button
                                onClick={() => removeRecentSearch(s)}
                                className="w-6 h-6 rounded-full flex items-center justify-center text-[var(--text-muted)] hover:text-white hover:bg-white/10 opacity-0 group-hover:opacity-100 transition-all flex-shrink-0"
                                aria-label={`Remove ${s} from recent searches`}
                              >
                                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M18 6 6 18M6 6l12 12" /></svg>
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {visibleTrending.length > 0 ? (
                      <div>
                        <p className="flex items-center gap-1.5 px-1.5 mb-2 text-[11px] font-bold uppercase tracking-widest text-[var(--text-muted)]">
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--accent-teal)" strokeWidth="2.5">
                            <polyline points="22 7 13.5 15.5 8.5 10.5 2 17" /><polyline points="16 7 22 7 22 13" />
                          </svg>
                          Trending now
                        </p>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-1" style={{ gap: "4px" }}>
                          {visibleTrending.slice(0, 8).map((item) => (
                            <Link
                              key={`${item.type}-${item.id}`}
                              href={`/details/${item.type}/${item.id}`}
                              onClick={closeSearch}
                              className="group flex items-center gap-3.5 p-2.5 rounded-xl border border-transparent hover:bg-white/[0.05] hover:border-white/10 transition-all"
                              style={{ padding: "10px", gap: "14px" }}
                            >
                              <div className="relative w-[46px] h-[66px] rounded-lg overflow-hidden bg-[var(--bg-elevated)] flex-shrink-0 ring-1 ring-white/10">
                                {item.posterUrl && (
                                  // eslint-disable-next-line @next/next/no-img-element
                                  <img src={proxyImage(item.posterUrl)} alt="" className="w-full h-full object-cover" loading="lazy" referrerPolicy="no-referrer" />
                                )}
                              </div>
                              <div className="flex-1 min-w-0">
                                <h4 className="text-sm font-semibold text-white truncate group-hover:text-[var(--accent-primary)] transition-colors">{item.title}</h4>
                                <div className="flex items-center gap-2 mt-1.5 text-xs text-[var(--text-secondary)]">
                                  {item.rating > 0 && (
                                    <span className={`flex items-center gap-1 font-semibold ${ratingTone(item.rating)}`}>
                                      <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" /></svg>
                                      {item.rating.toFixed(1)}
                                    </span>
                                  )}
                                  {item.releaseYear > 0 && <span>{item.releaseYear}</span>}
                                  <span className={`type-pill type-pill-${item.type}`}>{searchTypeLabel(item.type)}</span>
                                </div>
                              </div>
                            </Link>
                          ))}
                        </div>
                      </div>
                    ) : (
                      recentSearches.length === 0 && (
                        <div className="flex flex-col items-center text-center py-14 px-6" style={{ padding: "56px 24px" }}>
                          <div className="w-14 h-14 rounded-2xl bg-white/[0.04] flex items-center justify-center mb-4">
                            <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="var(--accent-primary)" strokeWidth="1.5">
                              <circle cx="11" cy="11" r="8" /><path d="m21 21-4.3-4.3" />
                            </svg>
                          </div>
                          <p className="text-sm font-semibold text-white mb-1">Find your next watch</p>
                          <p className="text-xs text-[var(--text-muted)] max-w-xs">Search across movies, series and anime — or pick a category above to narrow it down.</p>
                        </div>
                      )
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
