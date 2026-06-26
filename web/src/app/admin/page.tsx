"use client";

// ─── Owner-only admin: global user directory ──────────────
// Talks to GET /api/admin/users (gated server-side by ADMIN_TOKEN). The token
// is entered once and kept in localStorage, then sent via the `x-admin-token`
// header. This page is intentionally unlinked from the main nav.

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { API_BASE } from "../lib/api";
import { defaultAvatar } from "../lib/avatars";

const TOKEN_KEY = "pureverse_admin_token";

interface AdminUserRow {
  id: string;
  name: string;
  email: string;
  isGuest: boolean;
  avatar: string;
  createdAt: number;
  createdAtISO: string;
  lastLoginAt: number;
  lastLoginAtISO: string;
  counts: {
    watchlist: number;
    favorites: number;
    history: number;
    notifications: number;
  };
}

interface AdminResponse {
  success: boolean;
  summary: { total: number; google: number; guests: number };
  users: AdminUserRow[];
}

function readToken(): string {
  if (typeof window === "undefined") return "";
  try {
    return localStorage.getItem(TOKEN_KEY) || "";
  } catch {
    return "";
  }
}

function joinDate(ts: number): string {
  return new Date(ts).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function timeAgo(ts: number): string {
  const diff = Date.now() - ts;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  return joinDate(ts);
}

type SortKey =
  | "name"
  | "createdAt"
  | "lastLoginAt"
  | "watchlist"
  | "favorites"
  | "history";

function sortValue(u: AdminUserRow, key: SortKey): string | number {
  switch (key) {
    case "name":
      return u.name.toLowerCase();
    case "createdAt":
      return u.createdAt;
    case "lastLoginAt":
      return u.lastLoginAt;
    default:
      return u.counts[key];
  }
}

// ─── Stat tile ─────────────────────────────────────────────
function StatTile({ value, label, accent }: { value: number; label: string; accent: string }) {
  return (
    <div className="glass-panel rounded-2xl p-5" style={{ padding: "20px" }}>
      <p
        className="text-3xl font-bold text-white leading-none"
        style={{ fontFamily: "var(--font-space)", color: accent }}
      >
        {value}
      </p>
      <p className="text-xs text-[var(--text-muted)] mt-2 uppercase tracking-wider">{label}</p>
    </div>
  );
}

// ─── Token gate ────────────────────────────────────────────
function TokenGate({
  onSubmit,
  error,
  busy,
}: {
  onSubmit: (token: string) => void;
  error: string | null;
  busy: boolean;
}) {
  const [value, setValue] = useState("");
  return (
    <main className="min-h-screen pt-40 px-6 flex flex-col items-center text-center">
      <div className="w-20 h-20 rounded-3xl bg-gradient-to-tr from-[var(--accent-primary)]/20 to-[var(--accent-teal)]/10 border border-[var(--accent-primary)]/20 flex items-center justify-center mb-6">
        <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="var(--accent-primary)" strokeWidth="1.5">
          <rect x="3" y="11" width="18" height="11" rx="2" />
          <path d="M7 11V7a5 5 0 0 1 10 0v4" />
        </svg>
      </div>
      <h1 className="text-2xl md:text-3xl font-bold text-white mb-3" style={{ fontFamily: "var(--font-space)" }}>
        Admin access
      </h1>
      <p className="text-sm text-[var(--text-secondary)] max-w-sm mb-8 leading-relaxed">
        Enter the admin token to view the global user directory. This is the same
        value set as <code className="text-[var(--accent-primary)]">ADMIN_TOKEN</code> on the backend.
      </p>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (value.trim()) onSubmit(value.trim());
        }}
        className="w-full max-w-sm flex flex-col gap-3"
        style={{ gap: "12px" }}
      >
        <input
          autoFocus
          type="password"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="Admin token"
          className="input"
          aria-label="Admin token"
        />
        {error && <p className="text-sm text-red-400">{error}</p>}
        <button type="submit" disabled={busy || !value.trim()} className="btn-primary btn-lg">
          {busy ? "Verifying…" : "Unlock"}
        </button>
      </form>
    </main>
  );
}

