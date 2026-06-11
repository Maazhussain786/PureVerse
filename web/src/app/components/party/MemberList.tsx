"use client";

import React, { useState } from "react";

export interface PartyMember {
  socketId: string;
  name: string;
  avatar: string;
  isHost: boolean;
  joinedAt: number;
  muted: boolean;
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
