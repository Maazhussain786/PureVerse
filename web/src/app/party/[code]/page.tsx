"use client";

import React, { useState, useEffect, useCallback, useRef, useMemo } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useAuth } from "../../components/AuthContext";
import ChatPanel, { ChatMessage } from "../../components/party/ChatPanel";
import MemberList, { PartyMember } from "../../components/party/MemberList";
import ServerSelector, { StreamSource } from "../../components/watch/ServerSelector";
import EpisodePanel, { EpisodeInfo } from "../../components/watch/EpisodePanel";
import { getSocket } from "../../lib/socket";
import { API_BASE, getToken } from "../../lib/api";
import { defaultAvatar } from "../../lib/avatars";

// ─── Types mirrored from the backend serializer ───────────
interface RoomMedia {
  type: string;
  id: string;
  title: string;
  posterUrl?: string;
  bannerUrl?: string;
  season?: number;
  episode?: number;
  sourceIdx: number;
}

interface RoomState {
  code: string;
  name: string;
  isPublic: boolean;
  hasPassword: boolean;
  allowGuestControl: boolean;
  hostSocketId: string;
  media: RoomMedia;
  playback: { isPlaying: boolean; positionSec: number; updatedAt: number };
  members: PartyMember[];
  chat: ChatMessage[];
}

type Phase = "connecting" | "gate" | "in" | "kicked" | "notfound";

function formatClock(totalSec: number): string {
  const sec = Math.max(0, Math.floor(totalSec));
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  return h > 0
    ? `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`
    : `${m}:${String(s).padStart(2, "0")}`;
}

