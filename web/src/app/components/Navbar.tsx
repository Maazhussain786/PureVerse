"use client";

import React, { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "./AuthContext";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000/api";

const NAV_LINKS = [
  { href: "/", label: "Home" },
  { href: "/movies", label: "Movies" },
  { href: "/series", label: "Series" },
  { href: "/anime", label: "Anime" },
];

export default function Navbar() {
  const { user, isSignedIn, signIn, signOut } = useAuth();
  const pathname = usePathname();
  const isActive = (href: string) =>
    href === "/" ? pathname === "/" : pathname.startsWith(href);
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const profileRef = useRef<HTMLDivElement>(null);

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
        setMobileOpen(false);
        setProfileOpen(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  // Close profile dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (profileRef.current && !profileRef.current.contains(e.target as Node)) {
        setProfileOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Live search debounced effect
  useEffect(() => {
    if (!searchQuery.trim()) {
      setSearchResults([]);
      setIsSearching(false);
      return;
    }
    
    const timeoutId = setTimeout(async () => {
      setIsSearching(true);
      try {
        const res = await fetch(`${API_BASE}/search?q=${encodeURIComponent(searchQuery.trim())}`);
        if (res.ok) {
          const json = await res.json();
          setSearchResults(json.data || []);
        }
      } catch (err) {
        console.error("Search failed", err);
      } finally {
        setIsSearching(false);
      }
    }, 400); // 400ms debounce
    
    return () => clearTimeout(timeoutId);
  }, [searchQuery]);

  const handleSearchSubmit = (e: React.FormEvent | React.MouseEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      window.location.href = `/search?q=${encodeURIComponent(searchQuery.trim())}`;
      setSearchOpen(false);
      setSearchQuery("");
    }
  };

  return (
    <>
      <nav
        className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
          scrolled ? "bg-[var(--bg-primary)]/90 backdrop-blur-md shadow-lg" : "bg-gradient-to-b from-[var(--bg-primary)] to-transparent"
        }`}
      >
        <div className="max-w-[1600px] mx-auto px-4 md:px-8 h-16 flex items-center justify-between gap-4">
          {/* Left: Logo + Nav Links */}
          <div className="flex items-center gap-6">
            {/* Logo */}
            <Link href="/" className="flex items-center gap-2 group">
              <span
                className="text-xl font-black italic tracking-tighter"
                style={{ fontFamily: "var(--font-space)" }}
              >
                <span className="text-[var(--accent-primary)] drop-shadow-[0_0_8px_var(--accent-glow)]">Pure</span>Verse
              </span>
            </Link>

            {/* Desktop Nav Links */}
            <div className="hidden lg:flex items-center gap-1">
              {[...NAV_LINKS, { href: "/mylist", label: "My List" }].map((link) => {
                const active = isActive(link.href);
                return (
                  <Link
                    key={link.href}
                    href={link.href}
                    aria-current={active ? "page" : undefined}
                    className={`relative px-3 py-2 rounded-md text-sm font-semibold transition-all duration-200 ${
                      active
                        ? "text-white"
                        : "text-[var(--text-secondary)] hover:text-white hover:bg-white/5"
                    }`}
                  >
                    {link.label}
                    {active && (
                      <span className="absolute left-3 right-3 -bottom-0.5 h-0.5 rounded-full bg-[var(--accent-primary)] shadow-[0_0_8px_var(--accent-glow)]" />
                    )}
                  </Link>
                );
              })}
            </div>
          </div>



          {/* Right Side: Icons + Profile */}
          <div className="flex items-center gap-3">
            {/* Search Icon */}
            <button
              onClick={() => setSearchOpen(true)}
              className="p-2 text-[var(--text-muted)] hover:text-white transition-colors"
              aria-label="Search"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="11" cy="11" r="8" />
                <path d="m21 21-4.3-4.3" />
              </svg>
            </button>

            {/* Notification Bell */}
            <button className="relative p-2 text-[var(--text-secondary)] hover:text-white transition-colors hidden sm:block">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
                <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
              </svg>
              <span className="absolute top-2 right-2.5 w-2 h-2 rounded-full bg-red-500 border border-[var(--bg-primary)]"></span>
            </button>

            {/* User Profile / Sign In */}
            <div className="relative" ref={profileRef}>
              {isSignedIn ? (
                <button
                  onClick={() => setProfileOpen(!profileOpen)}
                  className="w-9 h-9 rounded-full overflow-hidden border-2 border-transparent hover:border-[var(--accent-primary)]/40 transition-all shadow-[0_0_10px_var(--accent-subtle)]"
                >
                  {user?.avatar ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={user.avatar} alt={user.name} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full bg-gradient-to-tr from-[var(--accent-primary)] to-[var(--accent-hover)] flex items-center justify-center">
                      <span className="text-xs font-bold text-black">
                        {user?.name?.charAt(0)?.toUpperCase() || "U"}
                      </span>
                    </div>
                  )}
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
                  Sign In
                </button>
              )}

              {/* Profile Dropdown */}
              {profileOpen && isSignedIn && (
                <div className="profile-dropdown animate-slide-down">
                  {/* User Info */}
                  <div className="px-3 py-3 flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full overflow-hidden bg-gradient-to-tr from-[var(--accent-primary)] to-[var(--accent-hover)] flex items-center justify-center flex-shrink-0">
                      {user?.avatar ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={user.avatar} alt={user.name} className="w-full h-full object-cover" />
                      ) : (
                        <span className="text-sm font-bold text-black">
                          {user?.name?.charAt(0)?.toUpperCase() || "U"}
                        </span>
                      )}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-white truncate">{user?.name}</p>
                      <p className="text-xs text-[var(--text-muted)] truncate">{user?.email}</p>
                    </div>
                  </div>

                  <div className="profile-dropdown-divider" />

                  <Link
                    href="/mylist"
                    onClick={() => setProfileOpen(false)}
                    className="profile-dropdown-item"
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z" />
                    </svg>
                    My List
                  </Link>
                  <Link
                    href="/history"
                    onClick={() => setProfileOpen(false)}
                    className="profile-dropdown-item"
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <circle cx="12" cy="12" r="10" />
                      <polyline points="12 6 12 12 16 14" />
                    </svg>
                    Watch History
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

            {/* Mobile Menu Toggle */}
            <button
              onClick={() => setMobileOpen(!mobileOpen)}
              className="lg:hidden p-2 ml-1 rounded-lg hover:bg-white/5 transition-colors"
              aria-label="Menu"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                {mobileOpen ? (
                  <path d="M18 6L6 18M6 6l12 12" />
                ) : (
                  <>
                    <path d="M3 8h18" />
                    <path d="M3 16h18" />
                  </>
                )}
              </svg>
            </button>
          </div>
        </div>

        {/* Mobile Nav Menu */}
        {mobileOpen && (
          <div className="lg:hidden border-t border-white/5 bg-[var(--bg-card)]/95 backdrop-blur-xl px-6 py-4 animate-fade-in shadow-2xl">
            {[...NAV_LINKS, { href: "/mylist", label: "My List" }, { href: "/history", label: "Watch History" }].map((link) => {
              const active = isActive(link.href);
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  onClick={() => setMobileOpen(false)}
                  aria-current={active ? "page" : undefined}
                  className={`flex items-center gap-2 py-3 text-sm font-semibold transition-colors ${
                    active ? "text-[var(--accent-primary)]" : "text-[var(--text-secondary)] hover:text-white"
                  }`}
                >
                  {active && <span className="w-1 h-4 rounded-full bg-[var(--accent-primary)]" />}
                  {link.label}
                </Link>
              );
            })}
            {!isSignedIn && (
              <button
                onClick={() => { signIn(); setMobileOpen(false); }}
                className="mt-2 w-full text-center py-3 text-sm font-bold text-black bg-[var(--accent-primary)] rounded-lg"
              >
                Sign In
              </button>
            )}
          </div>
        )}
      </nav>

      {/* Search Overlay */}
      {searchOpen && (
        <div className="search-overlay fixed inset-0 z-[60] flex items-start justify-center pt-[10vh] animate-fade-in bg-black/80 backdrop-blur-sm">
          <div
            className="absolute inset-0"
            onClick={() => {
              setSearchOpen(false);
              setSearchQuery("");
            }}
          />
          <div className={`relative w-full transition-all duration-500 ${searchQuery ? 'max-w-5xl' : 'max-w-2xl'} mx-6 animate-fade-in-up`}>
            <div className="bg-[var(--bg-card)] rounded-2xl overflow-hidden shadow-[0_0_40px_rgba(0,0,0,0.8)] border border-white/10 flex flex-col max-h-[80vh]">
              {/* Input area */}
              <form onSubmit={handleSearchSubmit} className="flex-shrink-0">
                <div className="flex items-center px-6 py-5 gap-4">
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="var(--accent-primary)" strokeWidth="2.5">
                    <circle cx="11" cy="11" r="8" />
                    <path d="m21 21-4.3-4.3" />
                  </svg>
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search movies, series, anime..."
                    className="flex-1 bg-transparent text-lg text-white placeholder:text-[var(--text-muted)] outline-none"
                    autoFocus
                  />
                  <button
                    type="button"
                    onClick={() => {
                      setSearchOpen(false);
                      setSearchQuery("");
                    }}
                    className="text-xs font-mono text-[var(--text-muted)] border border-white/10 rounded px-2 py-1 hover:text-white transition-colors bg-white/5"
                  >
                    ESC
                  </button>
                </div>
              </form>

              {/* Results area */}
              {searchQuery && (
                <div className="flex-1 overflow-y-auto p-6 bg-black/40 border-t border-white/5 custom-scrollbar">
                  {isSearching ? (
                    <div className="flex justify-center items-center h-40">
                      <div className="w-8 h-8 border-2 border-[var(--accent-primary)] border-t-transparent rounded-full animate-spin"></div>
                    </div>
                  ) : searchResults.length > 0 ? (
                    <>
                      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                        {searchResults.slice(0, 10).map((item) => (
                          <Link 
                            key={item.id} 
                            href={`/details/${item.type}/${item.id}`} 
                            onClick={() => {
                              setSearchOpen(false); 
                              setSearchQuery("");
                            }}
                          >
                            <div className="group relative aspect-[2/3] rounded-lg overflow-hidden bg-[var(--bg-card)] shadow-lg transition-transform hover:scale-105 hover:shadow-[0_0_20px_var(--accent-subtle)]">
                              {item.posterUrl ? (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img src={item.posterUrl} alt={item.title} className="w-full h-full object-cover" />
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
                      
                      {searchResults.length > 10 && (
                        <div className="mt-8 text-center pb-2">
                          <button 
                            onClick={handleSearchSubmit} 
                            className="text-sm font-semibold text-[var(--accent-primary)] hover:text-[var(--accent-hover)] transition-colors py-2 px-4 rounded-full border border-[var(--accent-primary)]/30 hover:bg-[var(--accent-primary)]/10"
                          >
                            View all {searchResults.length} results &rarr;
                          </button>
                        </div>
                      )}
                    </>
                  ) : (
                    <div className="text-center text-[var(--text-muted)] py-12">
                      <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" className="mx-auto mb-4 opacity-50">
                        <circle cx="11" cy="11" r="8" />
                        <path d="m21 21-4.3-4.3" />
                      </svg>
                      <p className="text-lg">No results found for &quot;{searchQuery}&quot;</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
