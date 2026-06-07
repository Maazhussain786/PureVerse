"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";

const NAV_LINKS = [
  { href: "/", label: "Home" },
  { href: "/movies", label: "Movies" },
  { href: "/series", label: "Series" },
  { href: "/anime", label: "Anime" },
];

export default function Navbar() {
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

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
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  const handleSearchSubmit = (e: React.FormEvent) => {
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
              {NAV_LINKS.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className="px-3 py-2 rounded-md text-sm font-semibold text-[var(--text-secondary)] hover:text-white hover:bg-white/5 transition-all duration-200"
                >
                  {link.label}
                </Link>
              ))}
            </div>
          </div>

          {/* Center: Search Bar */}
          <div className="flex-1 max-w-xl hidden md:block">
            <form onSubmit={handleSearchSubmit} className="relative group">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-[var(--text-muted)] group-focus-within:text-[var(--accent-primary)] transition-colors">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="11" cy="11" r="8" />
                  <path d="m21 21-4.3-4.3" />
                </svg>
              </div>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search anime..."
                className="w-full bg-[var(--glass-bg)] border border-[var(--glass-border)] text-sm text-white placeholder:text-[var(--text-muted)] rounded-lg pl-10 pr-10 py-2 outline-none focus:border-[var(--accent-primary)]/50 focus:bg-black/40 focus:shadow-[0_0_15px_var(--accent-subtle)] transition-all duration-300"
              />
              <div className="absolute inset-y-0 right-0 pr-2 flex items-center">
                <span className="text-[10px] font-mono border border-white/10 text-[var(--text-muted)] rounded px-1.5 py-0.5 bg-black/20">
                  ⌘K
                </span>
              </div>
            </form>
          </div>

          {/* Right Side: Icons + Mobile Toggle */}
          <div className="flex items-center gap-4">
            {/* Mobile Search Icon */}
            <button
              onClick={() => setSearchOpen(true)}
              className="md:hidden p-2 text-[var(--text-muted)] hover:text-white transition-colors"
              aria-label="Search"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="11" cy="11" r="8" />
                <path d="m21 21-4.3-4.3" />
              </svg>
            </button>

            {/* Notification Bell */}
            <button className="relative p-2 text-[var(--text-secondary)] hover:text-white transition-colors">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
                <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
              </svg>
              {/* Notification dot */}
              <span className="absolute top-2 right-2.5 w-2 h-2 rounded-full bg-red-500 border border-[var(--bg-primary)]"></span>
            </button>

            {/* User Profile */}
            <button className="w-8 h-8 rounded-full bg-gradient-to-tr from-[var(--accent-primary)] to-[var(--accent-hover)] border-2 border-transparent hover:border-white/20 transition-all overflow-hidden flex items-center justify-center shadow-[0_0_10px_var(--accent-subtle)]">
              <span className="text-xs font-bold text-black">U</span>
            </button>

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
            {NAV_LINKS.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setMobileOpen(false)}
                className="block py-3 text-sm font-semibold text-[var(--text-secondary)] hover:text-white transition-colors"
              >
                {link.label}
              </Link>
            ))}
          </div>
        )}
      </nav>

      {/* Search Overlay (Only for Mobile or Cmd+K) */}
      {searchOpen && (
        <div className="search-overlay fixed inset-0 z-[60] flex items-start justify-center pt-[15vh] animate-fade-in bg-black/80 backdrop-blur-sm">
          <div
            className="absolute inset-0"
            onClick={() => {
              setSearchOpen(false);
              setSearchQuery("");
            }}
          />
          <div className="relative w-full max-w-2xl mx-6 animate-fade-in-up">
            <form onSubmit={handleSearchSubmit}>
              <div className="bg-[var(--bg-card)] rounded-2xl overflow-hidden shadow-[0_0_40px_rgba(0,0,0,0.8)] border border-white/10">
                <div className="flex items-center px-6 py-5 gap-4">
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="var(--accent-primary)" strokeWidth="2.5">
                    <circle cx="11" cy="11" r="8" />
                    <path d="m21 21-4.3-4.3" />
                  </svg>
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search anime..."
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
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
