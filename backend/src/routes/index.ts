import { Router } from 'express';
import {
  getTrending,
  getTrendingMovies,
  getTrendingSeries,
  getTrendingAnime,
  getPopularAnime,
  searchMedia,
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

const router = Router();

// Combined trending
router.get('/trending', getTrending);

// Category-specific trending
router.get('/trending/movies', getTrendingMovies);
router.get('/trending/series', getTrendingSeries);
router.get('/trending/anime', getTrendingAnime);
router.get('/popular/anime', getPopularAnime);

// Top rated & new releases
router.get('/top-rated/:type', getTopRated);
router.get('/now-playing', getNowPlaying);

// Search across all sources
router.get('/search', searchMedia);

// Media details & streaming
router.get('/media/details/:type/:id', getMediaDetails);
router.get('/media/stream/:type/:id', getMediaStream);

// Season episodes
router.get('/tv/:id/season/:season', getSeasonEpisodes);

import { getAnimeStream } from '../controllers/animeStreamController';

// Recommendations
router.get('/media/recommendations/:type/:id', getRecommendations);

// Anime Native Stream
router.get('/anime/stream', getAnimeStream);

// Anikoto Proxy Routes
router.get('/anime/recent', getAnikotoRecent);
router.get('/anime/series/:id', getAnikotoSeries);

// Progress Tracking Route
router.post('/watch/progress', postWatchProgress);

export default router;

router.use((req, res, next) => { console.log('[API] ' + req.method + ' ' + req.originalUrl); next(); });
