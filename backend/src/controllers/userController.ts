import { Response } from 'express';
import { AuthedRequest } from '../middleware/auth';
import { updateUser } from '../services/userStore';
import {
  HistoryItem,
  ListItem,
  historyKey,
  toPublicUser,
  DEFAULT_PREFERENCES,
} from '../models/user';

// ─── Profile ──────────────────────────────────────────────

// GET /api/user/me
export const getMe = (req: AuthedRequest, res: Response) => {
  res.json({ success: true, data: { user: toPublicUser(req.user!) } });
};

// PATCH /api/user/me  { name?, avatar?, preferences? }
export const patchMe = (req: AuthedRequest, res: Response) => {
  const user = req.user!;
  const { name, avatar, preferences } = req.body || {};

  if (typeof name === 'string') {
    const clean = name.trim().slice(0, 40);
    if (clean.length >= 2) user.name = clean;
  }
  if (typeof avatar === 'string' && avatar.length < 600) {
    user.avatar = avatar;
  }
  if (preferences && typeof preferences === 'object') {
    for (const key of Object.keys(DEFAULT_PREFERENCES) as (keyof typeof DEFAULT_PREFERENCES)[]) {
      if (key in preferences) {
        (user.preferences as any)[key] =
          key === 'preferredAudio'
            ? (preferences[key] === 'dub' ? 'dub' : 'sub')
            : !!preferences[key];
      }
    }
  }

  updateUser(user);
  res.json({ success: true, data: { user: toPublicUser(user) } });
};

// ─── Bulk state (loaded once after sign-in) ───────────────

// GET /api/user/state
export const getState = (req: AuthedRequest, res: Response) => {
  const user = req.user!;
  res.json({
    success: true,
    data: {
      watchlist: user.watchlist,
      favorites: user.favorites,
      history: user.history,
      recentSearches: user.recentSearches,
      preferences: user.preferences,
    },
  });
};

// ─── Watchlist / Favorites ────────────────────────────────

function sanitizeListItem(raw: any): ListItem | null {
  if (!raw || typeof raw.id !== 'string' || !raw.id) return null;
  return {
    id: raw.id,
    type: typeof raw.type === 'string' ? raw.type : 'movie',
    title: typeof raw.title === 'string' ? raw.title.slice(0, 200) : 'Untitled',
    posterUrl: typeof raw.posterUrl === 'string' ? raw.posterUrl : '',
    rating: Number(raw.rating) || 0,
    releaseYear: Number(raw.releaseYear) || 0,
    addedAt: Date.now(),
  };
}

function makeListHandlers(field: 'watchlist' | 'favorites') {
  return {
    add: (req: AuthedRequest, res: Response) => {
      const user = req.user!;
      const item = sanitizeListItem(req.body);
      if (!item) {
        res.status(400).json({ success: false, message: 'Invalid item' });
        return;
      }
      user[field] = [item, ...user[field].filter((i) => i.id !== item.id)].slice(0, 500);
      updateUser(user);
      res.json({ success: true, data: user[field] });
    },
    remove: (req: AuthedRequest, res: Response) => {
      const user = req.user!;
      const id = req.params.id;
      user[field] = user[field].filter((i) => i.id !== id);
      updateUser(user);
      res.json({ success: true, data: user[field] });
    },
  };
}

export const watchlistHandlers = makeListHandlers('watchlist');
export const favoritesHandlers = makeListHandlers('favorites');

// ─── Watch history / continue watching ────────────────────

// POST /api/user/history — upsert one entry (idempotent per media+episode)
export const upsertHistory = (req: AuthedRequest, res: Response) => {
  const user = req.user!;
  const raw = req.body || {};
  if (typeof raw.id !== 'string' || !raw.id) {
    res.status(400).json({ success: false, message: 'Invalid item' });
    return;
  }
  const season = raw.season != null ? Number(raw.season) : undefined;
  const episode = raw.episode != null ? Number(raw.episode) : undefined;
  const key = historyKey(raw.id, season, episode);

  const item: HistoryItem = {
    key,
    id: raw.id,
    type: typeof raw.type === 'string' ? raw.type : 'movie',
    title: typeof raw.title === 'string' ? raw.title.slice(0, 200) : 'Untitled',
    posterUrl: typeof raw.posterUrl === 'string' ? raw.posterUrl : '',
    rating: Number(raw.rating) || 0,
    releaseYear: Number(raw.releaseYear) || 0,
    season,
    episode,
    episodeTitle:
      typeof raw.episodeTitle === 'string' ? raw.episodeTitle.slice(0, 200) : undefined,
    progress: Math.max(0, Math.min(100, Number(raw.progress) || 0)),
    positionSec: raw.positionSec != null ? Number(raw.positionSec) : undefined,
    durationSec: raw.durationSec != null ? Number(raw.durationSec) : undefined,
    lastWatched: Date.now(),
  };

  user.history = [item, ...user.history.filter((h) => h.key !== key)].slice(0, 200);
  updateUser(user);
  res.json({ success: true, data: item });
};

// DELETE /api/user/history/:key — remove one entry
export const removeHistory = (req: AuthedRequest, res: Response) => {
  const user = req.user!;
  const key = decodeURIComponent(String(req.params.key));
  user.history = user.history.filter((h) => h.key !== key);
  updateUser(user);
  res.json({ success: true, data: { removed: key } });
};

// DELETE /api/user/history — clear all
export const clearHistory = (req: AuthedRequest, res: Response) => {
  const user = req.user!;
  user.history = [];
  updateUser(user);
  res.json({ success: true });
};

// ─── Recent searches ──────────────────────────────────────

// POST /api/user/searches { q }
export const addRecentSearch = (req: AuthedRequest, res: Response) => {
  const user = req.user!;
  const q = typeof req.body?.q === 'string' ? req.body.q.trim().slice(0, 80) : '';
  if (q) {
    user.recentSearches = [q, ...user.recentSearches.filter((s) => s.toLowerCase() !== q.toLowerCase())].slice(0, 10);
    updateUser(user);
  }
  res.json({ success: true, data: user.recentSearches });
};

// DELETE /api/user/searches/:q — remove one search
export const removeRecentSearch = (req: AuthedRequest, res: Response) => {
  const user = req.user!;
  const q = decodeURIComponent(String(req.params.q)).toLowerCase();
  user.recentSearches = user.recentSearches.filter((s) => s.toLowerCase() !== q);
  updateUser(user);
  res.json({ success: true, data: user.recentSearches });
};

// DELETE /api/user/searches
export const clearRecentSearches = (req: AuthedRequest, res: Response) => {
  const user = req.user!;
  user.recentSearches = [];
  updateUser(user);
  res.json({ success: true });
};
