"use client";

import React, { useMemo, useState } from "react";
import { AVATAR_CATEGORIES, avatarUrl } from "../lib/avatars";

interface AvatarPickerProps {
  open: boolean;
  currentAvatar?: string;
  onSelect: (url: string) => void;
  onClose: () => void;
}

/**
 * Premium avatar selection modal backed by the DiceBear library.
 * Categories × curated seeds, plus free-text search that both filters the
 * curated seeds and mints a brand-new avatar from whatever the user types.
 */
export default function AvatarPicker({ open, currentAvatar, onSelect, onClose }: AvatarPickerProps) {
  const [categoryKey, setCategoryKey] = useState(AVATAR_CATEGORIES[0].key);
  const [query, setQuery] = useState("");
  const [shuffleSalt, setShuffleSalt] = useState(0);

  const category = AVATAR_CATEGORIES.find((c) => c.key === categoryKey) || AVATAR_CATEGORIES[0];

  const avatars = useMemo(() => {
    const q = query.trim();
    let seeds = category.seeds;
    if (q) {
      const matched = seeds.filter((s) => s.toLowerCase().includes(q.toLowerCase()));
      // The typed text itself always mints a fresh avatar at the front
      seeds = [q, ...matched.filter((s) => s.toLowerCase() !== q.toLowerCase())];
    }
    if (shuffleSalt > 0) {
      seeds = seeds.map((s) => (q && s === q ? s : `${s}-${shuffleSalt}`));
    }
    return seeds.map((seed) => ({ seed, url: avatarUrl(category.style, seed) }));
  }, [category, query, shuffleSalt]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[95] flex items-center justify-center p-4 animate-fade-in">
      <div className="absolute inset-0 bg-black/80 backdrop-blur-md" onClick={onClose} />
      <div className="relative w-full max-w-2xl max-h-[85vh] flex flex-col rounded-2xl bg-[var(--bg-card)] border border-white/10 shadow-[0_30px_80px_rgba(0,0,0,0.85)] animate-scale-in overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-white/[0.06]" style={{ padding: "20px 24px 16px 24px" }}>
          <div>
            <h2 className="text-lg font-bold text-white" style={{ fontFamily: "var(--font-space)" }}>
              Choose your avatar
            </h2>
            <p className="text-xs text-[var(--text-muted)] mt-0.5">
              {AVATAR_CATEGORIES.length} styles · infinite combinations — type anything to mint your own
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-full text-[var(--text-muted)] hover:text-white hover:bg-white/10 transition-colors"
            aria-label="Close avatar picker"
            style={{ padding: "8px" }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Search + shuffle */}
        <div className="flex items-center gap-2 px-6 py-3" style={{ padding: "12px 24px", gap: "8px" }}>
          <div className="flex-1 flex items-center gap-2 px-4 py-2 rounded-full bg-white/5 border border-white/10 focus-within:border-[var(--accent-primary)]/50 transition-colors" style={{ padding: "8px 16px", gap: "8px" }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="2">
              <circle cx="11" cy="11" r="8" />
              <path d="m21 21-4.3-4.3" />
            </svg>
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search or type a name to create one…"
              className="flex-1 bg-transparent text-sm text-white placeholder:text-[var(--text-muted)] outline-none"
            />
            {query && (
              <button onClick={() => setQuery("")} className="text-[var(--text-muted)] hover:text-white" aria-label="Clear search">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <path d="M18 6 6 18M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>
          <button
            onClick={() => setShuffleSalt((n) => n + 1)}
            className="flex items-center gap-1.5 px-4 py-2 rounded-full text-xs font-semibold text-[var(--text-secondary)] bg-white/5 border border-white/10 hover:text-white hover:border-[var(--accent-primary)]/40 transition-all"
            title="Generate a fresh set"
            style={{ padding: "8px 16px", gap: "6px" }}
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M2 18h1.4c1.3 0 2.5-.6 3.3-1.7l6.1-8.6c.8-1.1 2-1.7 3.3-1.7H22" />
              <path d="m18 2 4 4-4 4" />
              <path d="M2 6h1.9c1.5 0 2.9.9 3.6 2.2" />
              <path d="M22 18h-5.9c-1.3 0-2.6-.7-3.3-1.8l-.5-.8" />
              <path d="m18 14 4 4-4 4" />
            </svg>
            Shuffle
          </button>
        </div>

        {/* Category tabs */}
        <div className="flex gap-1.5 px-6 pb-3 overflow-x-auto hide-scrollbar" style={{ gap: "6px", paddingLeft: "24px", paddingRight: "24px", paddingBottom: "12px" }}>
          {AVATAR_CATEGORIES.map((c) => (
            <button
              key={c.key}
              onClick={() => setCategoryKey(c.key)}
              className={`flex-shrink-0 px-3.5 py-1.5 rounded-full text-xs font-semibold transition-all ${
                c.key === categoryKey
                  ? "bg-[var(--accent-primary)] text-black"
                  : "bg-white/5 text-[var(--text-secondary)] hover:text-white hover:bg-white/10"
              }`}
              style={{ padding: "6px 14px" }}
            >
              {c.label}
            </button>
          ))}
        </div>

        {/* Avatar grid */}
        <div className="flex-1 overflow-y-auto custom-scrollbar px-6 pb-6" style={{ paddingLeft: "24px", paddingRight: "24px", paddingBottom: "24px" }}>
          <div className="grid grid-cols-4 sm:grid-cols-6 gap-3" style={{ gap: "12px" }}>
            {avatars.map(({ seed, url }) => {
              const selected = url === currentAvatar;
              return (
                <button
                  key={`${category.style}-${seed}`}
                  onClick={() => onSelect(url)}
                  title={seed}
                  className={`group relative aspect-square rounded-2xl overflow-hidden bg-white/5 transition-all duration-200 hover:scale-105 ${
                    selected
                      ? "ring-2 ring-[var(--accent-primary)] shadow-[0_0_20px_var(--accent-glow)]"
                      : "ring-1 ring-white/10 hover:ring-[var(--accent-primary)]/50"
                  }`}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={url} alt={`Avatar ${seed}`} className="w-full h-full object-cover" loading="lazy" />
                  {selected && (
                    <span className="absolute top-1 right-1 w-5 h-5 rounded-full bg-[var(--accent-primary)] flex items-center justify-center">
                      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#000" strokeWidth="3">
                        <path d="M20 6 9 17l-5-5" />
                      </svg>
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
