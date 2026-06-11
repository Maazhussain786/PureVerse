"use client";

import React, { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "./AuthContext";
import { useUserState } from "./UserStateContext";
import { useNotifications } from "./NotificationContext";
import NotificationCenter from "./NotificationCenter";
import { defaultAvatar } from "../lib/avatars";
import { API_BASE } from "../lib/api";

const NAV_LINKS = [
  { href: "/", label: "Home" },
  { href: "/movies", label: "Movies" },
  { href: "/series", label: "Series" },
  { href: "/anime", label: "Anime" },
  { href: "/party", label: "Party" },
];

export default function Navbar() {
  const { user, isSignedIn, signIn, signOut } = useAuth();
  const { recentSearches, addRecentSearch } = useUserState();
  const { unreadCount } = useNotifications();
  const router = useRouter();
  const pathname = usePathname();
  const isActive = (href: string) =>
    href === "/" ? pathname === "/" : pathname.startsWith(href);

  const [scrolled, setScrolled] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [trending, setTrending] = useState<any[]>([]);
  const [profileOpen, setProfileOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const profileRef = useRef<HTMLDivElement>(null);
  const notifRef = useRef<HTMLDivElement>(null);

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

  // Lazy-load trending suggestions when the overlay opens
  useEffect(() => {
    if (!searchOpen || trending.length > 0) return;
    fetch(`${API_BASE}/search/trending`)
      .then((r) => r.json())
      .then((j) => setTrending(j.data || []))
      .catch(() => {});
  }, [searchOpen, trending.length]);

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
        const res = await fetch(`${API_BASE}/search?q=${encodeURIComponent(searchQuery.trim())}&limit=10`);
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
  };

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
        <div className="relative max-w-screen-2xl mx-auto px-5 md:px-8 lg:px-16 h-[68px] flex items-center justify-between gap-4">
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
          <div className="flex items-center gap-1.5 sm:gap-3">
            {/* Search */}
            <button
              onClick={() => setSearchOpen(true)}
              className="p-2 text-[var(--text-secondary)] hover:text-white transition-colors"
              aria-label="Search (Ctrl+K)"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="11" cy="11" r="8" />
                <path d="m21 21-4.3-4.3" />
              </svg>
            </button>

            {/* Notifications */}
            <div className="relative" ref={notifRef}>
              <button
                onClick={() => setNotifOpen((v) => !v)}
                className={`relative p-2 transition-colors ${notifOpen ? "text-white" : "text-[var(--text-secondary)] hover:text-white"}`}
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
            <div className="relative" ref={profileRef}>
              {isSignedIn ? (
                <button
                  onClick={() => setProfileOpen(!profileOpen)}
                  className="w-9 h-9 rounded-full overflow-hidden border-2 border-transparent hover:border-[var(--accent-primary)]/40 transition-all shadow-[0_0_10px_var(--accent-subtle)]"
                  aria-label="Profile menu"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={avatarSrc} alt={user?.name || "Profile"} referrerPolicy="no-referrer" className="w-full h-full object-cover" />
                </button>
              ) : (
                <button
                  onClick={signIn}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[var(--accent-primary)] text-black text-sm font-bold hover:bg-[var(--accent-hover)] transition-all hover:shadow-[0_0_15px_var(--accent-glow)]"
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
        <div className="search-overlay fixed inset-0 z-[60] flex items-start justify-center pt-[8vh] animate-fade-in bg-black/80 backdrop-blur-sm">
          <div className="absolute inset-0" onClick={closeSearch} />
          <div className={`relative w-full transition-all duration-500 ${searchQuery ? "max-w-5xl" : "max-w-2xl"} mx-4 sm:mx-6 animate-fade-in-up`}>
            <div className="bg-[var(--bg-card)] rounded-2xl overflow-hidden shadow-[0_0_40px_rgba(0,0,0,0.8)] border border-white/10 flex flex-col max-h-[80vh]">
              {/* Input area */}
              <form onSubmit={handleSearchSubmit} className="flex-shrink-0">
                <div className="flex items-center px-5 sm:px-6 py-4 sm:py-5 gap-4">
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="var(--accent-primary)" strokeWidth="2.5">
                    <circle cx="11" cy="11" r="8" />
                    <path d="m21 21-4.3-4.3" />
                  </svg>
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search movies, series, anime…"
                    className="flex-1 bg-transparent text-base sm:text-lg text-white placeholder:text-[var(--text-muted)] outline-none min-w-0"
                    autoFocus
                  />
                  <button
                    type="button"
                    onClick={closeSearch}
                    className="text-xs font-mono text-[var(--text-muted)] border border-white/10 rounded px-2 py-1 hover:text-white transition-colors bg-white/5"
                  >
                    ESC
                  </button>
                </div>
              </form>

              {/* Idle: recent + trending */}
              {!searchQuery && (recentSearches.length > 0 || trending.length > 0) && (
                <div className="px-5 sm:px-6 pb-6 pt-1 border-t border-white/5 overflow-y-auto custom-scrollbar">
                  {recentSearches.length > 0 && (
                    <div className="mt-4">
                      <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-muted)] mb-2.5">Recent</p>
                      <div className="flex flex-wrap gap-2">
                        {recentSearches.slice(0, 6).map((s) => (
                          <button
                            key={s}
                            onClick={() => setSearchQuery(s)}
                            className="px-3.5 py-1.5 rounded-full text-xs text-[var(--text-secondary)] bg-white/[0.05] border border-white/10 hover:text-white hover:border-[var(--accent-primary)]/40 transition-all"
                          >
                            {s}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                  {trending.length > 0 && (
                    <div className="mt-5">
                      <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-muted)] mb-2.5">Trending</p>
                      <div className="flex flex-wrap gap-2">
                        {trending.slice(0, 8).map((t) => (
                          <button
                            key={t.id}
                            onClick={() => setSearchQuery(t.title)}
                            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs text-[var(--text-secondary)] bg-white/[0.05] border border-white/10 hover:text-white hover:border-[var(--accent-teal)]/40 transition-all"
                          >
                            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="var(--accent-teal)" strokeWidth="2.5">
                              <polyline points="22 7 13.5 15.5 8.5 10.5 2 17" />
                              <polyline points="16 7 22 7 22 13" />
                            </svg>
                            {t.title}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Results */}
              {searchQuery && (
                <div className="flex-1 overflow-y-auto p-5 sm:p-6 bg-black/40 border-t border-white/5 custom-scrollbar">
                  {isSearching && searchResults.length === 0 ? (
                    <div className="flex justify-center items-center h-40">
                      <div className="w-8 h-8 border-2 border-[var(--accent-primary)] border-t-transparent rounded-full animate-spin" />
                    </div>
                  ) : searchResults.length > 0 ? (
                    <>
                      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                        {searchResults.slice(0, 10).map((item) => (
                          <Link
                            key={item.id}
                            href={`/details/${item.type}/${item.id}`}
                            onClick={() => { addRecentSearch(searchQuery.trim()); closeSearch(); }}
                          >
                            <div className="group relative aspect-[2/3] rounded-lg overflow-hidden bg-[var(--bg-card)] shadow-lg transition-transform hover:scale-105 hover:shadow-[0_0_20px_var(--accent-subtle)]">
                              {item.posterUrl ? (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img src={item.posterUrl} alt={item.title} className="w-full h-full object-cover" loading="lazy" />
                              ) : (
                                <div className="w-full h-full flex flex-col items-center justify-center text-[var(--text-muted)] bg-white/5 p-4 text-center">
                                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="mb-2 opacity-50">
                                    <rect width="18" height="18" x="3" y="3" rx="2" ry="2" />
                                    <circle cx="8.5" cy="8.5" r="1.5" />
                                    <polyline points="21 15 16 10 5 21" />
                                  </svg>
                                </div>
                              )}
                              <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex flex-col justify-end p-3">
                                <h4 className="text-white text-sm font-bold truncate">{item.title}</h4>
                                <span className="text-[10px] text-[var(--accent-primary)] uppercase font-semibold mt-1">{item.type}</span>
                              </div>
                            </div>
                          </Link>
                        ))}
                      </div>

                      <div className="mt-8 text-center pb-2">
                        <button
                          onClick={handleSearchSubmit}
                          className="text-sm font-semibold text-[var(--accent-primary)] hover:text-[var(--accent-hover)] transition-colors py-2 px-4 rounded-full border border-[var(--accent-primary)]/30 hover:bg-[var(--accent-primary)]/10"
                        >
                          Open full search with filters &rarr;
                        </button>
                      </div>
                    </>
                  ) : !isSearching ? (
                    <div className="text-center text-[var(--text-muted)] py-12">
                      <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" className="mx-auto mb-4 opacity-50">
                        <circle cx="11" cy="11" r="8" />
                        <path d="m21 21-4.3-4.3" />
                      </svg>
                      <p className="text-lg">No results found for &quot;{searchQuery}&quot;</p>
                    </div>
                  ) : null}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
