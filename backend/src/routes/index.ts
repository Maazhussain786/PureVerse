import { Router } from 'express';
import {
  getTrending,
  discoverMedia,
  getTrendingMovies,
  getTrendingSeries,
  getTrendingAnime,
  getPopularAnime,
  searchMedia,
  searchSuggest,
  searchTrending,
  getMediaDetails,
  getMediaStream,
  getSeasonEpisodes,
  getTopRated,
  getNowPlaying,
  getRecommendations,
  getAnikotoRecent,
  getAnikotoSeries,
  postWatchProgress,
} from '../controllers/mediaController';
import { getAnimeStream } from '../controllers/animeStreamController';
import {
  googleSignIn,
  guestSignIn,
  getSessionUser,
  logout,
} from '../controllers/authController';
import {
  getMe,
  patchMe,
  getState,
  watchlistHandlers,
  favoritesHandlers,
  upsertHistory,
  removeHistory,
  clearHistory,
  addRecentSearch,
  removeRecentSearch,
  clearRecentSearches,
} from '../controllers/userController';
import {
  listNotifications,
  markRead,
  markAllRead,
  deleteNotification,
  clearNotifications,
} from '../controllers/notificationController';
import {
  listPublicRooms,
  getRoomMeta,
  inviteToParty,
} from '../controllers/partyController';
import { requireAuth } from '../middleware/auth';

const router = Router();

// ─── Discovery ────────────────────────────────────────────
router.get('/trending', getTrending);
router.get('/trending/movies', getTrendingMovies);
router.get('/trending/series', getTrendingSeries);
router.get('/trending/anime', getTrendingAnime);
router.get('/popular/anime', getPopularAnime);
router.get('/top-rated/:type', getTopRated);
router.get('/now-playing', getNowPlaying);
router.get('/discover/:category', discoverMedia);

// ─── Search ───────────────────────────────────────────────
router.get('/search', searchMedia);
router.get('/search/suggest', searchSuggest);
router.get('/search/trending', searchTrending);

// ─── Media details & streaming ────────────────────────────
router.get('/media/details/:type/:id', getMediaDetails);
router.get('/media/stream/:type/:id', getMediaStream);
router.get('/media/recommendations/:type/:id', getRecommendations);
router.get('/tv/:id/season/:season', getSeasonEpisodes);

// ─── Anime native stream + Anikoto proxy ──────────────────
router.get('/anime/stream', getAnimeStream);
router.get('/anime/recent', getAnikotoRecent);
router.get('/anime/series/:id', getAnikotoSeries);

// ─── Progress tracking (legacy anonymous endpoint) ────────
router.post('/watch/progress', postWatchProgress);

// ─── Auth ─────────────────────────────────────────────────
router.post('/auth/google', googleSignIn);
router.post('/auth/guest', guestSignIn);
router.get('/auth/session', requireAuth, getSessionUser);
router.post('/auth/logout', requireAuth, logout);

// ─── User profile & synced state ──────────────────────────
router.get('/user/me', requireAuth, getMe);
router.patch('/user/me', requireAuth, patchMe);
router.get('/user/state', requireAuth, getState);

router.post('/user/watchlist', requireAuth, watchlistHandlers.add);
router.delete('/user/watchlist/:id', requireAuth, watchlistHandlers.remove);
router.post('/user/favorites', requireAuth, favoritesHandlers.add);
router.delete('/user/favorites/:id', requireAuth, favoritesHandlers.remove);

router.post('/user/history', requireAuth, upsertHistory);
router.delete('/user/history/:key', requireAuth, removeHistory);
router.delete('/user/history', requireAuth, clearHistory);

router.post('/user/searches', requireAuth, addRecentSearch);
router.delete('/user/searches/:q', requireAuth, removeRecentSearch);
router.delete('/user/searches', requireAuth, clearRecentSearches);

// ─── Notifications ────────────────────────────────────────
router.get('/user/notifications', requireAuth, listNotifications);
router.post('/user/notifications/read-all', requireAuth, markAllRead);
router.post('/user/notifications/:id/read', requireAuth, markRead);
router.delete('/user/notifications/:id', requireAuth, deleteNotification);
router.delete('/user/notifications', requireAuth, clearNotifications);

// ─── Watch party ──────────────────────────────────────────
router.get('/party/rooms', listPublicRooms);
router.get('/party/rooms/:code', getRoomMeta);
router.post('/party/invite', requireAuth, inviteToParty);

export default router;
