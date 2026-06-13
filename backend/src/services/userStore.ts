import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import {
  UserRecord,
  SessionRecord,
  DEFAULT_PREFERENCES,
  NotificationItem,
} from '../models/user';

// ─── JSON-file persistence ────────────────────────────────
// Single-process store: everything lives in memory and is flushed to
// data/db.json with a debounced atomic write (tmp file + rename). This keeps
// the backend dependency-free while giving real cross-device persistence.

const DATA_DIR = path.join(__dirname, '..', '..', 'data');
const DB_FILE = path.join(DATA_DIR, 'db.json');

interface DbShape {
  users: Record<string, UserRecord>;
  sessions: Record<string, SessionRecord>;
}

let db: DbShape = { users: {}, sessions: {} };

function load() {
  try {
    if (fs.existsSync(DB_FILE)) {
      const raw = fs.readFileSync(DB_FILE, 'utf-8');
      const parsed = JSON.parse(raw);
      db = {
        users: parsed.users || {},
        sessions: parsed.sessions || {},
      };
      // Backfill fields added after a user record was first written
      for (const u of Object.values(db.users)) {
        u.preferences = { ...DEFAULT_PREFERENCES, ...(u.preferences || {}) };
        u.watchlist = u.watchlist || [];
        u.favorites = u.favorites || [];
        u.history = u.history || [];
        u.notifications = u.notifications || [];
        u.recentSearches = u.recentSearches || [];
        u.episodeNotifyMeta = u.episodeNotifyMeta || {};
        u.lastEpisodeCheckAt = u.lastEpisodeCheckAt || 0;
      }
      console.log(`[UserStore] Loaded ${Object.keys(db.users).length} users`);
    }
  } catch (err) {
    console.error('[UserStore] Failed to load db.json, starting empty:', err);
    db = { users: {}, sessions: {} };
  }
}

let saveTimer: NodeJS.Timeout | null = null;

function persistNow() {
  try {
    if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
    const tmp = DB_FILE + '.tmp';
    fs.writeFileSync(tmp, JSON.stringify(db), 'utf-8');
    fs.renameSync(tmp, DB_FILE);
  } catch (err) {
    console.error('[UserStore] Persist failed:', err);
  }
}

export function save() {
  if (saveTimer) return;
  saveTimer = setTimeout(() => {
    saveTimer = null;
    persistNow();
  }, 500);
}

// Flush pending writes when the process exits cleanly. SIGTERM is what Docker
// (and most process managers) send on stop/restart, so handle it alongside
// SIGINT to avoid losing the last debounced write in a container.
process.on('beforeExit', () => persistNow());
const flushAndExit = () => {
  persistNow();
  process.exit(0);
};
process.on('SIGINT', flushAndExit);
process.on('SIGTERM', flushAndExit);

load();

// ─── ID / token helpers ───────────────────────────────────
export function newId(prefix = 'u'): string {
  return `${prefix}_${crypto.randomBytes(9).toString('hex')}`;
}

export function newToken(): string {
  return crypto.randomBytes(32).toString('hex');
}

// ─── Users ────────────────────────────────────────────────
export function getUser(id: string): UserRecord | undefined {
  return db.users[id];
}

export function findUserByGoogleSub(sub: string): UserRecord | undefined {
  return Object.values(db.users).find((u) => u.googleSub === sub);
}

export function findUserByEmail(email: string): UserRecord | undefined {
  const lower = email.toLowerCase();
  return Object.values(db.users).find((u) => u.email.toLowerCase() === lower);
}

export function findUserByNameOrEmail(q: string): UserRecord | undefined {
  const lower = q.toLowerCase();
  return Object.values(db.users).find(
    (u) => u.email.toLowerCase() === lower || u.name.toLowerCase() === lower
  );
}

export function createUser(partial: {
  email: string;
  name: string;
  avatar?: string;
  googleSub?: string;
  isGuest?: boolean;
}): UserRecord {
  const now = Date.now();
  const user: UserRecord = {
    id: newId('u'),
    email: partial.email,
    name: partial.name,
    googleSub: partial.googleSub,
    avatar: partial.avatar || '',
    isGuest: !!partial.isGuest,
    createdAt: now,
    lastLoginAt: now,
    preferences: { ...DEFAULT_PREFERENCES },
    watchlist: [],
    favorites: [],
    history: [],
    notifications: [],
    recentSearches: [],
    episodeNotifyMeta: {},
    lastEpisodeCheckAt: 0,
  };
  db.users[user.id] = user;
  save();
  return user;
}

export function updateUser(user: UserRecord) {
  db.users[user.id] = user;
  save();
}

export function allUsers(): UserRecord[] {
  return Object.values(db.users);
}

// ─── Sessions ─────────────────────────────────────────────
const SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 60; // 60 days, sliding

export function createSession(userId: string): SessionRecord {
  const session: SessionRecord = {
    token: newToken(),
    userId,
    createdAt: Date.now(),
    expiresAt: Date.now() + SESSION_TTL_MS,
  };
  db.sessions[session.token] = session;
  save();
  return session;
}

export function getSession(token: string): SessionRecord | undefined {
  const s = db.sessions[token];
  if (!s) return undefined;
  if (s.expiresAt < Date.now()) {
    delete db.sessions[token];
    save();
    return undefined;
  }
  // Sliding expiry: extend when more than a day has elapsed since last bump
  if (s.expiresAt - Date.now() < SESSION_TTL_MS - 1000 * 60 * 60 * 24) {
    s.expiresAt = Date.now() + SESSION_TTL_MS;
    save();
  }
  return s;
}

export function destroySession(token: string) {
  delete db.sessions[token];
  save();
}

// ─── Notifications ────────────────────────────────────────
const MAX_NOTIFICATIONS = 100;

export function pushNotification(
  user: UserRecord,
  notif: Omit<NotificationItem, 'id' | 'createdAt' | 'read'>
): NotificationItem {
  const item: NotificationItem = {
    ...notif,
    id: newId('n'),
    createdAt: Date.now(),
    read: false,
  };
  user.notifications.unshift(item);
  if (user.notifications.length > MAX_NOTIFICATIONS) {
    user.notifications = user.notifications.slice(0, MAX_NOTIFICATIONS);
  }
  updateUser(user);
  return item;
}