// ─── Page ──────────────────────────────────────────────────
export default function AdminPage() {
  const [token, setTokenState] = useState<string>("");
  const [booted, setBooted] = useState(false);
  const [data, setData] = useState<AdminResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [query, setQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState<"all" | "google" | "guest">("all");
  const [sortKey, setSortKey] = useState<SortKey>("createdAt");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  // Load stored token on mount (client-only).
  useEffect(() => {
    setTokenState(readToken());
    setBooted(true);
  }, []);

  const fetchUsers = useCallback(async (tok: string) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/admin/users`, {
        headers: { "x-admin-token": tok },
      });
      const json = await res.json().catch(() => null);
      if (res.status === 401) throw new Error("Invalid admin token.");
      if (res.status === 503)
        throw new Error("Admin API is disabled on the server (set ADMIN_TOKEN, then redeploy).");
      if (!res.ok || !json?.success)
        throw new Error(json?.message || `Request failed (${res.status})`);
      setData(json as AdminResponse);
      // Persist only after a successful call so a bad token is never stored.
      try {
        localStorage.setItem(TOKEN_KEY, tok);
      } catch {
        /* ignore */
      }
      setTokenState(tok);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to load users.";
      setError(msg);
      // A rejected token shouldn't keep gating us out silently.
      if (msg.includes("Invalid")) {
        try {
          localStorage.removeItem(TOKEN_KEY);
        } catch {
          /* ignore */
        }
        setTokenState("");
        setData(null);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  // Auto-load once we have a stored token.
  useEffect(() => {
    if (booted && token && !data && !loading) fetchUsers(token);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [booted, token]);

  const lock = () => {
    try {
      localStorage.removeItem(TOKEN_KEY);
    } catch {
      /* ignore */
    }
    setTokenState("");
    setData(null);
    setError(null);
  };

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir(key === "name" ? "asc" : "desc");
    }
  };

  const rows = useMemo(() => {
    if (!data) return [];
    const q = query.trim().toLowerCase();
    let list = data.users;
    if (typeFilter !== "all")
      list = list.filter((u) => (typeFilter === "guest" ? u.isGuest : !u.isGuest));
    if (q)
      list = list.filter(
        (u) =>
          u.name.toLowerCase().includes(q) ||
          u.email.toLowerCase().includes(q) ||
          u.id.toLowerCase().includes(q)
      );
    const dir = sortDir === "asc" ? 1 : -1;
    return [...list].sort((a, b) => {
      const av = sortValue(a, sortKey);
      const bv = sortValue(b, sortKey);
      if (av < bv) return -1 * dir;
      if (av > bv) return 1 * dir;
      return 0;
    });
  }, [data, query, typeFilter, sortKey, sortDir]);

  // ─── Gate ───
  if (!booted) {
    return (
      <main className="min-h-screen pt-40 flex justify-center">
        <div className="w-10 h-10 border-2 border-[var(--accent-primary)] border-t-transparent rounded-full animate-spin" />
      </main>
    );
  }
  if (!token && !data) {
    return <TokenGate onSubmit={fetchUsers} error={error} busy={loading} />;
  }

  const summary = data?.summary;

  return (
    <main
      className="min-h-screen pt-40 pb-28 lg:pb-16 px-5 md:px-10 lg:px-14 max-w-[1280px] mx-auto"
      style={{ paddingLeft: "40px", paddingRight: "40px" }}
    >
      {/* ─── Header ─── */}
      <div className="flex items-end justify-between gap-4 mb-6 flex-wrap" style={{ gap: "16px", marginBottom: "24px" }}>
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-white" style={{ fontFamily: "var(--font-space)" }}>
            User Directory
          </h1>
          <p className="text-sm text-[var(--text-muted)] mt-1">
            Every account on PureVerse, globally.
          </p>
        </div>
        <div className="flex items-center gap-2.5" style={{ gap: "10px" }}>
          <button
            onClick={() => token && fetchUsers(token)}
            disabled={loading}
            className="btn-secondary btn-sm"
            style={{ padding: "8px 16px" }}
          >
            {loading ? "Refreshing…" : "Refresh"}
          </button>
          <button onClick={lock} className="btn-secondary btn-sm" style={{ padding: "8px 16px" }}>
            Lock
          </button>
        </div>
      </div>

      {error && (
        <div className="glass-panel rounded-xl p-4 mb-6 border border-red-500/20" style={{ padding: "16px" }}>
          <p className="text-sm text-red-400">{error}</p>
        </div>
      )}

      {/* ─── Summary ─── */}
      {summary && (
        <section className="grid grid-cols-3 gap-3 md:gap-4 mb-8" style={{ gap: "16px", marginBottom: "32px" }}>
          <StatTile value={summary.total} label="Total users" accent="#fff" />
          <StatTile value={summary.google} label="Google" accent="var(--accent-primary)" />
          <StatTile value={summary.guests} label="Guests" accent="var(--accent-teal)" />
        </section>
      )}

      {/* ─── Controls ─── */}
      <div className="flex flex-col sm:flex-row gap-3 mb-5" style={{ gap: "12px", marginBottom: "20px" }}>
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search name, email or ID…"
          className="input flex-1"
          aria-label="Search users"
        />
        <div className="flex rounded-full bg-white/5 border border-white/10 p-0.5 self-start" style={{ padding: "2px" }}>
          {(["all", "google", "guest"] as const).map((opt) => (
            <button
              key={opt}
              onClick={() => setTypeFilter(opt)}
              className={`px-4 py-1.5 rounded-full text-xs font-bold uppercase tracking-wide transition-all ${
                typeFilter === opt
                  ? "bg-[var(--accent-primary)] text-black"
                  : "text-[var(--text-secondary)] hover:text-white"
              }`}
              style={{ padding: "6px 16px" }}
            >
              {opt}
            </button>
          ))}
        </div>
      </div>

      {/* ─── Table ─── */}
      {loading && !data ? (
        <div className="flex justify-center py-20">
          <div className="w-10 h-10 border-2 border-[var(--accent-primary)] border-t-transparent rounded-full animate-spin" />
        </div>
      ) : rows.length === 0 ? (
        <div className="glass-panel rounded-2xl p-10 text-center">
          <p className="text-sm text-[var(--text-muted)]">
            {data && data.users.length > 0 ? "No users match your filters." : "No users yet."}
          </p>
        </div>
      ) : (
        <div className="glass-panel rounded-2xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm" style={{ borderCollapse: "collapse" }}>
              <thead>
                <tr className="text-left text-[var(--text-muted)] border-b border-white/[0.07]">
                  <Th label="User" />
                  <Th label="Type" />
                  <Th
                    label="Joined"
                    sortKey="createdAt"
                    activeKey={sortKey}
                    dir={sortDir}
                    onSort={toggleSort}
                  />
                  <Th
                    label="Last active"
                    sortKey="lastLoginAt"
                    activeKey={sortKey}
                    dir={sortDir}
                    onSort={toggleSort}
                  />
                  <Th
                    label="List"
                    sortKey="watchlist"
                    activeKey={sortKey}
                    dir={sortDir}
                    onSort={toggleSort}
                    numeric
                  />
                  <Th
                    label="Favs"
                    sortKey="favorites"
                    activeKey={sortKey}
                    dir={sortDir}
                    onSort={toggleSort}
                    numeric
                  />
                  <Th
                    label="History"
                    sortKey="history"
                    activeKey={sortKey}
                    dir={sortDir}
                    onSort={toggleSort}
                    numeric
                  />
                </tr>
              </thead>
              <tbody>
                {rows.map((u) => (
                  <tr
                    key={u.id}
                    className="border-b border-white/[0.04] hover:bg-white/[0.02] transition-colors"
                  >
                    <td className="py-3 px-4" style={{ padding: "12px 16px" }}>
                      <div className="flex items-center gap-3" style={{ gap: "12px" }}>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={u.avatar || defaultAvatar(u.name)}
                          alt=""
                          className="w-9 h-9 rounded-lg object-cover flex-shrink-0 bg-[var(--bg-card)]"
                          referrerPolicy="no-referrer"
                          loading="lazy"
                        />
                        <div className="min-w-0">
                          <p className="font-semibold text-white truncate max-w-[180px]">{u.name}</p>
                          <p className="text-xs text-[var(--text-muted)] truncate max-w-[200px]">
                            {u.email || u.id}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="py-3 px-4" style={{ padding: "12px 16px" }}>
                      <span
                        className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                          u.isGuest
                            ? "bg-white/10 text-[var(--text-secondary)]"
                            : "bg-[var(--accent-primary)]/15 text-[var(--accent-primary)]"
                        }`}
                      >
                        {u.isGuest ? "Guest" : "Google"}
                      </span>
                    </td>
                    <td
                      className="py-3 px-4 text-[var(--text-secondary)] whitespace-nowrap"
                      style={{ padding: "12px 16px" }}
                      title={u.createdAtISO}
                    >
                      {joinDate(u.createdAt)}
                    </td>
                    <td
                      className="py-3 px-4 text-[var(--text-secondary)] whitespace-nowrap"
                      style={{ padding: "12px 16px" }}
                      title={u.lastLoginAtISO}
                    >
                      {timeAgo(u.lastLoginAt)}
                    </td>
                    <td className="py-3 px-4 text-center text-white tabular-nums" style={{ padding: "12px 16px" }}>
                      {u.counts.watchlist}
                    </td>
                    <td className="py-3 px-4 text-center text-white tabular-nums" style={{ padding: "12px 16px" }}>
                      {u.counts.favorites}
                    </td>
                    <td className="py-3 px-4 text-center text-white tabular-nums" style={{ padding: "12px 16px" }}>
                      {u.counts.history}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {data && (
        <p className="text-xs text-[var(--text-muted)] mt-4 text-center">
          Showing {rows.length} of {data.users.length} users
        </p>
      )}
    </main>
  );
}

// ─── Sortable header cell ──────────────────────────────────
function Th({
  label,
  sortKey,
  activeKey,
  dir,
  onSort,
  numeric,
}: {
  label: string;
  sortKey?: SortKey;
  activeKey?: SortKey;
  dir?: "asc" | "desc";
  onSort?: (key: SortKey) => void;
  numeric?: boolean;
}) {
  const active = sortKey && activeKey === sortKey;
  const sortable = !!sortKey && !!onSort;
  return (
    <th
      className={`py-3 px-4 text-[11px] font-bold uppercase tracking-wider font-medium ${
        numeric ? "text-center" : "text-left"
      } ${sortable ? "cursor-pointer select-none hover:text-white transition-colors" : ""} ${
        active ? "text-[var(--accent-primary)]" : ""
      }`}
      style={{ padding: "12px 16px" }}
      onClick={sortable ? () => onSort!(sortKey!) : undefined}
    >
      {label}
      {active && <span className="ml-1">{dir === "asc" ? "↑" : "↓"}</span>}
    </th>
  );
}
