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
} from '../controllers/mediaController';

const router = Router();

// Combined trending
router.get('/trending', getTrending);

// Category-specific trending
router.get('/trending/movies', getTrendingMovies);
router.get('/trending/series', getTrendingSeries);
router.get('/trending/anime', getTrendingAnime);
router.get('/popular/anime', getPopularAnime);

// Search across all sources
router.get('/search', searchMedia);

// Media details & streaming
router.get('/media/details/:type/:id', getMediaDetails);
router.get('/media/stream/:type/:id', getMediaStream);

export default router;
