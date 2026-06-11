"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "./AuthContext";
import { defaultAvatar } from "../lib/avatars";

// ─── Native-feel bottom navigation (mobile / tablet) ──────
// Six destinations, Material-You style: the active tab grows a pill
// highlight + label; inactive tabs are icon-only to keep all six airy.

const TABS = [
  {
    href: "/",
    label: "Home",
    match: (p: string) => p === "/",
    icon: (
      <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
        <polyline points="9 22 9 12 15 12 15 22" />
      </svg>
    ),
  },
  {
    href: "/movies",
    label: "Movies",
    match: (p: string) => p.startsWith("/movies"),
    icon: (
      <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect width="18" height="18" x="3" y="3" rx="2" />
        <path d="M7 3v18M17 3v18M3 7.5h4M3 12h18M3 16.5h4M17 7.5h4M17 16.5h4" />
      </svg>
    ),
  },
  {
    href: "/series",
    label: "Series",
    match: (p: string) => p.startsWith("/series"),
    icon: (
      <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect width="20" height="15" x="2" y="7" rx="2" ry="2" />
        <polyline points="17 2 12 7 7 2" />
      </svg>
    ),
  },
  {
    href: "/anime",
    label: "Anime",
    match: (p: string) => p.startsWith("/anime"),
    icon: (
      <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="m12 3-1.9 5.8a2 2 0 0 1-1.3 1.3L3 12l5.8 1.9a2 2 0 0 1 1.3 1.3L12 21l1.9-5.8a2 2 0 0 1 1.3-1.3L21 12l-5.8-1.9a2 2 0 0 1-1.3-1.3Z" />
      </svg>
    ),
  },
  {
    href: "/search",
    label: "Search",
    match: (p: string) => p.startsWith("/search"),
    icon: (
      <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="11" cy="11" r="8" />
        <path d="m21 21-4.3-4.3" />
      </svg>
    ),
  },
];

export default function MobileTabBar() {
  const pathname = usePathname();
  const { user, isSignedIn, signIn } = useAuth();

  // Hide inside watch-party rooms — the chat needs every pixel
  if (pathname.startsWith("/party/") && pathname.length > 7) return null;

  const profileActive = pathname.startsWith("/profile");

  return (
    <nav
      className="lg:hidden fixed bottom-0 inset-x-0 z-[70]"
      aria-label="Primary mobile navigation"
    >
      <div className="bg-[rgba(10,10,14,0.92)] backdrop-blur-2xl backdrop-saturate-150 border-t border-white/[0.07] shadow-[0_-10px_30px_rgba(0,0,0,0.55)] px-1 pb-[env(safe-area-inset-bottom)]">
        <div className="flex items-stretch justify-around h-[60px]">
          {TABS.map((tab) => {
            const active = tab.match(pathname);
            return (
              <Link
                key={tab.href}
                href={tab.href}
                aria-current={active ? "page" : undefined}
                className="relative flex flex-col items-center justify-center flex-1 min-w-0 gap-0.5 group"
              >
                <span
                  className={`flex items-center justify-center rounded-full transition-all duration-300 ${
                    active
                      ? "px-4 py-1 bg-[var(--accent-primary)]/15 text-[var(--accent-primary)]"
                      : "p-1 text-[var(--text-secondary)] group-active:scale-90"
                  }`}
                >
                  {tab.icon}
                </span>
                <span
                  className={`text-[9.5px] font-bold tracking-wide transition-all duration-300 ${
                    active ? "text-[var(--accent-primary)] opacity-100" : "text-[var(--text-muted)] opacity-80"
                  }`}
                >
                  {tab.label}
                </span>
              </Link>
            );
          })}

          {/* Profile tab */}
          {isSignedIn ? (
            <Link
              href="/profile"
              aria-current={profileActive ? "page" : undefined}
              className="relative flex flex-col items-center justify-center flex-1 min-w-0 gap-0.5 group"
            >
              <span
                className={`flex items-center justify-center rounded-full transition-all duration-300 ${
                  profileActive ? "px-4 py-0.5 bg-[var(--accent-primary)]/15" : "p-0.5 group-active:scale-90"
                }`}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={user?.avatar || defaultAvatar(user?.name || "U")}
                  alt=""
                  referrerPolicy="no-referrer"
                  className={`w-[22px] h-[22px] rounded-full object-cover ${
                    profileActive ? "ring-2 ring-[var(--accent-primary)]" : "ring-1 ring-white/20"
                  }`}
                />
              </span>
              <span
                className={`text-[9.5px] font-bold tracking-wide transition-all duration-300 ${
                  profileActive ? "text-[var(--accent-primary)]" : "text-[var(--text-muted)] opacity-80"
                }`}
              >
                Profile
              </span>
            </Link>
          ) : (
            <button
              onClick={signIn}
              className="relative flex flex-col items-center justify-center flex-1 min-w-0 gap-0.5 group"
            >
              <span className="flex items-center justify-center p-1 text-[var(--text-secondary)] group-active:scale-90 transition-transform">
                <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" />
                  <circle cx="12" cy="7" r="4" />
                </svg>
              </span>
              <span className="text-[9.5px] font-bold tracking-wide text-[var(--text-muted)] opacity-80">
                Sign In
              </span>
            </button>
          )}
        </div>
      </div>
    </nav>
  );
}