export default function PartyRoomPage() {
  const params = useParams();
  const router = useRouter();
  const code = String(params.code || "").toUpperCase();
  const { user } = useAuth();

  const [phase, setPhase] = useState<Phase>("connecting");
  const [room, setRoom] = useState<RoomState | null>(null);
  const [selfId, setSelfId] = useState("");
  const [meta, setMeta] = useState<any>(null);
  const [gateError, setGateError] = useState("");
  const [gateName, setGateName] = useState("");
  const [gatePassword, setGatePassword] = useState("");
  const [joining, setJoining] = useState(false);
  const [connected, setConnected] = useState(true);

  const [sources, setSources] = useState<StreamSource[]>([]);
  const [streamLoading, setStreamLoading] = useState(false);
  const [totalSeasons, setTotalSeasons] = useState(0);

  const [cue, setCue] = useState<{ text: string; icon: "play" | "pause" | "sync" } | null>(null);
  const [tab, setTab] = useState<"chat" | "members" | "episodes">("chat");
  const [chatCollapsed, setChatCollapsed] = useState(false);
  const [unseenChat, setUnseenChat] = useState(0);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [partyClock, setPartyClock] = useState(0);

  const cueTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const passwordRef = useRef("");
  const lastPositionEmit = useRef(0);
  const phaseRef = useRef<Phase>("connecting");
  useEffect(() => {
    phaseRef.current = phase;
  }, [phase]);

  const isHost = room?.hostSocketId === selfId;
  const canControl = isHost || !!room?.allowGuestControl;

  const showCue = useCallback((text: string, icon: "play" | "pause" | "sync") => {
    setCue({ text, icon });
    if (cueTimer.current) clearTimeout(cueTimer.current);
    cueTimer.current = setTimeout(() => setCue(null), 4000);
  }, []);

  // ─── Socket wiring ─────────────────────────────────────
  useEffect(() => {
    const socket = getSocket();

    const onState = (state: RoomState) => {
      if (state.code !== code) return;
      setRoom(state);
      setSelfId(socket.id || "");
      setPhase("in");
      setPartyClock(state.playback.positionSec);
    };
    const onMembers = (members: PartyMember[]) => {
      setRoom((prev) => (prev ? { ...prev, members } : prev));
    };
    const onChat = (msg: ChatMessage) => {
      setRoom((prev) =>
        prev ? { ...prev, chat: [...prev.chat.slice(-199), msg] } : prev
      );
      if (msg.kind === "chat") setUnseenChat((n) => n + 1);
    };
    const onPlayback = (p: any) => {
      setRoom((prev) =>
        prev
          ? {
              ...prev,
              playback: {
                isPlaying: p.isPlaying,
                positionSec: p.positionSec,
                updatedAt: Date.now(),
              },
            }
          : prev
      );
      setPartyClock(p.positionSec);
      if (p.action === "play") showCue(`${p.byName} pressed Play — hit play together!`, "play");
      else if (p.action === "pause") showCue(`${p.byName} paused`, "pause");
      else if (p.action === "seek") showCue(`${p.byName} jumped to ${formatClock(p.positionSec)}`, "sync");
      else if (p.action === "resync") showCue(`Live Sync — host is at ${formatClock(p.positionSec)}`, "sync");
    };
    const onMedia = (payload: any) => {
      setRoom((prev) => (prev ? { ...prev, media: payload.media } : prev));
      setPartyClock(0);
    };
    const onSettings = (payload: any) => {
      setRoom((prev) => (prev ? { ...prev, ...payload } : prev));
    };
    const onKicked = (payload: any) => {
      if (payload?.roomCode === code) setPhase("kicked");
    };
    const onConnect = () => {
      setConnected(true);
      // Socket ids change across reconnects — rejoin transparently
      if (phaseRef.current === "in") {
        socket.emit(
          "party:join",
          {
            code,
            password: passwordRef.current || undefined,
            token: getToken() || undefined,
            profile: {
              name: user?.name || gateName || "Guest",
              avatar: user?.avatar || defaultAvatar(user?.name || gateName || "Guest"),
            },
          },
          (res: any) => {
            if (res?.success) {
              setRoom(res.room);
              setSelfId(socket.id || "");
            }
          }
        );
      }
    };
    const onDisconnect = () => setConnected(false);

    socket.on("party:state", onState);
    socket.on("party:members", onMembers);
    socket.on("party:chat", onChat);
    socket.on("party:playback", onPlayback);
    socket.on("party:media", onMedia);
    socket.on("party:settings", onSettings);
    socket.on("party:kicked", onKicked);
    socket.on("connect", onConnect);
    socket.on("disconnect", onDisconnect);

    setConnected(socket.connected);

    // Already in the room (creator flow)? The sync answers. Otherwise show
    // the join gate once metadata arrives.
    socket.emit("party:sync");
    const gateTimer = setTimeout(async () => {
      try {
        const res = await fetch(`${API_BASE}/party/rooms/${code}`);
        if (res.ok) {
          const json = await res.json();
          setMeta(json.data);
          setPhase((p) => (p === "connecting" ? "gate" : p));
        } else {
          setPhase((p) => (p === "connecting" ? "notfound" : p));
        }
      } catch {
        setPhase((p) => (p === "connecting" ? "notfound" : p));
      }
    }, 700);

    return () => {
      clearTimeout(gateTimer);
      socket.emit("party:leave");
      socket.off("party:state", onState);
      socket.off("party:members", onMembers);
      socket.off("party:chat", onChat);
      socket.off("party:playback", onPlayback);
      socket.off("party:media", onMedia);
      socket.off("party:settings", onSettings);
      socket.off("party:kicked", onKicked);
      socket.off("connect", onConnect);
      socket.off("disconnect", onDisconnect);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code]);

  // ─── Join from the gate ────────────────────────────────
  const join = useCallback(() => {
    if (joining) return;
    setJoining(true);
    setGateError("");
    const socket = getSocket();
    const name = user?.name || gateName.trim() || "Guest";
    passwordRef.current = gatePassword;
    socket.emit(
      "party:join",
      {
        code,
        password: gatePassword || undefined,
        token: getToken() || undefined,
        profile: { name, avatar: user?.avatar || defaultAvatar(name) },
      },
      (res: any) => {
        setJoining(false);
        if (res?.success) {
          setRoom(res.room);
          setSelfId(res.selfId || socket.id || "");
          setPhase("in");
        } else {
          setGateError(res?.message || "Could not join");
        }
      }
    );
  }, [joining, user, gateName, gatePassword, code]);

  // ─── Stream sources follow room.media ──────────────────
  const media = room?.media;
  useEffect(() => {
    if (!media) return;
    let cancelled = false;
    setStreamLoading(true);
    const q =
      media.season != null || media.episode != null
        ? `?season=${media.season ?? 1}&episode=${media.episode ?? 1}`
        : "";
    fetch(`${API_BASE}/media/stream/${media.type}/${media.id}${q}`)
      .then((r) => r.json())
      .then((j) => {
        if (!cancelled) setSources(j?.data?.sources || []);
      })
      .catch(() => !cancelled && setSources([]))
      .finally(() => !cancelled && setStreamLoading(false));
    return () => {
      cancelled = true;
    };
  }, [media?.type, media?.id, media?.season, media?.episode]); // eslint-disable-line react-hooks/exhaustive-deps

  // Total seasons for the episode picker
  useEffect(() => {
    if (!media || (media.type !== "tv" && media.type !== "anime")) return;
    let cancelled = false;
    fetch(`${API_BASE}/media/details/${media.type}/${media.id}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => !cancelled && setTotalSeasons(j?.data?.totalSeasons || 0))
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [media?.type, media?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // ─── Virtual party clock ───────────────────────────────
  useEffect(() => {
    if (!room?.playback.isPlaying) return;
    const interval = setInterval(() => setPartyClock((c) => c + 1), 1000);
    return () => clearInterval(interval);
  }, [room?.playback.isPlaying]);

  // Host: forward real player position when the embed reports it
  useEffect(() => {
    if (!isHost) return;
    const handler = (event: MessageEvent) => {
      let data: any = event.data;
      if (typeof data === "string") {
        try { data = JSON.parse(data); } catch { return; }
      }
      if (data?.type !== "PLAYER_EVENT") return;
      const payload = data.payload || {};
      if ((data.event === "timeupdate") && typeof payload.currentTime === "number") {
        const now = Date.now();
        if (now - lastPositionEmit.current < 10_000) return;
        lastPositionEmit.current = now;
        getSocket().emit("party:position", { positionSec: payload.currentTime, isPlaying: true });
        setPartyClock(payload.currentTime);
      }
    };
    window.addEventListener("message", handler);
    return () => window.removeEventListener("message", handler);
  }, [isHost]);

  // ─── Emitters ──────────────────────────────────────────
  const sendChat = useCallback((text: string) => {
    getSocket().emit("party:chat", { text });
  }, []);

  const emitPlayback = useCallback(
    (action: "play" | "pause" | "resync" | "seek", positionSec?: number) => {
      getSocket().emit("party:playback", { action, positionSec });
    },
    []
  );

  const emitMedia = useCallback((payload: { season?: number; episode?: number; sourceIdx?: number }) => {
    getSocket().emit("party:media", payload);
  }, []);

  const emitMod = useCallback((action: "mute" | "unmute" | "timeout" | "kick", targetSocketId: string) => {
    getSocket().emit("party:mod", { action, targetSocketId, durationSec: 300 });
  }, []);

  // Reset unseen counter while chat is visible
  useEffect(() => {
    if (tab === "chat" && !chatCollapsed) setUnseenChat(0);
  }, [tab, chatCollapsed, room?.chat.length]);

  const selfMuted = useMemo(
    () => !!room?.members.find((m) => m.socketId === selfId)?.muted,
    [room, selfId]
  );

  const activeSource = sources[Math.min(media?.sourceIdx ?? 0, Math.max(sources.length - 1, 0))];
  const isSeries = media?.type === "tv" || media?.type === "anime";

  const copyInvite = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      showCue("Invite link copied to clipboard", "sync");
    } catch { /* ignore */ }
  };

  // ─── Render: terminal phases ───────────────────────────
  if (phase === "notfound" || phase === "kicked") {
    return (
      <main className="min-h-screen pt-32 px-6 flex flex-col items-center text-center" style={{ paddingTop: "128px", paddingLeft: "24px", paddingRight: "24px" }}>
        <div className="w-20 h-20 rounded-full bg-red-500/10 flex items-center justify-center mb-6">
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#f87171" strokeWidth="1.5">
            {phase === "kicked" ? (
              <><path d="M18.36 6.64A9 9 0 1 1 5.63 6.64" /><line x1="12" y1="2" x2="12" y2="12" /></>
            ) : (
              <><circle cx="12" cy="12" r="10" /><path d="M12 8v4M12 16h.01" /></>
            )}
          </svg>
        </div>
        <h1 className="text-2xl font-bold text-white mb-2" style={{ fontFamily: "var(--font-space)" }}>
          {phase === "kicked" ? "You were removed from this party" : "Party not found"}
        </h1>
        <p className="text-sm text-[var(--text-secondary)] mb-8 max-w-sm">
          {phase === "kicked"
            ? "The host removed you from the room."
            : `Room ${code} doesn't exist or has ended.`}
        </p>
        <Link href="/party" className="btn-primary">
          Browse Watch Parties
        </Link>
      </main>
    );
  }

  // ─── Render: join gate ─────────────────────────────────
  if (phase !== "in") {
    return (
      <main className="min-h-screen pt-28 px-6 flex justify-center" style={{ paddingTop: "112px", paddingLeft: "24px", paddingRight: "24px" }}>
        <div className="w-full max-w-md">
          {phase === "connecting" ? (
            <div className="flex flex-col items-center pt-16">
              <div className="w-10 h-10 border-2 border-[var(--accent-primary)] border-t-transparent rounded-full animate-spin mb-4" />
              <p className="text-sm text-[var(--text-muted)]">Connecting to party {code}…</p>
            </div>
          ) : (
            <div className="rounded-2xl bg-[var(--bg-card)] border border-white/10 overflow-hidden animate-scale-in">
              <div className="relative h-36">
                {meta?.media?.posterUrl && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={meta.media.posterUrl} alt="" className="w-full h-full object-cover opacity-40" />
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-[var(--bg-card)] to-transparent" />
                <div className="absolute bottom-4 left-5 right-5">
                  <p className="text-[10px] font-black uppercase tracking-widest text-[var(--accent-teal)]">
                    Watch Party · {code}
                  </p>
                  <h1 className="text-xl font-bold text-white" style={{ fontFamily: "var(--font-space)" }}>
                    {meta?.name || "Join party"}
                  </h1>
                  <p className="text-xs text-[var(--text-secondary)] mt-0.5">
                    {meta?.media?.title} · {meta?.memberCount || 0} watching
                  </p>
                </div>
              </div>
              <div className="p-5 space-y-3">
                {!user && (
                  <input
                    type="text"
                    value={gateName}
                    onChange={(e) => setGateName(e.target.value)}
                    placeholder="Your display name"
                    maxLength={40}
                    className="w-full px-4 py-2.5 rounded-xl bg-white/5 border border-white/10 text-sm text-white placeholder:text-[var(--text-muted)] outline-none focus:border-[var(--accent-primary)]/50 transition-colors"
                  />
                )}
                {meta?.hasPassword && (
                  <input
                    type="password"
                    value={gatePassword}
                    onChange={(e) => setGatePassword(e.target.value)}
                    placeholder="Room password"
                    className="w-full px-4 py-2.5 rounded-xl bg-white/5 border border-white/10 text-sm text-white placeholder:text-[var(--text-muted)] outline-none focus:border-[var(--accent-primary)]/50 transition-colors"
                  />
                )}
                {gateError && <p className="text-xs text-red-400">{gateError}</p>}
                <button
                  onClick={join}
                  disabled={joining}
                  className="btn-primary btn-block btn-lg"
                >
                  {joining ? "Joining…" : "Join Party"}
                </button>
              </div>
            </div>
          )}
        </div>
      </main>
    );
  }

  // ─── Render: in-room ───────────────────────────────────
  return (
    <main className="min-h-screen bg-[var(--bg-primary)] pt-[68px]" style={{ paddingTop: "100px" }}>
      <div className="max-w-[1800px] mx-auto px-3 md:px-5 pt-3 pb-6">
        {/* Top bar */}
        <div className="flex items-center justify-between gap-3 mb-3 flex-wrap">
          <div className="flex items-center gap-3 min-w-0">
            <span className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-[var(--accent-teal-subtle)] border border-[var(--accent-teal)]/25">
              <span className={`w-2 h-2 rounded-full ${connected ? "bg-[var(--accent-teal)] animate-pulse" : "bg-red-400"}`} />
              <span className="text-[11px] font-black tracking-wider text-[var(--accent-teal)]">
                {connected ? "LIVE" : "RECONNECTING…"}
              </span>
            </span>
            <div className="min-w-0">
              <h1 className="text-sm md:text-base font-bold text-white truncate" style={{ fontFamily: "var(--font-space)" }}>
                {room!.name}
              </h1>
              <p className="text-[11px] text-[var(--text-muted)] truncate">
                {room!.media.title}
                {isSeries && room!.media.episode ? ` · S${room!.media.season ?? 1} E${room!.media.episode}` : ""}
                {" · "}{room!.members.length} watching
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/[0.04] border border-white/10 text-[11px] font-mono text-[var(--text-secondary)]">
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></svg>
              {formatClock(partyClock)}
            </span>
            <button onClick={() => setInviteOpen(true)} className="btn-secondary btn-sm" style={{ padding: "8px 16px" }}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" />
                <line x1="19" x2="19" y1="8" y2="14" /><line x1="22" x2="16" y1="11" y2="11" />
              </svg>
              Invite
            </button>
            {isHost && (
              <button onClick={() => setSettingsOpen(true)} className="btn-secondary btn-sm" aria-label="Room settings" style={{ padding: "8px 16px" }}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
                  <circle cx="12" cy="12" r="3" />
                </svg>
                Settings
              </button>
            )}
            <button
              onClick={() => router.push("/party")}
              className="btn-danger btn-sm"
              style={{ padding: "8px 16px" }}
            >
              Leave
            </button>
          </div>
        </div>

        {/* Main grid */}
        <div className="flex flex-col lg:flex-row gap-4">
          {/* ── Player column ── */}
          <div className="flex-1 min-w-0">
            <div className="relative w-full aspect-video rounded-2xl bg-black ring-1 ring-[var(--accent-teal)]/15 shadow-[0_8px_50px_rgba(0,0,0,0.85)]">
              {streamLoading ? (
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="w-10 h-10 border-2 border-[var(--accent-teal)] border-t-transparent rounded-full animate-spin" />
                </div>
              ) : activeSource ? (
                <iframe
                  key={activeSource.url}
                  src={activeSource.url}
                  className="w-full h-full border-none rounded-2xl"
                  allowFullScreen
                  allow="autoplay; fullscreen; encrypted-media; picture-in-picture"
                  referrerPolicy="origin"
                  // Ad-block: blocks popunders / tab-hijack from embed providers.
                  sandbox="allow-same-origin allow-scripts allow-forms allow-presentation allow-orientation-lock allow-pointer-lock"
                />
              ) : (
                <div className="absolute inset-0 flex items-center justify-center text-sm text-[var(--text-muted)]">
                  No stream sources available
                </div>
              )}

              {/* Host action cue overlay */}
              {cue && (
                <div className="absolute top-3 left-1/2 -translate-x-1/2 z-20 flex items-center gap-2.5 px-4 py-2.5 rounded-full bg-black/80 backdrop-blur-xl border border-[var(--accent-teal)]/40 shadow-[0_8px_30px_rgba(0,0,0,0.6)] animate-slide-down max-w-[90%]">
                  <span className="w-6 h-6 rounded-full bg-[var(--accent-teal)] flex items-center justify-center flex-shrink-0">
                    {cue.icon === "play" ? (
                      <svg width="11" height="11" viewBox="0 0 24 24" fill="black"><polygon points="6 4 20 12 6 20 6 4" /></svg>
                    ) : cue.icon === "pause" ? (
                      <svg width="11" height="11" viewBox="0 0 24 24" fill="black"><rect x="6" y="4" width="4" height="16" /><rect x="14" y="4" width="4" height="16" /></svg>
                    ) : (
                      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="black" strokeWidth="3"><path d="M21 12a9 9 0 1 1-3-6.7" /><path d="M21 3v6h-6" /></svg>
                    )}
                  </span>
                  <span className="text-xs font-semibold text-white truncate">{cue.text}</span>
                </div>
              )}
            </div>

            {/* Party controls */}
            <div className="mt-3 glass-panel rounded-2xl p-3.5 flex items-center gap-3 flex-wrap" style={{ padding: "14px", gap: "12px", marginTop: "12px" }}>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => emitPlayback(room!.playback.isPlaying ? "pause" : "play")}
                  disabled={!canControl}
                  className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold transition-all ${
                    canControl
                      ? "bg-[var(--accent-primary)] text-black hover:bg-[var(--accent-hover)] hover:shadow-[0_0_16px_var(--accent-glow)]"
                      : "bg-white/5 text-[var(--text-muted)] cursor-not-allowed"
                  }`}
                  style={{ padding: "10px 20px" }}
                  title={canControl ? undefined : "Host has restricted playback control"}
                >
                  {room!.playback.isPlaying ? (
                    <><svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16" /><rect x="14" y="4" width="4" height="16" /></svg> Pause for all</>
                  ) : (
                    <><svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor"><polygon points="6 4 20 12 6 20 6 4" /></svg> Play for all</>
                  )}
                </button>
                <button
                  onClick={() => emitPlayback("resync")}
                  className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-xs font-bold bg-[var(--accent-teal-subtle)] border border-[var(--accent-teal)]/30 text-[var(--accent-teal)] hover:border-[var(--accent-teal)]/60 transition-all"
                  style={{ padding: "10px 16px" }}
                  title="Broadcast the current party position to everyone"
                >
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <path d="M21 12a9 9 0 1 1-3-6.7" /><path d="M21 3v6h-6" />
                  </svg>
                  Live Sync
                </button>
              </div>

              <span className={`text-[11px] font-semibold ${room!.playback.isPlaying ? "text-[var(--accent-primary)]" : "text-[var(--text-muted)]"}`}>
                {room!.playback.isPlaying ? "▶ Party is playing" : "❚❚ Party is paused"} · {formatClock(partyClock)}
              </span>

              <span className="flex-1" />

              <span className="text-[10px] text-[var(--text-muted)] hidden md:block max-w-[300px] text-right leading-relaxed">
                Embedded players can&apos;t be remote-controlled — cues + Live Sync keep
                everyone aligned. Press play in the video together.
              </span>
            </div>

            {/* Server selector (host switches for everyone) */}
            {sources.length > 0 && (
              <div className="mt-3 glass-panel rounded-2xl p-4" style={{ marginTop: "12px", padding: "16px" }}>
                <h3 className="text-xs font-bold text-white mb-3 uppercase tracking-widest" style={{ fontFamily: "var(--font-space)" }}>
                  Servers
                </h3>
                <ServerSelector
                  sources={sources}
                  activeIdx={Math.min(room!.media.sourceIdx, sources.length - 1)}
                  onSelect={(idx) => emitMedia({ sourceIdx: idx })}
                  mediaType={room!.media.type}
                  compact
                  locked={!isHost}
                />
              </div>
            )}
          </div>

          {/* ── Side rail: chat / members / episodes ── */}
          <aside className={`lg:w-[380px] lg:flex-shrink-0 transition-all ${chatCollapsed ? "lg:w-[52px]" : ""}`}>
            <div className="glass-panel rounded-2xl overflow-hidden flex flex-col h-[480px] lg:h-[calc(100vh-160px)] lg:max-h-[860px]">
              {chatCollapsed ? (
                <button
                  onClick={() => setChatCollapsed(false)}
                  className="hidden lg:flex flex-col items-center gap-3 py-4 text-[var(--text-secondary)] hover:text-white transition-colors"
                  aria-label="Expand chat"
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M14 9a2 2 0 0 1-2 2H6l-4 4V4c0-1.1.9-2 2-2h8a2 2 0 0 1 2 2z" />
                    <path d="M18 9h2a2 2 0 0 1 2 2v11l-4-4h-6a2 2 0 0 1-2-2v-1" />
                  </svg>
                  {unseenChat > 0 && (
                    <span className="px-1.5 py-0.5 rounded-full bg-[var(--accent-primary)] text-black text-[9px] font-black">
                      {unseenChat}
                    </span>
                  )}
                </button>
              ) : (
                <>
                  {/* Tabs */}
                  <div className="flex items-center border-b border-white/[0.06] flex-shrink-0">
                    {([
                      { key: "chat", label: "Chat", badge: unseenChat },
                      { key: "members", label: `Members (${room!.members.length})`, badge: 0 },
                      ...(isSeries ? [{ key: "episodes", label: "Episodes", badge: 0 }] : []),
                    ] as { key: "chat" | "members" | "episodes"; label: string; badge: number }[]).map((t) => (
                      <button
                        key={t.key}
                        onClick={() => setTab(t.key)}
                        className={`flex-1 flex items-center justify-center gap-1.5 py-3 text-xs font-bold transition-colors relative ${
                          tab === t.key ? "text-white" : "text-[var(--text-muted)] hover:text-[var(--text-secondary)]"
                        }`}
                        style={{ padding: "12px" }}
                      >
                        {t.label}
                        {t.badge > 0 && tab !== t.key && (
                          <span className="px-1.5 py-px rounded-full bg-[var(--accent-primary)] text-black text-[9px] font-black">
                            {t.badge}
                          </span>
                        )}
                        {tab === t.key && (
                          <span className="absolute bottom-0 inset-x-4 h-0.5 rounded-full bg-[var(--accent-primary)]" />
                        )}
                      </button>
                    ))}
                    <button
                      onClick={() => setChatCollapsed(true)}
                      className="hidden lg:block px-3 text-[var(--text-muted)] hover:text-white transition-colors"
                      aria-label="Collapse panel"
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <polyline points="9 18 15 12 9 6" />
                      </svg>
                    </button>
                  </div>

                  {/* Panel body */}
                  <div className="flex-1 min-h-0">
                    {tab === "chat" && (
                      <ChatPanel messages={room!.chat} selfId={selfId} muted={selfMuted} onSend={sendChat} />
                    )}
                    {tab === "members" && (
                      <MemberList members={room!.members} selfId={selfId} selfIsHost={isHost} onMod={emitMod} />
                    )}
                    {tab === "episodes" && isSeries && (
                      <EpisodePanel
                        mediaId={room!.media.id}
                        totalSeasons={totalSeasons || 1}
                        season={room!.media.season ?? 1}
                        episode={room!.media.episode ?? 1}
                        onSelect={(s, e) => emitMedia({ season: s, episode: e })}
                        locked={!isHost}
                        className="h-full"
                      />
                    )}
                  </div>
                </>
              )}
            </div>
          </aside>
        </div>
      </div>

      {/* ─── Invite modal ─── */}
      {inviteOpen && (
        <InviteModal code={code} onClose={() => setInviteOpen(false)} onCopied={copyInvite} />
      )}

      {/* ─── Settings modal (host) ─── */}
      {settingsOpen && isHost && room && (
        <RoomSettingsModal
          room={room}
          onClose={() => setSettingsOpen(false)}
          onSave={(payload) => {
            getSocket().emit("party:settings", payload);
            setSettingsOpen(false);
          }}
        />
      )}
    </main>
  );
}

// ─── Invite modal ──────────────────────────────────────────
function InviteModal({ code, onClose, onCopied }: { code: string; onClose: () => void; onCopied: () => void }) {
  const { isSignedIn } = useAuth();
  const [to, setTo] = useState("");
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState("");
  const link = typeof window !== "undefined" ? window.location.href : "";

  const sendInvite = async () => {
    if (!to.trim() || status === "sending") return;
    setStatus("sending");
    try {
      const res = await fetch(`${API_BASE}/party/invite`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${getToken() || ""}`,
        },
        body: JSON.stringify({ to: to.trim(), roomCode: code }),
      });
      const json = await res.json();
      if (json.success) {
        setStatus("sent");
        setTo("");
        setTimeout(() => setStatus("idle"), 2500);
      } else {
        setStatus("error");
        setErrorMsg(json.message || "Could not send invite");
      }
    } catch {
      setStatus("error");
      setErrorMsg("Could not send invite");
    }
  };

  return (
    <div className="fixed inset-0 z-[92] flex items-center justify-center p-4 animate-fade-in">
      <div className="absolute inset-0 bg-black/80 backdrop-blur-md" onClick={onClose} />
      <div className="relative w-full max-w-sm rounded-2xl bg-[var(--bg-card)] border border-white/10 p-6 animate-scale-in" style={{ padding: "24px" }}>
        <h2 className="text-lg font-bold text-white mb-1" style={{ fontFamily: "var(--font-space)" }}>
          Invite friends
        </h2>
        <p className="text-xs text-[var(--text-muted)] mb-5">
          Room code: <span className="font-mono font-bold text-[var(--accent-teal)] tracking-[0.2em]">{code}</span>
        </p>

        <div className="flex gap-2 mb-4" style={{ gap: "8px", marginBottom: "16px" }}>
          <input
            readOnly
            value={link}
            className="flex-1 px-3.5 py-2.5 rounded-xl bg-white/5 border border-white/10 text-xs text-[var(--text-secondary)] outline-none truncate"
            onFocus={(e) => e.target.select()}
            style={{ padding: "10px 14px" }}
          />
          <button onClick={onCopied} className="btn-primary btn-sm shrink-0" style={{ padding: "8px 16px" }}>
            Copy
          </button>
        </div>

        {isSignedIn && (
          <>
            <div className="flex items-center gap-3 my-4" style={{ gap: "12px", marginTop: "16px", marginBottom: "16px" }}>
              <span className="flex-1 h-px bg-white/10" />
              <span className="text-[10px] uppercase tracking-widest text-[var(--text-muted)]">or notify a user</span>
              <span className="flex-1 h-px bg-white/10" />
            </div>
            <div className="flex gap-2" style={{ gap: "8px" }}>
              <input
                type="text"
                value={to}
                onChange={(e) => setTo(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && sendInvite()}
                placeholder="Username or email"
                className="flex-1 px-3.5 py-2.5 rounded-xl bg-white/5 border border-white/10 text-sm text-white placeholder:text-[var(--text-muted)] outline-none focus:border-[var(--accent-primary)]/50 transition-colors"
                style={{ padding: "10px 14px" }}
              />
              <button
                onClick={sendInvite}
                disabled={status === "sending" || !to.trim()}
                className="px-4 py-2.5 rounded-xl text-xs font-bold bg-[var(--accent-teal-subtle)] border border-[var(--accent-teal)]/30 text-[var(--accent-teal)] hover:border-[var(--accent-teal)]/60 transition-all disabled:opacity-40 flex-shrink-0"
                style={{ padding: "10px 16px" }}
              >
                {status === "sending" ? "…" : status === "sent" ? "Sent ✓" : "Invite"}
              </button>
            </div>
            {status === "error" && <p className="text-xs text-red-400 mt-2">{errorMsg}</p>}
            {status === "sent" && <p className="text-xs text-[var(--accent-primary)] mt-2">They&apos;ll get a notification with the room link.</p>}
          </>
        )}

        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1.5 rounded-full text-[var(--text-muted)] hover:text-white hover:bg-white/10 transition-colors"
          aria-label="Close"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <path d="M18 6 6 18M6 6l12 12" />
          </svg>
        </button>
      </div>
    </div>
  );
}

