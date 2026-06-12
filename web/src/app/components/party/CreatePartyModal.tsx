"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "../AuthContext";
import { getSocket } from "../../lib/socket";
import { getToken } from "../../lib/api";
import { defaultAvatar } from "../../lib/avatars";

export interface PartyMediaSeed {
  type: string;
  id: string;
  title: string;
  posterUrl?: string;
  bannerUrl?: string;
  season?: number;
  episode?: number;
  sourceIdx?: number;
}

interface CreatePartyModalProps {
  open: boolean;
  onClose: () => void;
  media: PartyMediaSeed;
}

export default function CreatePartyModal({ open, onClose, media }: CreatePartyModalProps) {
  const router = useRouter();
  const { user, isSignedIn, signIn } = useAuth();

  const [name, setName] = useState("");
  const [isPublic, setIsPublic] = useState(false);
  const [password, setPassword] = useState("");
  const [allowGuestControl, setAllowGuestControl] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  if (!open) return null;

  const displayName = user?.name || "Guest";

  const create = () => {
    if (busy) return;
    setBusy(true);
    setError("");
    const socket = getSocket();
    // Socket may be unreachable — fail visibly instead of hanging
    let acked = false;
    const timer = setTimeout(() => {
      if (!acked) {
        setBusy(false);
        setError("Server didn't respond — check your connection.");
      }
    }, 8000);
    socket.emit(
      "party:create",
      {
        token: getToken() || undefined,
        name: name.trim() || `${displayName}'s party`,
        password: password.trim() || undefined,
        isPublic,
        allowGuestControl,
        media,
        profile: {
          name: displayName,
          avatar: user?.avatar || defaultAvatar(displayName),
        },
      },
      (res: any) => {
        acked = true;
        clearTimeout(timer);
        setBusy(false);
        if (res?.success && res.room?.code) {
          onClose();
          router.push(`/party/${res.room.code}`);
        } else {
          setError(res?.message || "Could not create the room. Is the server running?");
        }
      }
    );
  };

  return (
    <div className="fixed inset-0 z-[92] flex items-center justify-center p-4 animate-fade-in">
      <div className="absolute inset-0 bg-black/80 backdrop-blur-md" onClick={onClose} />
      <div className="relative w-full max-w-md rounded-2xl bg-[var(--bg-card)] border border-white/10 shadow-[0_30px_80px_rgba(0,0,0,0.85)] overflow-hidden animate-scale-in">
        {/* Media banner */}
        <div className="relative h-28 overflow-hidden">
          {(media.bannerUrl || media.posterUrl) && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={media.bannerUrl || media.posterUrl}
              alt=""
              className="w-full h-full object-cover opacity-50"
            />
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-[var(--bg-card)] via-[var(--bg-card)]/40 to-transparent" />
          <div className="absolute bottom-3 left-5 right-5">
            <p className="text-[10px] font-black uppercase tracking-widest text-[var(--accent-primary)]">
              Watch Party
            </p>
            <h2 className="text-lg font-bold text-white truncate" style={{ fontFamily: "var(--font-space)" }}>
              {media.title}
              {media.episode ? (
                <span className="text-[var(--text-secondary)] font-medium text-sm ml-2">
                  {media.season ? `S${media.season} ` : ""}E{media.episode}
                </span>
              ) : null}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="absolute top-3 right-3 p-1.5 rounded-full bg-black/50 text-white/80 hover:text-white transition-colors"
            aria-label="Close"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="p-5 space-y-4" style={{ padding: "24px", display: "flex", flexDirection: "column", gap: "20px" }}>
          {!isSignedIn && (
            <button
              onClick={signIn}
              className="w-full text-left text-xs px-3.5 py-2.5 rounded-xl bg-[var(--accent-primary)]/8 border border-[var(--accent-primary)]/25 text-[var(--text-secondary)] hover:border-[var(--accent-primary)]/50 transition-colors"
            >
              <span className="text-[var(--accent-primary)] font-bold">Tip:</span> sign in first so
              your name & avatar appear in the room. <span className="underline">Sign in</span>
            </button>
          )}

          {/* Room name */}
          <div>
            <label className="block text-[10px] font-bold uppercase tracking-widest text-[var(--text-muted)] mb-1.5">
              Room name
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={`${displayName}'s party`}
              maxLength={60}
              className="w-full px-4 py-2.5 rounded-xl bg-white/5 border border-white/10 text-sm text-white placeholder:text-[var(--text-muted)] outline-none focus:border-[var(--accent-primary)]/50 transition-colors"
              style={{ padding: "12px 16px" }}
            />
          </div>

          {/* Visibility */}
          <div>
            <label className="block text-[10px] font-bold uppercase tracking-widest text-[var(--text-muted)] mb-1.5">
              Visibility
            </label>
            <div className="grid grid-cols-2 gap-2" style={{ gap: "12px" }}>
              {[
                { v: false, label: "Private", desc: "Invite link / code only" },
                { v: true, label: "Public", desc: "Listed in the room browser" },
              ].map((opt) => (
                <button
                  key={String(opt.v)}
                  onClick={() => setIsPublic(opt.v)}
                  className={`p-3 rounded-xl text-left border transition-all ${
                    isPublic === opt.v
                      ? "border-[var(--accent-primary)]/60 bg-[var(--accent-primary)]/8"
                      : "border-white/10 bg-white/[0.03] hover:border-white/20"
                  }`}
                  style={{ padding: "16px" }}
                >
                  <span className={`block text-sm font-bold ${isPublic === opt.v ? "text-[var(--accent-primary)]" : "text-white"}`}>
                    {opt.label}
                  </span>
                  <span className="block text-[10px] text-[var(--text-muted)] mt-0.5">{opt.desc}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Password */}
          <div>
            <label className="block text-[10px] font-bold uppercase tracking-widest text-[var(--text-muted)] mb-1.5">
              Password <span className="normal-case font-medium">(optional)</span>
            </label>
            <input
              type="text"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Leave empty for no password"
              maxLength={60}
              className="w-full px-4 py-2.5 rounded-xl bg-white/5 border border-white/10 text-sm text-white placeholder:text-[var(--text-muted)] outline-none focus:border-[var(--accent-primary)]/50 transition-colors"
              style={{ padding: "12px 16px" }}
            />
          </div>

          {/* Guest control */}
          <button
            onClick={() => setAllowGuestControl((v) => !v)}
            className="w-full flex items-center justify-between gap-3 p-3 rounded-xl bg-white/[0.03] border border-white/10 hover:border-white/20 transition-colors text-left"
            role="switch"
            aria-checked={allowGuestControl}
            style={{ padding: "16px", gap: "12px" }}
          >
            <span>
              <span className="block text-sm font-semibold text-white">Everyone can control playback</span>
              <span className="block text-[10px] text-[var(--text-muted)] mt-0.5">
                Off = only you control play, pause & episodes
              </span>
            </span>
            <span className={`relative flex-shrink-0 w-10 h-[22px] rounded-full transition-colors ${allowGuestControl ? "bg-[var(--accent-primary)]" : "bg-white/10"}`}>
              <span className={`absolute top-0.5 w-[18px] h-[18px] rounded-full bg-white shadow transition-transform ${allowGuestControl ? "translate-x-[20px]" : "translate-x-0.5"}`} />
            </span>
          </button>

          {error && <p className="text-xs text-red-400">{error}</p>}

          <button
            onClick={create}
            disabled={busy}
            className="btn-primary btn-block btn-lg rounded-xl font-bold"
            style={{ padding: "16px", fontSize: "16px", backgroundColor: "var(--accent-primary)", color: "black", width: "100%" }}
          >
            {busy ? "Creating room…" : "Start Watch Party"}
          </button>
        </div>
      </div>
    </div>
  );
}
