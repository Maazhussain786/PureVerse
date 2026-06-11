// ─── Shared API client ────────────────────────────────────
// Centralizes the backend base URL, the session token, and a tiny fetch
// wrapper used by the auth/user-state/notification layers.

export const API_BASE =
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000/api";

// socket.io server root (strip the /api suffix)
export const SOCKET_BASE = API_BASE.replace(/\/api\/?$/, "");

const TOKEN_KEY = "pureverse_token";

export function getToken(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export function setToken(token: string) {
  try {
    localStorage.setItem(TOKEN_KEY, token);
  } catch {
    /* ignore */
  }
}

export function clearToken() {
  try {
    localStorage.removeItem(TOKEN_KEY);
  } catch {
    /* ignore */
  }
}

interface ApiOptions {
  method?: "GET" | "POST" | "PATCH" | "PUT" | "DELETE";
  body?: unknown;
  auth?: boolean; // attach Bearer token (default true)
}

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

export async function api<T = any>(path: string, opts: ApiOptions = {}): Promise<T> {
  const { method = "GET", body, auth = true } = opts;
  const headers: Record<string, string> = {};
  if (body !== undefined) headers["Content-Type"] = "application/json";
  if (auth) {
    const token = getToken();
    if (token) headers["Authorization"] = `Bearer ${token}`;
  }

  const res = await fetch(`${API_BASE}${path}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  let json: any = null;
  try {
    json = await res.json();
  } catch {
    /* non-JSON response */
  }

  if (!res.ok || json?.success === false) {
    throw new ApiError(res.status, json?.message || `Request failed (${res.status})`);
  }
  return (json?.data ?? json) as T;
}

// Fire-and-forget mutation — optimistic UI never blocks on the network
export function apiSilent(path: string, opts: ApiOptions = {}) {
  api(path, opts).catch(() => {});
}

// Proxy MAL-hosted images through the backend (hotlink protection)
export function proxyImage(url: string): string {
  if (!url) return "";
  if (url.includes("myanimelist.net")) {
    return `${API_BASE}/proxy/image?url=${encodeURIComponent(url)}`;
  }
  return url;
}
