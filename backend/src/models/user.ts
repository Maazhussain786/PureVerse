// ─── User platform models ─────────────────────────────────
// Persisted in backend/data/db.json via userStore. IDs are opaque strings.

export interface UserPreferences {
  autoplayNext: boolean;
  preferredAudio: 'sub' | 'dub';
  notifyNewEpisodes: boolean;
  notifyPartyInvites: boolean;
  notifyAnnouncements: boolean;
}

export interface ListItem {
  id: string; // media id, e.g. tmdb_1234
  type: string; // movie | tv | anime
  title: string;
  posterUrl: string;
  rating: number;
  releaseYear: number;
  addedAt: number;
}

export interface HistoryItem {
  key: string; // `${id}:${season ?? 0}:${episode ?? 0}`
  id: string;
  type: string;
  title: string;
  posterUrl: string;
  rating: number;
  releaseYear: number;
  season?: number;
  episode?: number;
  episodeTitle?: string;
  progress: number; // 0-100
  positionSec?: number;
  durationSec?: number;
  lastWatched: number;
}

export type NotificationKind =
  | 'episode'
  | 'season'
  | 'party_invite'
  | 'system';

export interface NotificationItem {
  id: string;
  kind: NotificationKind;
  title: string;
  body: string;
  image?: string; // poster url
  link?: string; // in-app route
  createdAt: number;
  read: boolean;
}

export interface UserRecord {
  id: string;
  email: string;
  name: string;
  googleSub?: string;
  avatar: string;
  isGuest: boolean;
  createdAt: number;
  lastLoginAt: number;
  preferences: UserPreferences;
  watchlist: ListItem[];
  favorites: ListItem[];
  history: HistoryItem[];
  notifications: NotificationItem[];
  recentSearches: string[];
  // Episode-release dedupe: mediaId → last episode key we notified about (e.g. "S2E5")
  episodeNotifyMeta: Record<string, string>;
  lastEpisodeCheckAt: number;
}

export interface SessionRecord {
  token: string;
  userId: string;
  createdAt: number;
  expiresAt: number;
}

export const DEFAULT_PREFERENCES: UserPreferences = {
  autoplayNext: true,
  preferredAudio: 'sub',
  notifyNewEpisodes: true,
  notifyPartyInvites: true,
  notifyAnnouncements: true,
};

export function historyKey(id: string, season?: number, episode?: number): string {
  return `${id}:${season ?? 0}:${episode ?? 0}`;
}

// Public-facing user shape (never expose sessions/meta internals)
export function toPublicUser(u: UserRecord) {
  return {
    id: u.id,
    email: u.email,
    name: u.name,
    avatar: u.avatar,
    isGuest: u.isGuest,
    createdAt: u.createdAt,
    preferences: u.preferences,
    counts: {
      watchlist: u.watchlist.length,
      favorites: u.favorites.length,
      history: u.history.length,
    },
  };
}
