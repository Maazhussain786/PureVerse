import { Request, Response } from 'express';
import { allUsers } from '../services/userStore';

// GET /api/admin/users — owner-only listing of every account.
// Returns a totals summary plus one tidy row per user (no session tokens or
// internal dedupe metadata are exposed).
export function listAllUsers(_req: Request, res: Response) {
  const users = allUsers().sort((a, b) => b.createdAt - a.createdAt);

  const summary = {
    total: users.length,
    google: users.filter((u) => !u.isGuest).length,
    guests: users.filter((u) => u.isGuest).length,
  };

  const rows = users.map((u) => ({
    id: u.id,
    name: u.name,
    email: u.email,
    isGuest: u.isGuest,
    avatar: u.avatar,
    createdAt: u.createdAt,
    createdAtISO: new Date(u.createdAt).toISOString(),
    lastLoginAt: u.lastLoginAt,
    lastLoginAtISO: new Date(u.lastLoginAt).toISOString(),
    counts: {
      watchlist: u.watchlist.length,
      favorites: u.favorites.length,
      history: u.history.length,
      notifications: u.notifications.length,
    },
  }));

  res.json({ success: true, summary, users: rows });
}
