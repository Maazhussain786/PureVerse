"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useUserState } from "../components/UserStateContext";
import CreatePartyModal, { PartyMediaSeed } from "../components/party/CreatePartyModal";
import { API_BASE, proxyImage } from "../lib/api";
import useDragScroll from "../hooks/useDragScroll";

interface PublicRoom {
  code: string;
  name: string;
  hasPassword: boolean;
  memberCount: number;
  media: { type: string; id: string; title: string; posterUrl?: string; season?: number; episode?: number };
  createdAt: number;
}

interface TrendingItem {
  id: string;
  type: string;
  title: string;
  posterUrl: string;
  bannerUrl?: string;
}

export default function PartyLobbyPage() {
  const router = useRouter();
  const { continueWatching } = useUserState();

  const [rooms, setRooms] = useState<PublicRoom[]>([]);
  const [roomsLoaded, setRoomsLoaded] = useState(false);
  const [trending, setTrending] = useState<TrendingItem[]>([]);
  const [joinCode, setJoinCode] = useState("");
  const [createSeed, setCreateSeed] = useState<PartyMediaSeed | null>(null);

  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  // Public rooms — refresh every 10s while on the page
  useEffect(() => {
    let active = true;
    const load = () => {
      fetch(`${API_BASE}/party/rooms`)
        .then((r) => r.json())
        .then((j) => {
          if (active) {
            setRooms(j.data || []);
            setRoomsLoaded(true);
          }
        })
        .catch(() => active && setRoomsLoaded(true));
    };
    load();
    const interval = setInterval(load, 10_000);
    return () => {
      active = false;
      clearInterval(interval);
    };
  }, []);

  useEffect(() => {
    fetch(`${API_BASE}/trending`)
      .then((r) => r.json())
      .then((j) => setTrending((j.data || []).slice(0, 12)))
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!searchQuery.trim()) {
      setSearchResults([]);
      setIsSearching(false);
      return;
    }
    const timer = setTimeout(async () => {
      setIsSearching(true);
      try {
        const res = await fetch(`${API_BASE}/search?q=${encodeURIComponent(searchQuery)}&limit=10`);
        const json = await res.json();
        setSearchResults(json.data || []);
      } catch (err) {
        setSearchResults([]);
      } finally {
        setIsSearching(false);
      }
    }, 400);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const handleSelect = (item: any) => {
    setCreateSeed({
      type: item.type,
      id: item.id || item.key,
      title: item.title,
      posterUrl: item.posterUrl,
      bannerUrl: item.bannerUrl,
      season: item.type === "movie" ? undefined : (item.season || 1),
      episode: item.type === "movie" ? undefined : (item.episode || 1),
    });
  };

  const join = () => {
    const code = joinCode.trim().toUpperCase();
    if (code.length >= 4) router.push(`/party/${code}`);
  };

  return (
    <main 
      className="min-h-screen pt-24 pb-28 lg:pb-16 px-5 md:px-10 lg:px-14 max-w-[1400px] mx-auto"
      style={{ paddingTop: "120px" }}
    >
      {/* ─── Hero ─── */}
      <section className="relative overflow-hidden rounded-3xl border border-white/[0.07] mb-10 mt-8" style={{ marginTop: "32px" }}>
        <div className="absolute inset-0 bg-gradient-to-br from-[var(--accent-teal)]/[0.12] via-transparent to-[var(--accent-primary)]/[0.10]" />
        <div className="absolute -top-32 -left-24 w-80 h-80 rounded-full bg-[var(--accent-teal)]/10 blur-3xl" />
        <div className="relative flex flex-col md:flex-row md:items-center" style={{ padding: "48px", gap: "32px" }}>
          <div className="flex-1">
            <p className="text-[11px] font-black uppercase tracking-[0.25em] text-[var(--accent-teal)] mb-3" style={{ marginBottom: "12px" }}>
              PureVerse Watch Party
            </p>
            <h1 className="text-3xl md:text-4xl font-bold text-white mb-3" style={{ fontFamily: "var(--font-space)", marginBottom: "16px" }}>
              Watch together, <span className="gradient-text">anywhere</span>
            </h1>
            <p className="text-sm md:text-base text-[var(--text-secondary)] max-w-xl leading-relaxed">
              Create a room, share the link, and enjoy synchronized episodes with live chat —
              host controls, public or private rooms, passwords, and instant invites.
            </p>
          </div>

          {/* Join by code */}
          <div className="w-full md:w-80 flex-shrink-0">
            <label className="block text-[10px] font-bold uppercase tracking-widest text-[var(--text-muted)] mb-2" style={{ marginBottom: "12px" }}>
              Have a room code?
            </label>
            <div className="flex gap-2" style={{ gap: "8px" }}>
              <input
                type="text"
                value={joinCode}
                onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                onKeyDown={(e) => e.key === "Enter" && join()}
                placeholder="e.g. XK4P7Q"
                maxLength={8}
                className="flex-1 px-4 py-3 rounded-xl bg-black/40 border border-white/15 text-sm font-mono font-bold tracking-[0.25em] text-white placeholder:text-[var(--text-muted)] placeholder:tracking-normal placeholder:font-sans outline-none focus:border-[var(--accent-teal)]/60 transition-colors uppercase"
              />
              <button
                onClick={join}
                disabled={joinCode.trim().length < 4}
                className="flex-shrink-0 inline-flex items-center justify-center min-h-[44px] px-6 rounded-xl text-sm font-bold text-black bg-[var(--accent-teal)] hover:shadow-[0_0_18px_var(--accent-teal-glow)] active:scale-[0.97] transition-all disabled:opacity-40 disabled:cursor-not-allowed disabled:active:scale-100"
                style={{ padding: "0 24px", minWidth: "100px", whiteSpace: "nowrap" }}
              >
                Join
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* ─── Live public rooms ─── */}
      <section className="mb-12" style={{ marginTop: "64px", marginBottom: "48px" }}>
        <div className="flex items-center gap-3 mb-5" style={{ marginBottom: "24px" }}>
          <h2 className="text-lg md:text-xl font-bold text-white" style={{ fontFamily: "var(--font-space)" }}>
            Live public rooms
          </h2>
          <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[var(--accent-teal-subtle)] text-[10px] font-black tracking-wider text-[var(--accent-teal)]">
            <span className="w-1.5 h-1.5 rounded-full bg-[var(--accent-teal)] animate-pulse" />
            LIVE
          </span>
        </div>

        {!roomsLoaded ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="skeleton h-28 rounded-2xl" />
            ))}
          </div>
        ) : rooms.length === 0 ? (
          <div className="glass-panel rounded-2xl text-center" style={{ padding: "40px" }}>
            <p className="text-sm text-[var(--text-muted)] mb-1" style={{ marginBottom: "8px" }}>No public rooms right now.</p>
            <p className="text-xs text-[var(--text-muted)]">
              Start one below — public rooms appear here for everyone to join.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {rooms.map((room) => (
              <button
                key={room.code}
                onClick={() => router.push(`/party/${room.code}`)}
                className="group flex gap-4 p-4 rounded-2xl bg-white/[0.03] border border-white/[0.07] hover:border-[var(--accent-teal)]/40 hover:bg-white/[0.05] transition-all text-left"
              >
                <div className="w-16 aspect-[2/3] rounded-lg overflow-hidden bg-[var(--bg-elevated)] flex-shrink-0">
                  {room.media.posterUrl && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={proxyImage(room.media.posterUrl)} alt="" className="w-full h-full object-cover" loading="lazy" />
                  )}
                </div>
                <div className="flex-1 min-w-0 py-0.5">
                  <h3 className="text-sm font-bold text-white truncate group-hover:text-[var(--accent-teal)] transition-colors">
                    {room.name}
                  </h3>
                  <p className="text-xs text-[var(--text-secondary)] truncate mt-0.5">
                    {room.media.title}
                    {room.media.episode ? ` · S${room.media.season ?? 1} E${room.media.episode}` : ""}
                  </p>
                  <div className="flex items-center gap-3 mt-2.5">
                    <span className="flex items-center gap-1 text-[11px] font-semibold text-[var(--text-muted)]">
                      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" />
                      </svg>
                      {room.memberCount} watching
                    </span>
                    {room.hasPassword && (
                      <span className="flex items-center gap-1 text-[11px] text-[var(--text-muted)]">
                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <rect width="18" height="11" x="3" y="11" rx="2" ry="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" />
                        </svg>
                        Locked
                      </span>
                    )}
                    <span className="ml-auto text-[10px] font-mono font-bold tracking-widest text-[var(--accent-teal)]/70">
                      {room.code}
                    </span>
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}
      </section>

      {/* ─── Start a party ─── */}
      <section style={{ marginTop: "64px" }}>
        <h2 className="text-lg md:text-xl font-bold text-white mb-1" style={{ fontFamily: "var(--font-space)", marginBottom: "8px" }}>
          Start a party
        </h2>
        <p className="text-xs text-[var(--text-muted)] mb-5" style={{ marginBottom: "24px" }}>
          Pick something to watch — or open any title and hit the Watch Party button.
        </p>

        {/* Search input */}
        <div className="relative max-w-md mb-8" style={{ marginBottom: "32px" }}>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search movies, series, anime..."
            className="w-full rounded-xl bg-white/[0.03] border border-white/10 text-sm text-white placeholder:text-[var(--text-muted)] outline-none focus:border-[var(--accent-teal)]/50 focus:bg-white/[0.05] transition-all"
            style={{ paddingLeft: "40px", paddingRight: "16px", paddingTop: "10px", paddingBottom: "10px" }}
          />
          <svg className="absolute text-[var(--text-muted)]" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ top: "50%", transform: "translateY(-50%)", position: "absolute", left: "14px" }}>
            <circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/>
          </svg>
          {isSearching && (
             <div className="absolute" style={{ top: "50%", transform: "translateY(-50%)", position: "absolute", right: "14px" }}>
               <span className="w-3.5 h-3.5 border-2 border-[var(--accent-teal)]/40 border-t-[var(--accent-teal)] rounded-full animate-spin block" />
             </div>
          )}
        </div>

        {/* Search Results */}
        {searchResults.length > 0 && (
          <PartyMediaRow title="Search results" items={searchResults} onSelect={handleSelect} />
        )}

        {continueWatching.length > 0 && (
          <PartyMediaRow title="From your continue watching" items={continueWatching.slice(0, 10)} onSelect={handleSelect} />
        )}

        {trending.length > 0 && (
          <PartyMediaRow title="Trending picks" items={trending} onSelect={handleSelect} />
        )}
      </section>

      {/* Create modal */}
      {createSeed && (
        <CreatePartyModal open onClose={() => setCreateSeed(null)} media={createSeed} />
      )}
    </main>
  );
}

