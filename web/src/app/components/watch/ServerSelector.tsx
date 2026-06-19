"use client";

import React, { useMemo } from "react";

export interface StreamSource {
  server?: string;
  quality?: string;
  url: string;
  type?: string;
  category?: "sub" | "dub" | "multi";
}

interface ServerSelectorProps {
  sources: StreamSource[];
  activeIdx: number;
  onSelect: (idx: number) => void;
  mediaType: string;
  compact?: boolean;
  locked?: boolean; // party guests can't switch servers
}

const GROUPS: { key: "sub" | "dub" | "multi" | "all"; label: string; hint: string }[] = [
  { key: "sub", label: "SUB", hint: "Japanese audio · subtitles" },
  { key: "dub", label: "DUB", hint: "English dubbed" },
  { key: "multi", label: "MULTI AUDIO", hint: "Switch sub/dub inside the player" },
];

/**
 * Premium grouped server picker. Anime sources are grouped SUB / DUB /
 * MULTI; movies & series render a single server row. Server switching is
 * the user's escape hatch for region-blocked providers, so every chip
 * stays one tap away.
 */
export default function ServerSelector({
  sources,
  activeIdx,
  onSelect,
  mediaType,
  compact = false,
  locked = false,
}: ServerSelectorProps) {
  const grouped = useMemo(() => {
    if (mediaType !== "anime") return null;
    const map = new Map<string, { idx: number; source: StreamSource }[]>();
    sources.forEach((source, idx) => {
      const cat = source.category || "multi";
      if (!map.has(cat)) map.set(cat, []);
      map.get(cat)!.push({ idx, source });
    });
    return map;
  }, [sources, mediaType]);

  if (sources.length === 0) return null;

  const chip = (idx: number, source: StreamSource) => {
    const active = idx === activeIdx;
    return (
      <button
        key={`${source.url}-${idx}`}
        onClick={() => !locked && onSelect(idx)}
        disabled={locked}
        className={`group relative flex items-center rounded-xl text-[13px] font-semibold transition-all duration-200 ${
          active
            ? "bg-[var(--accent-primary)] text-black shadow-[0_0_16px_var(--accent-glow)]"
            : "bg-white/[0.04] border border-white/10 text-[var(--text-secondary)] hover:text-white hover:border-[var(--accent-primary)]/40"
        } ${locked && !active ? "opacity-40 cursor-not-allowed" : ""}`}
        style={{ padding: compact ? "8px 16px" : "11px 18px", gap: "9px" }}
      >
        <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${active ? "bg-black animate-pulse" : "bg-[var(--accent-primary)]/60"}`} />
        {source.server || `Server ${idx + 1}`}
        {source.quality && source.quality !== "Auto" && (
          <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${active ? "bg-black/15" : "bg-white/10"}`}>
            {source.quality}
          </span>
        )}
        {active && (
          <span className="text-[10px] font-black uppercase tracking-wider">● Live</span>
        )}
      </button>
    );
  };

  return (
    <div className={compact ? "space-y-3" : "space-y-4"} style={{ display: "flex", flexDirection: "column", gap: compact ? "12px" : "16px" }}>
      {grouped ? (
        GROUPS.filter((g) => grouped.has(g.key)).map((group) => (
          <div key={group.key}>
            <div className="flex items-center gap-2 mb-2" style={{ gap: "10px", marginBottom: "10px" }}>
              <span className={`text-[11px] font-black tracking-widest px-2.5 py-1 rounded ${
                group.key === "dub"
                  ? "bg-[var(--accent-teal-subtle)] text-[var(--accent-teal)]"
                  : group.key === "sub"
                    ? "bg-[var(--accent-primary)]/12 text-[var(--accent-primary)]"
                    : "bg-white/8 text-[var(--text-secondary)]"
              }`}>
                {group.label}
              </span>
              {!compact && <span className="text-[11px] text-[var(--text-muted)]">{group.hint}</span>}
            </div>
            <div className="flex flex-wrap" style={{ gap: "10px" }}>
              {grouped.get(group.key)!.map(({ idx, source }) => chip(idx, source))}
            </div>
          </div>
        ))
      ) : (
        <div className="flex flex-wrap" style={{ gap: "10px" }}>
          {sources.map((source, idx) => chip(idx, source))}
        </div>
      )}
      {locked && (
        <p className="text-[10px] text-[var(--text-muted)]">
          Only the host can switch servers in this party.
        </p>
      )}
    </div>
  );
}
