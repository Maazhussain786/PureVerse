import axios from 'axios';
import {
  createSession,
  createUser,
  findUserByEmail,
  findUserByGoogleSub,
  pushNotification,
  updateUser,
} from './userStore';
import { HistoryItem, ListItem, UserRecord } from '../models/user';

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || '';

interface GoogleTokenInfo {
  sub: string;
  email: string;
  email_verified: string;
  name?: string;
  picture?: string;
  aud: string;
  exp: string;
}

/**
 * Verifies a Google ID token using Google's tokeninfo endpoint. Google
 * validates the signature server-side; we additionally check audience
 * (when GOOGLE_CLIENT_ID is configured) and expiry.
 */
export async function verifyGoogleToken(credential: string): Promise<GoogleTokenInfo> {
  const res = await axios.get('https://oauth2.googleapis.com/tokeninfo', {
    params: { id_token: credential },
    timeout: 8000,
  });
  const info = res.data as GoogleTokenInfo;
  if (!info?.sub || !info?.email) {
    throw new Error('Invalid Google token payload');
  }
  if (GOOGLE_CLIENT_ID && info.aud !== GOOGLE_CLIENT_ID) {
    throw new Error('Google token audience mismatch');
  }
  if (info.exp && parseInt(info.exp, 10) * 1000 < Date.now()) {
    throw new Error('Google token expired');
  }
  return info;
}

export interface ImportedState {
  watchlist?: ListItem[];
  favorites?: ListItem[];
  history?: HistoryItem[];
}

/**
 * Merges guest-mode localStorage state into a server account. Union by
 * id/key, keeping whichever side was touched most recently.
 */
export function mergeImportedState(user: UserRecord, imported?: ImportedState) {
  if (!imported) return;

  const mergeList = (current: ListItem[], incoming?: ListItem[]) => {
    if (!Array.isArray(incoming)) return current;
    const byId = new Map<string, ListItem>(current.map((i) => [i.id, i]));
    for (const raw of incoming) {
      if (!raw || typeof raw.id !== 'string') continue;
      const existing = byId.get(raw.id);
      if (!existing || (raw.addedAt || 0) > (existing.addedAt || 0)) {
        byId.set(raw.id, { ...raw, addedAt: raw.addedAt || Date.now() });
      }
    }
    return Array.from(byId.values()).sort((a, b) => b.addedAt - a.addedAt);
  };

  user.watchlist = mergeList(user.watchlist, imported.watchlist).slice(0, 500);
  user.favorites = mergeList(user.favorites, imported.favorites).slice(0, 500);

  if (Array.isArray(imported.history)) {
    const byKey = new Map<string, HistoryItem>(user.history.map((h) => [h.key, h]));
    for (const raw of imported.history) {
      if (!raw || typeof raw.id !== 'string') continue;
      const key = raw.key || `${raw.id}:${raw.season ?? 0}:${raw.episode ?? 0}`;
      const existing = byKey.get(key);
      if (!existing || (raw.lastWatched || 0) > (existing.lastWatched || 0)) {
        byKey.set(key, { ...raw, key, lastWatched: raw.lastWatched || Date.now() });
      }
    }
    user.history = Array.from(byKey.values())
      .sort((a, b) => b.lastWatched - a.lastWatched)
      .slice(0, 200);
  }

  updateUser(user);
}

function welcome(user: UserRecord) {
  pushNotification(user, {
    kind: 'system',
    title: 'Welcome to PureVerse',
    body: 'Your watchlist, favorites and watch history now sync across all your devices.',
    link: '/profile',
  });
}

export async function signInWithGoogle(credential: string, imported?: ImportedState) {
  const info = await verifyGoogleToken(credential);

  let user = findUserByGoogleSub(info.sub) || findUserByEmail(info.email);
  let isNew = false;

  if (!user) {
    user = createUser({
      email: info.email,
      name: info.name || info.email.split('@')[0],
      avatar: info.picture || '',
      googleSub: info.sub,
    });
    isNew = true;
  } else {
    user.googleSub = user.googleSub || info.sub;
    user.isGuest = false;
    // Only adopt the Google picture if the user never picked a custom avatar
    if (!user.avatar && info.picture) user.avatar = info.picture;
    user.lastLoginAt = Date.now();
    updateUser(user);
  }

  mergeImportedState(user, imported);
  if (isNew) welcome(user);

  const session = createSession(user.id);
  return { user, session, isNew };
}

/**
 * Local guest account — lets the entire user system (profile, lists,
 * notifications, parties) work in development without Google credentials.
 */
export function signInAsGuest(name?: string, imported?: ImportedState) {
  const cleanName = (name || 'Guest').trim().slice(0, 40) || 'Guest';
  const user = createUser({
    email: `${cleanName.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${Date.now().toString(36)}@guest.pureverse.local`,
    name: cleanName,
    isGuest: true,
  });
  mergeImportedState(user, imported);
  welcome(user);
  const session = createSession(user.id);
  return { user, session, isNew: true };
}
