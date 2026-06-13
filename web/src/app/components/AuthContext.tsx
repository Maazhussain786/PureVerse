"use client";

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useRef,
} from "react";
import { api, apiSilent, getToken, setToken, clearToken } from "../lib/api";
import { defaultAvatar } from "../lib/avatars";

// ─── Types ────────────────────────────────────────────────
export interface UserPreferences {
  autoplayNext: boolean;
  preferredAudio: "sub" | "dub";
  notifyNewEpisodes: boolean;
  notifyPartyInvites: boolean;
  notifyAnnouncements: boolean;
}

export interface UserProfile {
  id: string;
  name: string;
  email: string;
  avatar: string;
  isGuest: boolean;
  createdAt: number;
  preferences: UserPreferences;
  counts?: { watchlist: number; favorites: number; history: number };
}

interface AuthContextType {
  user: UserProfile | null;
  isSignedIn: boolean;
  booting: boolean;
  /** Opens the sign-in modal (Google + guest). */
  signIn: () => void;
  signOut: () => void;
  updateProfile: (patch: {
    name?: string;
    avatar?: string;
    preferences?: Partial<UserPreferences>;
  }) => Promise<void>;
  /** Bumps whenever a fresh sign-in completes — state layers re-sync on it. */
  sessionEpoch: number;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  isSignedIn: false,
  booting: true,
  signIn: () => {},
  signOut: () => {},
  updateProfile: async () => {},
  sessionEpoch: 0,
});

export function useAuth() {
  return useContext(AuthContext);
}