function PartyMediaRow({ title, items, onSelect }: { title: string; items: any[]; onSelect: (item: any) => void }) {
  const scrollRef = React.useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = React.useState(false);
  const [canScrollRight, setCanScrollRight] = React.useState(true);

  useDragScroll(scrollRef);

  const checkScroll = () => {
    if (!scrollRef.current) return;
    const { scrollLeft, scrollWidth, clientWidth } = scrollRef.current;
    setCanScrollLeft(scrollLeft > 10);
    setCanScrollRight(scrollLeft + clientWidth < scrollWidth - 10);
  };

  React.useEffect(() => {
    checkScroll();
    const el = scrollRef.current;
    if (el) {
      el.addEventListener("scroll", checkScroll, { passive: true });
      return () => el.removeEventListener("scroll", checkScroll);
    }
  }, [items]);

  const scroll = (direction: "left" | "right") => {
    if (!scrollRef.current) return;
    scrollRef.current.scrollBy({ left: direction === "left" ? -600 : 600, behavior: "smooth" });
  };

  return (
    <div className="group/row relative mb-7" style={{ marginBottom: "28px" }}>
      <h3 className="text-[11px] font-black uppercase tracking-widest text-[var(--text-secondary)] mb-3" style={{ marginBottom: "12px" }}>
        {title}
      </h3>
      <div className="relative">
        {canScrollLeft && (
          <button
            onClick={() => scroll("left")}
            className="hidden md:flex absolute left-0 top-0 bottom-0 z-20 w-12 items-center justify-center bg-gradient-to-r from-[rgba(9,9,12,0.9)] via-[rgba(9,9,12,0.45)] to-transparent opacity-0 group-hover/row:opacity-100 transition-opacity duration-200"
          >
            <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-white drop-shadow-lg transition-transform duration-200 hover:scale-125">
              <path d="m15 18-6-6 6-6" />
            </svg>
          </button>
        )}
        {canScrollRight && (
          <button
            onClick={() => scroll("right")}
            className="hidden md:flex absolute right-0 top-0 bottom-0 z-20 w-12 items-center justify-center bg-gradient-to-l from-[rgba(9,9,12,0.9)] via-[rgba(9,9,12,0.45)] to-transparent opacity-0 group-hover/row:opacity-100 transition-opacity duration-200"
          >
            <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-white drop-shadow-lg transition-transform duration-200 hover:scale-125">
              <path d="m9 18 6-6-6-6" />
            </svg>
          </button>
        )}
        
        <div ref={scrollRef} className="drag-scroll flex gap-3 overflow-x-auto hide-scrollbar scroll-smooth" style={{ paddingTop: "4px", paddingBottom: "12px", paddingLeft: "2px", marginTop: "-4px" }}>
          {items.map((item) => (
            <button
              key={`${title}-${item.id || item.key}`}
              onClick={() => onSelect(item)}
              className="group flex-shrink-0 w-[120px] text-left"
            >
              <div className="aspect-[2/3] rounded-xl overflow-hidden bg-[var(--bg-elevated)] ring-1 ring-white/10 group-hover:ring-[var(--accent-teal)]/60 transition-all relative">
                {item.posterUrl && (
                  <img src={proxyImage(item.posterUrl)} alt="" className="w-full h-full object-cover" loading="lazy" />
                )}
                <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                  <span className="rounded-full bg-[var(--accent-teal)] text-black text-[10px] font-black" style={{ padding: "6px 12px", whiteSpace: "nowrap" }}>
                    + PARTY
                  </span>
                </div>
              </div>
              <p className="text-xs font-semibold text-[var(--text-secondary)] group-hover:text-white truncate mt-2 transition-colors">
                {item.title}
              </p>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
