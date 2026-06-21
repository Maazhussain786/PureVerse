"use client";

import React, { Suspense, useState, useEffect, useCallback, useMemo, useRef } from "react";
import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useUserState } from "../../../components/UserStateContext";
import { useAuth } from "../../../components/AuthContext";
import MediaRow from "../../../components/MediaRow";
import EpisodeBrowser from "../../../components/EpisodeBrowser";
import ServerSelector, { StreamSource } from "../../../components/watch/ServerSelector";
import { EpisodeInfo } from "../../../components/watch/EpisodePanel";
import CreatePartyModal from "../../../components/party/CreatePartyModal";
import { API_BASE } from "../../../lib/api";

interface StreamData {
  sources: StreamSource[];
  subtitles: any[];
}

interface MediaDetails {
  id: string;
  type: string;
  title: string;
  posterUrl: string;
  bannerUrl: string;
  rating: number;
  releaseYear: number;
  synopsis: string;
  genres?: string[];
  totalSeasons?: number;
  totalEpisodes?: number;
  episodes?: EpisodeInfo[];
  runtime?: number;
}

const PREF_SERVER_KEY = (type: string) => `pureverse_server_${type}`;

function WatchPageInner() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();

  const type = params.type as string;
  const id = params.id as string;
  const isSeries = type === "tv" || type === "anime";
  const season = parseInt(searchParams.get("season") || "1", 10);
  const episode = parseInt(searchParams.get("episode") || "1", 10);

  const { user } = useAuth();
  const {
    addToHistory,
    isInWatchlist,
    addToWatchlist,
    removeFromWatchlist,
    isInFavorites,
    addToFavorites,
    removeFromFavorites,
  } = useUserState();

  const [streamData, setStreamData] = useState<StreamData | null>(null);
  const [activeSourceIdx, setActiveSourceIdx] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [details, setDetails] = useState<MediaDetails | null>(null);
  const [recommendations, setRecommendations] = useState<any[]>([]);
  const [autoplayNext, setAutoplayNext] = useState(true);
  const [partyOpen, setPartyOpen] = useState(false);
  const [shared, setShared] = useState(false);
  const [tipOpen, setTipOpen] = useState(true);
  const lastProgressSync = useRef(0);
  const pendingEpRef = useRef<number | null>(null); // episode we're syncing the player to
  const playerStageRef = useRef<HTMLDivElement>(null);
  const playerFrameRef = useRef<HTMLIFrameElement>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);

  // ─── Fullscreen ───
  // Cross-origin players (Videasy/VidSrc/…) ship their own fullscreen button,
  // but it's unreliable across providers. We overlay our OWN control in the
  // bottom-right corner — right where the native icon sits — and drive the
  // browser Fullscreen API ourselves, which is rock-solid. A cross-origin
  // iframe swallows the parent's mouse events everywhere it covers, so this
  // corner overlay is the only reliable place to catch the click over the
  // video. We fullscreen the STAGE (so the overlay stays on top and can toggle
  // back out); if a browser refuses to fullscreen a plain element (e.g. iOS) we
  // fall back to the iframe itself.
  const requestFs = useCallback((el: Element | null): boolean => {
    if (!el) return false;
    const e = el as Element & { webkitRequestFullscreen?: () => Promise<void> | void };
    const req = el.requestFullscreen?.bind(el) || e.webkitRequestFullscreen?.bind(e);
    if (!req) return false;
    try {
      const r = req();
      if (r && typeof (r as Promise<void>).catch === "function") {
        (r as Promise<void>).catch(() => {});
      }
      return true;
    } catch {
      return false;
    }
  }, []);

  const toggleFullscreen = useCallback(() => {
    const doc = document as Document & {
      webkitFullscreenElement?: Element;
      webkitExitFullscreen?: () => Promise<void> | void;
    };
    const current = document.fullscreenElement || doc.webkitFullscreenElement;
    if (current) {
      const exit = document.exitFullscreen?.bind(document) || doc.webkitExitFullscreen?.bind(doc);
      try { exit?.(); } catch { /* ignore */ }
      return;
    }
    // Prefer the stage (overlay stays clickable in fullscreen); fall back to the
    // iframe element if the browser won't fullscreen a plain div.
    if (!requestFs(playerStageRef.current)) requestFs(playerFrameRef.current);
  }, [requestFs]);

  // Keep the icon (enter ⇄ exit) in sync with the real fullscreen state,
  // including when the user leaves fullscreen via Esc.
  useEffect(() => {
    const sync = () => {
      const d = document as Document & { webkitFullscreenElement?: Element };
      setIsFullscreen(Boolean(document.fullscreenElement || d.webkitFullscreenElement));
    };
    document.addEventListener("fullscreenchange", sync);
    document.addEventListener("webkitfullscreenchange", sync);
    return () => {
      document.removeEventListener("fullscreenchange", sync);
      document.removeEventListener("webkitfullscreenchange", sync);
    };
  }, []);

  // ─── Playback tip (dismissible, remembered) ───
  useEffect(() => {
    try {
      setTipOpen(localStorage.getItem("pureverse_player_tip") !== "dismissed");
    } catch { /* default shown */ }
  }, []);

  const dismissTip = () => {
    setTipOpen(false);
    try {
      localStorage.setItem("pureverse_player_tip", "dismissed");
    } catch { /* ignore */ }
  };

  // ─── Autoplay preference (profile pref > localStorage) ───
  useEffect(() => {
    if (user) {
      setAutoplayNext(user.preferences.autoplayNext);
    } else {
      try {
        setAutoplayNext(localStorage.getItem("pureverse_autoplay") !== "0");
      } catch { /* default on */ }
    }
  }, [user]);

  const toggleAutoplay = () => {
    const next = !autoplayNext;
    setAutoplayNext(next);
    try {
      localStorage.setItem("pureverse_autoplay", next ? "1" : "0");
    } catch { /* ignore */ }
  };

  // ─── Fetch stream sources ───
  useEffect(() => {
    let cancelled = false;
    async function fetchStream() {
      setLoading(true);
      setError(false);
      setStreamData(null);
      try {
        const res = await fetch(
          `${API_BASE}/media/stream/${type}/${id}?season=${season}&episode=${episode}`
        );
        const json = await res.json();
        if (cancelled) return;
        const sources: StreamSource[] = json?.data?.sources || [];
        if (!json.success || sources.length === 0) throw new Error("No sources");

        // Restore the user's preferred server; for anime fall back to the
        // preferred audio category from their profile.
        let idx = 0;
        try {
          const prefServer = localStorage.getItem(PREF_SERVER_KEY(type));
          if (prefServer) {
            const found = sources.findIndex((s) => s.server === prefServer);
            if (found >= 0) idx = found;
          } else if (type === "anime" && user?.preferences.preferredAudio === "dub") {
            const dubIdx = sources.findIndex((s) => s.category === "dub" || s.category === "multi");
            if (dubIdx >= 0) idx = dubIdx;
          }
        } catch { /* default first */ }

        setStreamData({ sources, subtitles: json.data.subtitles || [] });
        setActiveSourceIdx(idx);
      } catch {
        if (!cancelled) setError(true);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    fetchStream();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [type, id, season, episode]);

  const selectServer = useCallback(
    (idx: number) => {
      setActiveSourceIdx(idx);
      const server = streamData?.sources[idx]?.server;
      if (server) {
        try {
          localStorage.setItem(PREF_SERVER_KEY(type), server);
        } catch { /* ignore */ }
      }
    },
    [streamData, type]
  );

  const tryNextServer = useCallback(() => {
    const count = streamData?.sources?.length ?? 0;
    if (count === 0) return;
    setActiveSourceIdx((idx) => (idx + 1) % count);
  }, [streamData]);

  // ─── Fetch details + recommendations ───
  useEffect(() => {
    let cancelled = false;
    fetch(`${API_BASE}/media/details/${type}/${id}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => !cancelled && setDetails(j?.data || null))
      .catch(() => {});
    fetch(`${API_BASE}/media/recommendations/${type}/${id}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => !cancelled && setRecommendations(j?.data || []))
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [type, id]);

  // ─── Episode navigation ───
  const episodeList = details?.episodes || [];
  const currentEpInfo = episodeList.find((e) => e.episodeNumber === episode);

  const goToEpisode = useCallback(
    (s: number, e: number) => {
      router.push(`/watch/${type}/${id}?season=${s}&episode=${e}`);
    },
    [router, type, id]
  );

  const nextEpisode = useMemo(() => {
    if (!isSeries) return null;
    const inSeason = episodeList.find((e) => e.episodeNumber === episode + 1);
    if (inSeason) return { season, episode: episode + 1, title: inSeason.title };
    if (details?.totalSeasons && season < details.totalSeasons) {
      return { season: season + 1, episode: 1, title: `Season ${season + 1} premiere` };
    }
    return null;
  }, [isSeries, episodeList, episode, season, details]);

  const prevEpisode = useMemo(() => {
    if (!isSeries) return null;
    if (episode > 1) {
      const inSeason = episodeList.find((e) => e.episodeNumber === episode - 1);
      return { season, episode: episode - 1, title: inSeason?.title };
    }
    return null;
  }, [isSeries, episodeList, episode, season]);

  // ─── History recording ───
  // ovrSeason/ovrEpisode let the player's postMessage tell us which episode it
  // actually moved to (when the user changes episode inside the player), so
  // continue-watching tracks it without us reloading the iframe.
  const recordHistory = useCallback(
    (
      progress?: number,
      positionSec?: number,
      durationSec?: number,
      ovrSeason?: number,
      ovrEpisode?: number
    ) => {
      if (!details) return;
      const s = ovrSeason ?? season;
      const e = ovrEpisode ?? episode;
      addToHistory({
        id: details.id,
        type: details.type,
        title: details.title,
        posterUrl: details.posterUrl,
        rating: details.rating,
        releaseYear: details.releaseYear,
        season: isSeries ? s : undefined,
        episode: isSeries ? e : undefined,
        episodeTitle: e === episode ? currentEpInfo?.title : undefined,
        progress: progress ?? 3,
        positionSec,
        durationSec,
      });
    },
    [details, isSeries, season, episode, currentEpInfo, addToHistory]
  );

  useEffect(() => {
    if (details && !loading && !error) recordHistory();
    // record once per episode load
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [details?.id, season, episode, loading, error]);

  // ─── Embed player events (progress + episode tracking) — the cineby way ───
  // Videasy/VidLink-style players postMessage PLAYER_EVENT payloads carrying the
  // CURRENT season/episode + timestamps. We just LISTEN: track progress and the
  // episode the player is on (so continue-watching follows in-player episode
  // changes) WITHOUT ever reloading the iframe. Players that advance episodes
  // themselves (Videasy: autoplayNextEpisode) own the next-episode jump — we do
  // NOT navigate the parent for them, because remounting the iframe is exactly
  // what was killing the in-player episode panel.
  useEffect(() => {
    const activeServer = (streamData?.sources?.[activeSourceIdx]?.server || "").toLowerCase();
    const playerOwnsEpisodes = activeServer.includes("videasy");

    const handleMessage = (event: MessageEvent) => {
      let data: any = event.data;
      if (typeof data === "string") {
        try {
          data = JSON.parse(data);
        } catch {
          return;
        }
      }
      if (!data || data.type !== "PLAYER_EVENT") return;
      const payload = data.payload || data.data || {};
      const eventName = data.event || payload.event;

      // The episode the player itself is on right now (may differ from the URL
      // once the user switches episode inside the player).
      const pSeason = Number(payload.season);
      const pEpisode = Number(payload.episode);
      const ovrSeason = Number.isFinite(pSeason) && pSeason > 0 ? pSeason : undefined;
      const ovrEpisode = Number.isFinite(pEpisode) && pEpisode > 0 ? pEpisode : undefined;

      // ── Keep Videasy's episode panel alive ──
      // Videasy drops its ?episodeSelector param when it navigates internally to
      // a new episode (so the panel vanishes after one change). When it reports a
      // different episode, re-sync our route → the iframe reloads at that episode
      // with the param re-applied, and the selector comes back every time.
      if (
        playerOwnsEpisodes &&
        isSeries &&
        ovrEpisode &&
        ovrEpisode !== episode &&
        ovrEpisode !== pendingEpRef.current
      ) {
        pendingEpRef.current = ovrEpisode;
        recordHistory(undefined, payload.currentTime, payload.duration, ovrSeason, ovrEpisode);
        goToEpisode(ovrSeason ?? season, ovrEpisode);
        return;
      }

      if (eventName === "timeupdate" || eventName === "pause") {
        const now = Date.now();
        if (eventName === "timeupdate" && now - lastProgressSync.current < 10_000) return;
        lastProgressSync.current = now;
        const progress = Math.round(
          payload.progress ??
            (payload.duration ? (payload.currentTime / payload.duration) * 100 : 0)
        );
        if (progress > 0) {
          recordHistory(Math.min(progress, 99), payload.currentTime, payload.duration, ovrSeason, ovrEpisode);
        }
      } else if (eventName === "ended" || eventName === "complete") {
        recordHistory(100, undefined, undefined, ovrSeason, ovrEpisode);
        // Only WE advance for players that don't do it themselves. For Videasy
        // (autoplayNextEpisode) we leave the iframe alone so its episode panel
        // survives.
        if (!playerOwnsEpisodes && autoplayNext && nextEpisode) {
          goToEpisode(nextEpisode.season, nextEpisode.episode);
        }
      }
    };
    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, [recordHistory, autoplayNext, nextEpisode, goToEpisode, streamData, activeSourceIdx, episode, season]);

  // ─── Keyboard shortcuts ───
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
      if (e.key === "n" && nextEpisode) goToEpisode(nextEpisode.season, nextEpisode.episode);
      if (e.key === "p" && prevEpisode) goToEpisode(prevEpisode.season, prevEpisode.episode);
      if (e.key === "s") tryNextServer();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [nextEpisode, prevEpisode, goToEpisode, tryNextServer]);

  // ─── Actions ───
  const inWatchlist = details ? isInWatchlist(details.id) : false;
  const inFavorites = details ? isInFavorites(details.id) : false;

  const listSeed = details
    ? {
        id: details.id,
        type: details.type,
        title: details.title,
        posterUrl: details.posterUrl,
        rating: details.rating,
        releaseYear: details.releaseYear,
      }
    : null;

  const toggleWatchlist = () => {
    if (!listSeed) return;
    inWatchlist ? removeFromWatchlist(listSeed.id) : addToWatchlist(listSeed);
  };
  const toggleFavorite = () => {
    if (!listSeed) return;
    inFavorites ? removeFromFavorites(listSeed.id) : addToFavorites(listSeed);
  };

  const share = async () => {
    const url = typeof window !== "undefined" ? window.location.href : "";
    try {
      if (navigator.share) {
        await navigator.share({ title: details?.title || "PureVerse", url });
      } else {
        await navigator.clipboard.writeText(url);
        setShared(true);
        setTimeout(() => setShared(false), 2000);
      }
    } catch { /* user cancelled */ }
  };

  const activeSource = streamData?.sources?.[activeSourceIdx];

  // Warm up the TCP/TLS connection to the active provider so the embed's first
  // request is faster — shaves a noticeable chunk off perceived load time.
  let activeOrigin: string | null = null;
  try {
    if (activeSource?.url) activeOrigin = new URL(activeSource.url).origin;
  } catch {
    /* malformed url — skip preconnect */
  }

  return (
    <main className="min-h-screen bg-[var(--bg-primary)]" style={{ paddingTop: '80px' }}>
      {/* Preconnect to streaming providers for a faster first frame. The embed
          loads as a credentialed document, so these are plain (non-CORS)
          preconnects — the warmed connection is then reused by the iframe. */}
      <link rel="preconnect" href="https://vidlink.pro" />
      <link rel="preconnect" href="https://vidfast.pro" />
      <link rel="dns-prefetch" href="https://megaplay.buzz" />
      {activeOrigin && <link rel="preconnect" href={activeOrigin} />}
      <div ref={playerStageRef} className="player-stage relative w-full bg-black shadow-[0_8px_50px_rgba(0,0,0,0.85)]" style={{ aspectRatio: '16/9', maxHeight: 'calc(100vh - 80px)' }}>
        {loading && (
          <div className="absolute inset-0 flex items-center justify-center bg-black">
            <div className="flex flex-col items-center gap-4">
              <div className="w-12 h-12 border-2 border-[var(--accent-primary)] border-t-transparent rounded-full animate-spin" />
              <p className="text-sm text-[var(--text-muted)] font-medium">
                Resolving stream sources…
              </p>
            </div>
          </div>
        )}

        {error && (
          <div className="absolute inset-0 flex items-center justify-center bg-black">
            <div className="text-center px-6">
              <div className="w-16 h-16 rounded-full bg-red-500/10 flex items-center justify-center mx-auto mb-4">
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#f87171" strokeWidth="2">
                  <circle cx="12" cy="12" r="10" />
                  <path d="M12 8v4M12 16h.01" />
                </svg>
              </div>
              <p className="text-lg font-semibold text-white mb-2">Stream Unavailable</p>
              <p className="text-sm text-[var(--text-muted)] mb-5 max-w-sm">
                This could be temporary. Try again in a moment or browse something else.
              </p>
              <Link href={`/details/${type}/${id}`} className="btn-primary">
                Back to Details
              </Link>
            </div>
          </div>
        )}

        {!loading && !error && activeSource && (
          <>
            <iframe
              ref={playerFrameRef}
              key={`${activeSource.url}-open`}
              src={activeSource.url}
              className="w-full h-full border-none"
              allowFullScreen
              allow="autoplay; fullscreen; encrypted-media; picture-in-picture; display-capture"
              referrerPolicy="origin"
            />
            {/* Fullscreen control overlaid on the player's own fullscreen icon
                (bottom-right). A cross-origin iframe swallows the parent's
                clicks everywhere it covers, so this corner overlay is the one
                reliable place to catch the gesture — and it drives the browser
                Fullscreen API directly, so it works on every provider. */}
            <button
              type="button"
              onClick={toggleFullscreen}
              aria-label={isFullscreen ? "Exit fullscreen" : "Enter fullscreen"}
              title={isFullscreen ? "Exit fullscreen (Esc)" : "Fullscreen"}
              className="group absolute bottom-0 right-0 z-30 flex items-center justify-center cursor-pointer bg-transparent border-0"
              style={{ width: "54px", height: "48px" }}
            >
              <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="white"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="opacity-80 transition-opacity group-hover:opacity-100"
                style={{ filter: "drop-shadow(0 1px 2px rgba(0,0,0,0.9))" }}
              >
                {isFullscreen ? (
                  <>
                    <path d="M8 3v3a2 2 0 0 1-2 2H3" />
                    <path d="M21 8h-3a2 2 0 0 1-2-2V3" />
                    <path d="M3 16h3a2 2 0 0 1 2 2v3" />
                    <path d="M16 21v-3a2 2 0 0 1 2-2h3" />
                  </>
                ) : (
                  <>
                    <path d="M8 3H5a2 2 0 0 0-2 2v3" />
                    <path d="M21 8V5a2 2 0 0 0-2-2h-3" />
                    <path d="M3 16v3a2 2 0 0 0 2 2h3" />
                    <path d="M16 21h3a2 2 0 0 0 2-2v-3" />
                  </>
                )}
              </svg>
            </button>
          </>
        )}
      </div>

      <div className="watch-layout-container px-3 md:px-6 pt-24 pb-12">
        <div className="watch-theater-layout">
          <div className="flex-1 min-w-0">
            {tipOpen && (
              <div
                className="flex items-start gap-3 rounded-2xl border border-[var(--accent-primary)]/25 bg-[var(--accent-primary)]/[0.07] mb-3"
                style={{ padding: "12px 16px", gap: "12px", marginBottom: "12px" }}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--accent-primary)" strokeWidth="2" className="flex-shrink-0 mt-0.5">
                  <circle cx="12" cy="12" r="10" />
                  <path d="M12 16v-4M12 8h.01" />
                </svg>
                <p className="flex-1 text-xs md:text-[13px] text-[var(--text-secondary)] leading-relaxed">
                  Before you start — if the video won&apos;t play, buffers, or the subtitles look
                  off, just <span className="font-semibold text-white">switch servers</span> below
                  (or tap <span className="font-semibold text-white">Switch Server</span> on the
                  player).
                  {type === "anime" && (
                    <> For anime, pick a <span className="font-semibold text-[var(--accent-primary)]">SUB</span> server
                    for Japanese audio with English subtitles, or <span className="font-semibold text-[var(--accent-teal)]">DUB</span> for English.</>
                  )}
                </p>
                <button
                  onClick={dismissTip}
                  aria-label="Dismiss tip"
                  className="flex-shrink-0 text-[var(--text-muted)] hover:text-white transition-colors"
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M18 6 6 18M6 6l12 12" />
                  </svg>
                </button>
              </div>
            )}

            {/* ─── Control strip ─── */}
            <div className="flex items-center justify-between flex-wrap gap-x-4 gap-y-3 mt-5">
              <div className="flex items-center flex-wrap gap-2.5">
                {isSeries && (
                  <>
                    <button
                      onClick={() => prevEpisode && goToEpisode(prevEpisode.season, prevEpisode.episode)}
                      disabled={!prevEpisode}
                      className="btn-secondary btn-sm"
                      title="Previous episode (P)"
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><polygon points="19 20 9 12 19 4 19 20" /><line x1="5" y1="19" x2="5" y2="5" stroke="currentColor" strokeWidth="2" /></svg>
                      Prev
                    </button>
                    <button
                      onClick={() => nextEpisode && goToEpisode(nextEpisode.season, nextEpisode.episode)}
                      disabled={!nextEpisode}
                      className="btn-primary btn-sm"
                      title="Next episode (N)"
                    >
                      Next
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 4 15 12 5 20 5 4" /><line x1="19" y1="5" x2="19" y2="19" stroke="currentColor" strokeWidth="2" /></svg>
                    </button>
                    {nextEpisode && (
                      <span className="hidden lg:inline text-[13px] text-[var(--text-muted)] truncate max-w-[240px] pl-1">
                        Up next · <span className="text-[var(--text-secondary)]">{nextEpisode.title || `Episode ${nextEpisode.episode}`}</span>
                      </span>
                    )}
                  </>
                )}
              </div>

              <div className="flex items-center gap-2.5">
                {isSeries && (
                  <button
                    onClick={toggleAutoplay}
                    className="btn-secondary btn-sm"
                    role="switch"
                    aria-checked={autoplayNext}
                    style={{ gap: "0.6rem" }}
                  >
                    Autoplay
                    <span
                      className={`relative rounded-full transition-colors ${autoplayNext ? "bg-[var(--accent-primary)]" : "bg-white/20"}`}
                      style={{ width: "34px", height: "20px" }}
                    >
                      <span
                        className="absolute rounded-full bg-white transition-transform shadow-sm"
                        style={{
                          width: "16px",
                          height: "16px",
                          top: "2px",
                          left: "2px",
                          transform: autoplayNext ? "translateX(14px)" : "translateX(0px)",
                        }}
                      />
                    </span>
                  </button>
                )}
                <button
                  onClick={() => setPartyOpen(true)}
                  className="btn-secondary btn-sm !text-[var(--accent-teal)] !border-[var(--accent-teal)]/35 hover:!border-[var(--accent-teal)]/60"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
                    <circle cx="9" cy="7" r="4" />
                    <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
                    <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                  </svg>
                  Watch Party
                </button>
              </div>
            </div>

            {/* ─── Title + actions ─── */}
            <div className="glass-panel rounded-2xl p-5" style={{ marginTop: '24px', padding: '24px' }}>
              <div className="flex flex-col md:flex-row md:items-start justify-between gap-4" style={{ gap: '20px' }}>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-2 flex-wrap" style={{ gap: '10px', marginBottom: '12px' }}>
                    <span className={`type-pill type-pill-${details?.type || type}`}>
                      {type === "tv" ? "Series" : type === "anime" ? "Anime" : "Movie"}
                    </span>
                    {details && details.rating > 0 && (
                      <span className="flex items-center gap-1 text-sm font-semibold text-[var(--accent-lime)]">
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
                          <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                        </svg>
                        {details.rating.toFixed(1)}
                      </span>
                    )}
                    {details && details.releaseYear > 0 && (
                      <span className="text-sm text-[var(--text-muted)]">{details.releaseYear}</span>
                    )}
                    {details?.genres?.slice(0, 3).map((g) => (
                      <span key={g} className="text-[11px] px-2.5 py-1 rounded-full bg-white/5 border border-white/10 text-[var(--text-secondary)]">
                        {g}
                      </span>
                    ))}
                  </div>
                  <h1 className="text-xl md:text-2xl font-bold text-white mb-1" style={{ fontFamily: "var(--font-space)", marginBottom: '8px' }}>
                    {details?.title || "Now Playing"}
                  </h1>
                  {isSeries && (
                    <p className="text-sm text-[var(--accent-primary)] font-semibold mb-2" style={{ marginBottom: '16px' }}>
                      Season {season} · Episode {episode}
                      {currentEpInfo?.title ? ` — ${currentEpInfo.title}` : ""}
                    </p>
                  )}
                  {details?.synopsis && (
                    <p className="text-sm text-[var(--text-secondary)] line-clamp-2 max-w-3xl leading-relaxed">
                      {details.synopsis}
                    </p>
                  )}
                </div>

                <div className="flex items-center gap-2.5 flex-shrink-0 flex-wrap md:justify-end">
                  <button
                    onClick={toggleWatchlist}
                    className={`btn-secondary btn-sm ${inWatchlist ? "is-active" : ""}`}
                  >
                    {inWatchlist ? (
                      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M20 6 9 17l-5-5" /></svg>
                    ) : (
                      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 5v14M5 12h14" /></svg>
                    )}
                    {inWatchlist ? "In My List" : "My List"}
                  </button>
                  <button
                    onClick={toggleFavorite}
                    className={`btn-secondary btn-sm ${inFavorites ? "is-active" : ""}`}
                    title={inFavorites ? "Remove from favorites" : "Add to favorites"}
                  >
                    <svg width="15" height="15" viewBox="0 0 24 24" fill={inFavorites ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2">
                      <path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z" />
                    </svg>
                    {inFavorites ? "Favorited" : "Favorite"}
                  </button>
                  <button onClick={share} className="btn-secondary btn-sm">
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <circle cx="18" cy="5" r="3" /><circle cx="6" cy="12" r="3" /><circle cx="18" cy="19" r="3" />
                      <line x1="8.59" x2="15.42" y1="13.51" y2="17.49" /><line x1="15.41" x2="8.59" y1="6.51" y2="10.49" />
                    </svg>
                    {shared ? "Link copied!" : "Share"}
                  </button>
                  <Link href={`/details/${type}/${id}`} className="btn-secondary btn-sm">
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <circle cx="12" cy="12" r="10" /><path d="M12 16v-4M12 8h.01" />
                    </svg>
                    Details
                  </Link>
                </div>
              </div>
            </div>

            {/* ─── Episodes — our own vertical browser (below the player).
                Hidden while Videasy is the active server (it has its own
                in-player season/episode panel, cineby-style, now reachable since
                the player fits the screen); shown for every other server. ─── */}
            {isSeries && details && (details.totalSeasons || 0) > 0 &&
              !(activeSource?.server || "").toLowerCase().includes("videasy") && (
              <div className="glass-panel rounded-2xl" style={{ marginTop: '24px', padding: '20px' }}>
                <EpisodeBrowser
                  mediaId={details.id}
                  mediaType={type}
                  totalSeasons={details.totalSeasons || 1}
                  initialSeason={season}
                  initialEpisodes={details.episodes}
                  currentSeason={season}
                  currentEpisode={episode}
                />
              </div>
            )}

            {/* ─── Server selector ─── */}
            {streamData && streamData.sources.length > 0 && (
              <div className="glass-panel rounded-2xl p-5" style={{ marginTop: '24px', padding: '24px' }}>
                <div className="flex items-center justify-between mb-4" style={{ marginBottom: '20px' }}>
                  <h3 className="text-sm font-bold text-white flex items-center gap-2" style={{ fontFamily: "var(--font-space)", gap: '8px' }}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--accent-primary)" strokeWidth="2">
                      <rect width="20" height="8" x="2" y="2" rx="2" ry="2" />
                      <rect width="20" height="8" x="2" y="14" rx="2" ry="2" />
                      <line x1="6" x2="6.01" y1="6" y2="6" />
                      <line x1="6" x2="6.01" y1="18" y2="18" />
                    </svg>
                    Servers
                  </h3>
                </div>
                <ServerSelector
                  sources={streamData.sources}
                  activeIdx={activeSourceIdx}
                  onSelect={selectServer}
                  mediaType={type}
                />
              </div>
            )}
          </div>
        </div>

        {/* ─── More Like This ─── */}
        {recommendations.length > 0 && (
          <div className="mt-10">
            <MediaRow title="More Like This" items={recommendations} />
          </div>
        )}
      </div>

      {/* ─── Watch Party modal ─── */}
      {details && (
        <CreatePartyModal
          open={partyOpen}
          onClose={() => setPartyOpen(false)}
          media={{
            type: details.type,
            id: details.id,
            title: details.title,
            posterUrl: details.posterUrl,
            bannerUrl: details.bannerUrl,
            season: isSeries ? season : undefined,
            episode: isSeries ? episode : undefined,
            sourceIdx: activeSourceIdx,
          }}
        />
      )}
    </main>
  );
}

export default function WatchPage() {
  return (
    <Suspense fallback={<main className="min-h-screen bg-[var(--bg-primary)] pt-[68px]" />}>
      <WatchPageInner />
    </Suspense>
  );
}