// ─── Room settings modal (host) ────────────────────────────
function RoomSettingsModal({
  room,
  onClose,
  onSave,
}: {
  room: RoomState;
  onClose: () => void;
  onSave: (payload: any) => void;
}) {
  const [name, setName] = useState(room.name);
  const [isPublic, setIsPublic] = useState(room.isPublic);
  const [allowGuestControl, setAllowGuestControl] = useState(room.allowGuestControl);
  const [password, setPassword] = useState<string | null>(null); // null = unchanged

  return (
    <div className="fixed inset-0 z-[92] flex items-center justify-center p-4 animate-fade-in">
      <div className="absolute inset-0 bg-black/80 backdrop-blur-md" onClick={onClose} />
      <div className="relative w-full max-w-sm rounded-2xl bg-[var(--bg-card)] border border-white/10 p-6 animate-scale-in space-y-4" style={{ padding: "24px", display: "flex", flexDirection: "column", gap: "16px" }}>
        <h2 className="text-lg font-bold text-white" style={{ fontFamily: "var(--font-space)" }}>
          Room settings
        </h2>

        <div>
          <label className="block text-[10px] font-bold uppercase tracking-widest text-[var(--text-muted)] mb-1.5">
            Room name
          </label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={60}
            className="w-full px-4 py-2.5 rounded-xl bg-white/5 border border-white/10 text-sm text-white outline-none focus:border-[var(--accent-primary)]/50 transition-colors"
            style={{ padding: "10px 16px" }}
          />
        </div>

        <button
          onClick={() => setAllowGuestControl((v) => !v)}
          className="w-full flex items-center justify-between gap-3 p-3 rounded-xl bg-white/[0.03] border border-white/10 text-left"
          role="switch"
          aria-checked={allowGuestControl}
          style={{ padding: "12px", gap: "12px" }}
        >
          <span>
            <span className="block text-sm font-semibold text-white">Everyone can control playback</span>
            <span className="block text-[10px] text-[var(--text-muted)] mt-0.5">Play/pause cues from any member</span>
          </span>
          <span className={`relative flex-shrink-0 w-10 h-[22px] rounded-full transition-colors ${allowGuestControl ? "bg-[var(--accent-primary)]" : "bg-white/10"}`}>
            <span className={`absolute top-0.5 w-[18px] h-[18px] rounded-full bg-white shadow transition-transform ${allowGuestControl ? "translate-x-[20px]" : "translate-x-0.5"}`} />
          </span>
        </button>

        <button
          onClick={() => setIsPublic((v) => !v)}
          className="w-full flex items-center justify-between gap-3 p-3 rounded-xl bg-white/[0.03] border border-white/10 text-left"
          role="switch"
          aria-checked={isPublic}
          style={{ padding: "12px", gap: "12px" }}
        >
          <span>
            <span className="block text-sm font-semibold text-white">Public room</span>
            <span className="block text-[10px] text-[var(--text-muted)] mt-0.5">Listed in the party browser</span>
          </span>
          <span className={`relative flex-shrink-0 w-10 h-[22px] rounded-full transition-colors ${isPublic ? "bg-[var(--accent-primary)]" : "bg-white/10"}`}>
            <span className={`absolute top-0.5 w-[18px] h-[18px] rounded-full bg-white shadow transition-transform ${isPublic ? "translate-x-[20px]" : "translate-x-0.5"}`} />
          </span>
        </button>

        <div>
          <label className="block text-[10px] font-bold uppercase tracking-widest text-[var(--text-muted)] mb-1.5">
            Password {room.hasPassword ? "(set)" : "(none)"}
          </label>
          <input
            type="text"
            value={password ?? ""}
            onChange={(e) => setPassword(e.target.value)}
            placeholder={room.hasPassword ? "Type new password, empty to remove" : "Set a password"}
            maxLength={60}
            className="w-full px-4 py-2.5 rounded-xl bg-white/5 border border-white/10 text-sm text-white placeholder:text-[var(--text-muted)] outline-none focus:border-[var(--accent-primary)]/50 transition-colors"
            style={{ padding: "10px 16px" }}
          />
        </div>

        <div className="flex gap-2.5 pt-1" style={{ gap: "10px", paddingTop: "4px" }}>
          <button onClick={onClose} className="btn-secondary flex-1" style={{ padding: "10px 16px", fontWeight: "bold" }}>
            Cancel
          </button>
          <button
            onClick={() =>
              onSave({
                name,
                isPublic,
                allowGuestControl,
                ...(password !== null ? { password } : {}),
              })
            }
            className="btn-primary flex-1"
            style={{ padding: "10px 16px", fontWeight: "bold" }}
          >
            Save settings
          </button>
        </div>
      </div>
    </div>
  );
}