// Collect guest-mode localStorage state so it merges into the new account
function collectGuestState() {
  try {
    const history = JSON.parse(localStorage.getItem("pureverse_history_guest") || "[]");
    const watchlist = JSON.parse(localStorage.getItem("pureverse_watchlist_guest") || "[]");
    const favorites = JSON.parse(localStorage.getItem("pureverse_favorites_guest") || "[]");
    return { history, watchlist, favorites };
  } catch {
    return undefined;
  }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [booting, setBooting] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [sessionEpoch, setSessionEpoch] = useState(0);
  const [gisReady, setGisReady] = useState(false);
  const googleButtonRef = useRef<HTMLDivElement>(null);

  const adoptSession = useCallback((data: { token: string; user: UserProfile }) => {
    setToken(data.token);
    setUser(data.user);
    setSessionEpoch((n) => n + 1);
    setModalOpen(false);
  }, []);

  // ─── Boot: restore session from stored token ────────────
  useEffect(() => {
    const token = getToken();
    if (!token) {
      setBooting(false);
      return;
    }
    api<{ user: UserProfile }>("/auth/session")
      .then((data) => {
        setUser(data.user);
        setSessionEpoch((n) => n + 1);
      })
      .catch(() => clearToken())
      .finally(() => setBooting(false));
  }, []);

  // ─── Google Identity Services ────────────────────────────
  const handleCredentialResponse = useCallback(
    async (response: any) => {
      try {
        const data = await api<{ token: string; user: UserProfile }>("/auth/google", {
          method: "POST",
          auth: false,
          body: { credential: response.credential, importState: collectGuestState() },
        });
        adoptSession(data);
      } catch (err) {
        console.error("Google sign-in failed", err);
      }
    },
    [adoptSession]
  );

  useEffect(() => {
    const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
    if (!clientId) return;

    const init = () => {
      const google = (window as any).google;
      if (google?.accounts?.id) {
        google.accounts.id.initialize({
          client_id: clientId,
          callback: handleCredentialResponse,
        });
        setGisReady(true);
      }
    };

    if ((window as any).google?.accounts?.id) {
      init();
      return;
    }
    const script = document.createElement("script");
    script.src = "https://accounts.google.com/gsi/client";
    script.async = true;
    script.defer = true;
    script.onload = init;
    document.head.appendChild(script);
    return () => {
      if (script.parentNode) script.parentNode.removeChild(script);
    };
  }, [handleCredentialResponse]);

  // Render the official Google button inside the modal when it opens
  useEffect(() => {
    if (!modalOpen || !gisReady) return;
    const google = (window as any).google;
    if (google?.accounts?.id && googleButtonRef.current) {
      googleButtonRef.current.innerHTML = "";
      google.accounts.id.renderButton(googleButtonRef.current, {
        theme: "filled_black",
        size: "large",
        shape: "pill",
        text: "continue_with",
        width: 300,
      });
    }
  }, [modalOpen, gisReady]);

  // ─── Guest sign-in ───────────────────────────────────────
  const [guestName, setGuestName] = useState("");
  const [guestBusy, setGuestBusy] = useState(false);

  const guestSignIn = useCallback(async () => {
    if (guestBusy) return;
    setGuestBusy(true);
    try {
      const data = await api<{ token: string; user: UserProfile }>("/auth/guest", {
        method: "POST",
        auth: false,
        body: { name: guestName || "Guest", importState: collectGuestState() },
      });
      adoptSession(data);
    } catch (err) {
      console.error("Guest sign-in failed", err);
    } finally {
      setGuestBusy(false);
    }
  }, [guestName, guestBusy, adoptSession]);

  const signIn = useCallback(() => setModalOpen(true), []);

  const signOut = useCallback(() => {
    apiSilent("/auth/logout", { method: "POST" });
    clearToken();
    setUser(null);
    setSessionEpoch((n) => n + 1);
    const google = (window as any).google;
    if (google?.accounts?.id) google.accounts.id.disableAutoSelect();
  }, []);

  const updateProfile = useCallback(
    async (patch: { name?: string; avatar?: string; preferences?: Partial<UserPreferences> }) => {
      // Optimistic update
      setUser((prev) =>
        prev
          ? {
              ...prev,
              name: patch.name ?? prev.name,
              avatar: patch.avatar ?? prev.avatar,
              preferences: { ...prev.preferences, ...(patch.preferences || {}) },
            }
          : prev
      );
      try {
        const data = await api<{ user: UserProfile }>("/user/me", {
          method: "PATCH",
          body: patch,
        });
        setUser(data.user);
      } catch (err) {
        console.error("Profile update failed", err);
      }
    },
    []
  );

  return (
    <AuthContext.Provider
      value={{ user, isSignedIn: !!user, booting, signIn, signOut, updateProfile, sessionEpoch }}
    >
      {children}

      {/* ─── Sign-in Modal ─── */}
      {modalOpen && (
        <div className="fixed inset-0 z-[90] flex items-center justify-center p-4 animate-fade-in">
          <div
            className="absolute inset-0 bg-black/80 backdrop-blur-md"
            onClick={() => setModalOpen(false)}
          />
          <div className="relative w-full max-w-sm rounded-2xl bg-[var(--bg-card)] border border-white/10 shadow-[0_30px_80px_rgba(0,0,0,0.8)] p-7 animate-scale-in">
            <button
              onClick={() => setModalOpen(false)}
              className="absolute top-4 right-4 p-1.5 rounded-full text-[var(--text-muted)] hover:text-white hover:bg-white/10 transition-colors"
              aria-label="Close"
              style={{ padding: "6px" }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M18 6 6 18M6 6l12 12" />
              </svg>
            </button>

            <div className="flex flex-col items-center text-center">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/logos/Small_logo.png" alt="PureVerse" className="h-12 w-12 rounded-xl object-contain mb-4" />
              <h2 className="text-xl font-bold text-white mb-1" style={{ fontFamily: "var(--font-space)" }}>
                Welcome to PureVerse
              </h2>
              <p className="text-sm text-[var(--text-secondary)] mb-6">
                Sign in to sync your watchlist, history and parties across devices.
              </p>

              {/* Google */}
              {gisReady ? (
                <div ref={googleButtonRef} className="flex justify-center min-h-[44px]" />
              ) : (
                <p className="text-xs text-[var(--text-muted)] px-3 py-2 rounded-lg bg-white/5 border border-white/10" style={{ padding: "8px 12px" }}>
                  Google Sign-In unavailable — continue as guest below.
                </p>
              )}

              {/* Divider */}
              <div className="flex items-center gap-3 w-full my-5" style={{ gap: "12px", marginTop: "20px", marginBottom: "20px" }}>
                <div className="flex-1 h-px bg-white/10" />
                <span className="text-[10px] uppercase tracking-widest text-[var(--text-muted)]">or</span>
                <div className="flex-1 h-px bg-white/10" />
              </div>

              {/* Guest */}
              <div className="w-full space-y-3" style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                <input
                  type="text"
                  value={guestName}
                  onChange={(e) => setGuestName(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && guestSignIn()}
                  placeholder="Display name"
                  maxLength={40}
                  className="w-full px-4 py-2.5 rounded-full bg-white/5 border border-white/10 text-sm text-white placeholder:text-[var(--text-muted)] outline-none focus:border-[var(--accent-primary)]/50 transition-colors"
                  style={{ padding: "10px 16px" }}
                />
                <button
                  onClick={guestSignIn}
                  disabled={guestBusy}
                  className="w-full py-2.5 rounded-full text-sm font-bold text-black bg-[var(--accent-primary)] hover:bg-[var(--accent-hover)] transition-all hover:shadow-[0_0_18px_var(--accent-glow)] disabled:opacity-50"
                  style={{ padding: "10px", minHeight: "40px" }}
                >
                  {guestBusy ? "Creating profile…" : "Continue as Guest"}
                </button>
                <p className="text-[10px] text-[var(--text-muted)] leading-relaxed">
                  Guest profiles live on this PureVerse server — your avatar will be{" "}
                  <img
                    src={defaultAvatar(guestName || "Guest")}
                    alt=""
                    className="inline-block w-4 h-4 rounded-full align-text-bottom"
                  />{" "}
                  until you pick one.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </AuthContext.Provider>
  );
}
