"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";

export interface ChatMessage {
  id: string;
  kind: "chat" | "system";
  authorSocketId?: string;
  authorName: string;
  authorAvatar?: string;
  authorIsHost?: boolean;
  text: string;
  createdAt: number;
}

interface ChatPanelProps {
  messages: ChatMessage[];
  selfId: string;
  muted: boolean;
  onSend: (text: string) => void;
}

const QUICK_EMOJI = ["😂", "🔥", "❤️", "😮", "😭", "👏", "🎉", "💀"];

function formatTime(ts: number): string {
  return new Date(ts).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
}

export default function ChatPanel({ messages, selfId, muted, onSend }: ChatPanelProps) {
  const [draft, setDraft] = useState("");
  const [pinnedToBottom, setPinnedToBottom] = useState(true);
  const [missed, setMissed] = useState(0);
  const listRef = useRef<HTMLDivElement>(null);
  const prevCount = useRef(messages.length);

  // Auto-scroll like Twitch: stick to bottom unless the user scrolled up
  useEffect(() => {
    const el = listRef.current;
    if (!el) return;
    if (pinnedToBottom) {
      el.scrollTop = el.scrollHeight;
      setMissed(0);
    } else if (messages.length > prevCount.current) {
      setMissed((m) => m + (messages.length - prevCount.current));
    }
    prevCount.current = messages.length;
  }, [messages, pinnedToBottom]);

  const handleScroll = useCallback(() => {
    const el = listRef.current;
    if (!el) return;
    const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 60;
    setPinnedToBottom(atBottom);
    if (atBottom) setMissed(0);
  }, []);

  const jumpToLatest = () => {
    const el = listRef.current;
    if (el) el.scrollTop = el.scrollHeight;
    setPinnedToBottom(true);
    setMissed(0);
  };

  const send = () => {
    const text = draft.trim();
    if (!text) return;
    onSend(text);
    setDraft("");
  };

  return (
    <div className="flex flex-col h-full min-h-0">
      {/* Messages */}
      <div
        ref={listRef}
        onScroll={handleScroll}
        className="flex-1 min-h-0 overflow-y-auto custom-scrollbar px-3 py-3 space-y-0.5"
        aria-live="polite"
      >
        {messages.length === 0 && (
          <p className="text-xs text-[var(--text-muted)] text-center py-8">
            Say hi — chat appears here in real time.
          </p>
        )}
        {messages.map((msg) => {
          if (msg.kind === "system") {
            return (
              <div key={msg.id} className="flex items-center gap-2 py-1.5 animate-fade-in">
                <span className="flex-1 h-px bg-white/[0.05]" />
                <span className="text-[10px] text-[var(--text-muted)] text-center max-w-[80%]">
                  {msg.text}
                </span>
                <span className="flex-1 h-px bg-white/[0.05]" />
              </div>
            );
          }
          const isSelf = msg.authorSocketId === selfId;
          return (
            <div key={msg.id} className="group flex items-start gap-2.5 px-1.5 py-1.5 rounded-lg hover:bg-white/[0.03] animate-fade-in">
              {msg.authorAvatar ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={msg.authorAvatar}
                  alt=""
                  referrerPolicy="no-referrer"
                  className="w-7 h-7 rounded-full object-cover flex-shrink-0 mt-0.5 ring-1 ring-white/10"
                  loading="lazy"
                />
              ) : (
                <span className="w-7 h-7 rounded-full bg-white/10 flex items-center justify-center text-[10px] font-bold text-white flex-shrink-0 mt-0.5">
                  {msg.authorName.charAt(0).toUpperCase()}
                </span>
              )}
              <div className="flex-1 min-w-0">
                <div className="flex items-baseline gap-2">
                  <span className={`text-xs font-bold truncate ${isSelf ? "text-[var(--accent-primary)]" : "text-white"}`}>
                    {msg.authorName}
                  </span>
                  {msg.authorIsHost && (
                    <span className="flex-shrink-0 text-[8px] font-black uppercase tracking-wider px-1.5 py-px rounded bg-[var(--accent-primary)]/15 text-[var(--accent-primary)]">
                      Host
                    </span>
                  )}
                  <span className="flex-shrink-0 text-[9px] text-[var(--text-muted)] opacity-0 group-hover:opacity-100 transition-opacity">
                    {formatTime(msg.createdAt)}
                  </span>
                </div>
                <p className="text-[13px] text-[var(--text-secondary)] leading-snug break-words">
                  {msg.text}
                </p>
              </div>
            </div>
          );
        })}
      </div>

      {/* New-messages pill */}
      {!pinnedToBottom && missed > 0 && (
        <div className="relative">
          <button
            onClick={jumpToLatest}
            className="absolute -top-10 left-1/2 -translate-x-1/2 px-3.5 py-1.5 rounded-full text-[11px] font-bold text-black bg-[var(--accent-primary)] shadow-[0_4px_16px_var(--accent-glow)] animate-fade-in"
          >
            ↓ {missed} new message{missed !== 1 ? "s" : ""}
          </button>
        </div>
      )}

      {/* Composer */}
      <div className="flex-shrink-0 border-t border-white/[0.06] p-3 space-y-2">
        <div className="flex gap-1 overflow-x-auto hide-scrollbar">
          {QUICK_EMOJI.map((emoji) => (
            <button
              key={emoji}
              onClick={() => setDraft((d) => d + emoji)}
              className="flex-shrink-0 w-7 h-7 rounded-lg hover:bg-white/10 transition-colors text-base leading-none"
              aria-label={`Add ${emoji}`}
            >
              {emoji}
            </button>
          ))}
        </div>
        <div className="flex items-end gap-2">
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value.slice(0, 500))}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                send();
              }
            }}
            placeholder={muted ? "You are muted" : "Send a message"}
            disabled={muted}
            rows={1}
            className="flex-1 resize-none px-3.5 py-2.5 rounded-xl bg-white/[0.05] border border-white/10 text-sm text-white placeholder:text-[var(--text-muted)] outline-none focus:border-[var(--accent-primary)]/50 transition-colors disabled:opacity-50 max-h-24 custom-scrollbar"
          />
          <button
            onClick={send}
            disabled={muted || !draft.trim()}
            className="flex-shrink-0 w-10 h-10 rounded-xl bg-[var(--accent-primary)] text-black flex items-center justify-center hover:bg-[var(--accent-hover)] transition-all disabled:opacity-30"
            aria-label="Send message"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="m22 2-7 20-4-9-9-4Z" />
              <path d="M22 2 11 13" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}
