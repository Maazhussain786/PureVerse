"use client";

import React, { useState } from "react";

export interface PartyMember {
  socketId: string;
  name: string;
  avatar: string;
  isHost: boolean;
  joinedAt: number;
  muted: boolean;
  inVoice?: boolean;
  micOn?: boolean;
  deafened?: boolean;
}

// Live voice indicator (mic on / mic muted / deafened) shown for members who
// have joined the voice channel.
function VoiceBadge({ member }: { member: PartyMember }) {
  if (!member.inVoice) return null;
  if (member.deafened) {
    return (
      <span title="Deafened" className="text-red-400">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M3 14v-2a9 9 0 0 1 18 0v2" /><path d="M21 14v3a2 2 0 0 1-2 2h-1v-5z" /><path d="M3 14v3a2 2 0 0 0 2 2h1v-5z" /><line x1="2" y1="2" x2="22" y2="22" />
        </svg>
      </span>
    );
  }
  if (!member.micOn) {
    return (
      <span title="Mic muted" className="text-[var(--text-muted)]">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <line x1="2" y1="2" x2="22" y2="22" /><path d="M9 9v3a3 3 0 0 0 5.12 2.12M15 9.34V4a3 3 0 0 0-5.94-.6" /><path d="M17 16.95A7 7 0 0 1 5 12v-2m14 0v2a7 7 0 0 1-.11 1.23" />
        </svg>
      </span>
    );
  }
  return (
    <span title="Talking" className="text-[var(--accent-teal)]">
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <rect x="9" y="2" width="6" height="12" rx="3" /><path d="M5 10v2a7 7 0 0 0 14 0v-2" /><line x1="12" y1="19" x2="12" y2="22" />
      </svg>
    </span>
  );
}

interface MemberListProps {
  members: PartyMember[];
  selfId: string;
  selfIsHost: boolean;
  onMod: (action: "mute" | "unmute" | "timeout" | "kick", targetSocketId: string) => void;
}

export default function MemberList({ members, selfId, selfIsHost, onMod }: MemberListProps) {
  const [menuFor, setMenuFor] = useState<string | null>(null);

  const sorted = [...members].sort((a, b) => {
    if (a.isHost !== b.isHost) return a.isHost ? -1 : 1;
    return a.joinedAt - b.joinedAt;
  });

  return (
    <div className="h-full overflow-y-auto custom-scrollbar p-3 space-y-1">
      {sorted.map((member) => {
        const isSelf = member.socketId === selfId;
        const menuOpen = menuFor === member.socketId;
        return (
          <div
            key={member.socketId}
            className="relative flex items-center gap-3 px-2.5 py-2 rounded-xl hover:bg-white/[0.04] transition-colors"
          >
            <div className="relative flex-shrink-0">
              {member.avatar ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={member.avatar}
                  alt=""
                  referrerPolicy="no-referrer"
                  className="w-9 h-9 rounded-full object-cover ring-1 ring-white/10"
                />
              ) : (
                <span className="w-9 h-9 rounded-full bg-white/10 flex items-center justify-center text-xs font-bold text-white">
                  {member.name.charAt(0).toUpperCase()}
                </span>
              )}
              {/* Connection dot */}
              <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-[var(--accent-primary)] border-2 border-[var(--bg-card)]" />
            </div>

            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-white truncate flex items-center gap-1.5">
                {member.name}
                {isSelf && <span className="text-[9px] font-bold text-[var(--text-muted)]">(you)</span>}
              </p>
              <p className="text-[10px] text-[var(--text-muted)] flex items-center gap-1.5">
                {member.isHost ? (
                  <span className="flex items-center gap-1 text-[var(--accent-primary)] font-bold">
                    <svg width="9" height="9" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M2 20h20l-2-9-5.5 3L12 6l-2.5 8L4 11z" />
                    </svg>
                    HOST
                  </span>
                ) : (
                  "Member"
                )}
                {member.muted && <span className="text-red-400 font-semibold">· Muted</span>}
              </p>
            </div>

            {/* Voice indicator */}
            <VoiceBadge member={member} />

            {/* Moderation menu (host only, not on self) */}
            {selfIsHost && !isSelf && (
              <div className="relative flex-shrink-0">
                <button
                  onClick={() => setMenuFor(menuOpen ? null : member.socketId)}
                  className="p-1.5 rounded-lg text-[var(--text-muted)] hover:text-white hover:bg-white/10 transition-colors"
                  aria-label={`Moderate ${member.name}`}
                >
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor">
                    <circle cx="12" cy="5" r="1.6" /><circle cx="12" cy="12" r="1.6" /><circle cx="12" cy="19" r="1.6" />
                  </svg>
                </button>
                {menuOpen && (
                  <div className="absolute right-0 top-full mt-1 z-20 w-40 rounded-xl bg-[var(--bg-elevated)] border border-white/10 shadow-[0_14px_40px_rgba(0,0,0,0.7)] py-1 animate-slide-down">
                    <button
                      onClick={() => { onMod(member.muted ? "unmute" : "mute", member.socketId); setMenuFor(null); }}
                      className="w-full px-3.5 py-2 text-left text-xs font-medium text-[var(--text-secondary)] hover:text-white hover:bg-white/5 transition-colors"
                    >
                      {member.muted ? "Unmute" : "Mute"}
                    </button>
                    <button
                      onClick={() => { onMod("timeout", member.socketId); setMenuFor(null); }}
                      className="w-full px-3.5 py-2 text-left text-xs font-medium text-[var(--text-secondary)] hover:text-white hover:bg-white/5 transition-colors"
                    >
                      Timeout 5 min
                    </button>
                    <button
                      onClick={() => { onMod("kick", member.socketId); setMenuFor(null); }}
                      className="w-full px-3.5 py-2 text-left text-xs font-medium text-red-400 hover:text-red-300 hover:bg-red-500/10 transition-colors"
                    >
                      Remove from room
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
