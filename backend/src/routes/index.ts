import { Router } from 'express';
import {
  getTrending,
  searchMedia,
  getMediaDetails,
  getMediaStream
} from '../controllers/mediaController';

const router = Router();

router.get('/trending', getTrending);
router.get('/search', searchMedia);
router.get('/media/details/:type/:id', getMediaDetails);
router.get('/media/stream/:type/:id', getMediaStream);

export default router;
