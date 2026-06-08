import { Request, Response } from 'express';
import {
  fetchTrendingAll,
  fetchTrendingMovies,
  fetchTrendingSeries,
  searchTmdb,
  getTmdbDetails,
  fetchSeasonEpisodes,
  fetchTopRatedMovies,
  fetchTopRatedSeries,
  fetchNowPlayingMovies,
  fetchRecommendations,
  fetchTrendingAnimeTmdb,
  fetchPopularAnimeTmdb,
  searchAnimeTmdb,
} from '../services/metadataService';
import { getAnimeDetails } from '../services/animeService';
import { resolveVidSrcStream } from '../scrapers/vidsrc';
import { getRecentAnime, getAnimeSeries } from '../services/anikotoService';
import { updateProgress } from '../services/progressTracker';

// Deduplicate items by ID
function deduplicateItems(items: any[]): any[] {
  const seen = new Map<string, any>();
  for (const item of items) {
    if (!seen.has(item.id)) {
      seen.set(item.id, item);
    } else {
      // If a duplicate is found and it's an anime, upgrade the existing item's type to anime
      if (item.type === 'anime') {
        seen.get(item.id).type = 'anime';
      }
    }
  }
  return Array.from(seen.values());
}

// ─── Trending (Combined) ─────────────────────────────────
export const getTrending = async (req: Request, res: Response) => {
  try {
    const [tmdbResults, animeResults] = await Promise.allSettled([
      fetchTrendingAll(),
      fetchTrendingAnimeTmdb(),
    ]);

    const tmdb = tmdbResults.status === 'fulfilled' ? tmdbResults.value : [];
    const anime = animeResults.status === 'fulfilled' ? animeResults.value : [];

    // Interleave: first 10 TMDB, then 5 anime, then rest
    const combined = deduplicateItems([
      ...tmdb.slice(0, 10),
      ...anime.slice(0, 5),
      ...tmdb.slice(10),
      ...anime.slice(5),
    ]);

    res.json({ success: true, data: combined });
  } catch (error) {
    console.error('Trending error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch trending media' });
  }
};

// ─── Trending Movies ─────────────────────────────────────
export const getTrendingMovies = async (req: Request, res: Response) => {
  try {
    const data = await fetchTrendingMovies();
    res.json({ success: true, data });
  } catch (error: any) {
    console.error('Trending movies error:', error?.message || error);
    res.status(500).json({ success: false, message: 'Failed to fetch trending movies' });
  }
};

// ─── Trending Series ─────────────────────────────────────
export const getTrendingSeries = async (req: Request, res: Response) => {
  try {
    const data = await fetchTrendingSeries();
    res.json({ success: true, data });
  } catch (error: any) {
    console.error('Trending series error:', error?.message || error);
    res.status(500).json({ success: false, message: 'Failed to fetch trending series' });
  }
};

// ─── Trending Anime ──────────────────────────────────────
export const getTrendingAnime = async (req: Request, res: Response) => {
  try {
    const data = await fetchTrendingAnimeTmdb();
    res.json({ success: true, data });
  } catch (error: any) {
    console.error('Trending anime error:', error?.message || error);
    res.status(500).json({ success: false, message: 'Failed to fetch trending anime' });
  }
};

// ─── Popular Anime ───────────────────────────────────────
export const getPopularAnime = async (req: Request, res: Response) => {
  try {
    const data = await fetchPopularAnimeTmdb();
    res.json({ success: true, data: deduplicateItems(data) });
  } catch (error: any) {
    console.error('Popular anime error:', error?.message || error);
    res.status(500).json({ success: false, message: 'Failed to fetch popular anime' });
  }
};

// ─── Search (Combined) ───────────────────────────────────
export const searchMedia = async (req: Request, res: Response) => {
  try {
    const query = (req.query.q as string) || '';
    if (!query.trim()) {
      res.json({ success: true, data: [] });
      return;
    }

    const [tmdbResults, animeResults] = await Promise.allSettled([
      searchTmdb(query),
      searchAnimeTmdb(query),
    ]);

    const tmdb = tmdbResults.status === 'fulfilled' ? tmdbResults.value : [];
    const anime = animeResults.status === 'fulfilled' ? animeResults.value : [];
    const combined = deduplicateItems([...tmdb, ...anime]);

    res.json({ success: true, data: combined });
  } catch (error: any) {
    console.error('Search error:', error?.message || error);
    res.status(500).json({ success: false, message: 'Search failed' });
  }
};

// ─── Media Details ───────────────────────────────────────
export const getMediaDetails = async (req: Request, res: Response) => {
  try {
    const type = req.params.type as string;
    const id = req.params.id as string;
    const rawId = id.replace('tmdb_', '').replace('mal_', '');

    if (id.startsWith('mal_')) {
      const details = await getAnimeDetails(rawId);
      res.json({ success: true, data: details });
      return;
    }

    // Default to TMDB
    const tmdbType = type === 'anime' ? 'tv' : (type as 'movie' | 'tv');
    const details = await getTmdbDetails(tmdbType, rawId);
    
    // Preserve 'anime' type for frontend routing
    if (type === 'anime') {
      details.type = 'anime';
    }

    res.json({ success: true, data: details });
  } catch (error: any) {
    console.error('Details error:', error?.message || error);
    res.status(500).json({ success: false, message: 'Failed to fetch media details' });
  }
};

// ─── Stream Sources ──────────────────────────────────────
export const getMediaStream = async (req: Request, res: Response) => {
  try {
    const type = req.params.type as string;
    const id = req.params.id as string;
    const { season, episode } = req.query;
    const streamData = await resolveVidSrcStream(
      type,
      id,
      season as string,
      episode as string
    );
    res.json({ success: true, data: streamData });
  } catch (error: any) {
    console.error('Stream error:', error?.message || error);
    res.status(500).json({ success: false, message: 'Failed to resolve stream' });
  }
};

// ─── Season Episodes ─────────────────────────────────────
export const getSeasonEpisodes = async (req: Request, res: Response) => {
  try {
    const tmdbId = req.params.id as string;
    const seasonNumber = parseInt(req.params.season as string, 10);
    if (isNaN(seasonNumber)) {
      res.status(400).json({ success: false, message: 'Invalid season number' });
      return;
    }
    const episodes = await fetchSeasonEpisodes(tmdbId, seasonNumber);
    res.json({ success: true, data: episodes });
  } catch (error: any) {
    console.error('Season episodes error:', error?.message || error);
    res.status(500).json({ success: false, message: 'Failed to fetch season episodes' });
  }
};

// ─── Top Rated ───────────────────────────────────────────
export const getTopRated = async (req: Request, res: Response) => {
  try {
    const type = req.params.type as string;
    let data;
    if (type === 'movies') {
      data = await fetchTopRatedMovies();
    } else {
      data = await fetchTopRatedSeries();
    }
    res.json({ success: true, data });
  } catch (error: any) {
    console.error('Top rated error:', error?.message || error);
    res.status(500).json({ success: false, message: 'Failed to fetch top rated' });
  }
};

// ─── Now Playing ─────────────────────────────────────────
export const getNowPlaying = async (req: Request, res: Response) => {
  try {
    const data = await fetchNowPlayingMovies();
    res.json({ success: true, data });
  } catch (error: any) {
    console.error('Now playing error:', error?.message || error);
    res.status(500).json({ success: false, message: 'Failed to fetch now playing' });
  }
};

// ─── Recommendations ─────────────────────────────────────
export const getRecommendations = async (req: Request, res: Response) => {
  try {
    const type = req.params.type as string;
    const id = req.params.id as string;
    const rawId = id.replace('tmdb_', '');
    const tmdbType = type === 'anime' ? 'tv' : (type as 'movie' | 'tv');
    const data = await fetchRecommendations(tmdbType, rawId);
    res.json({ success: true, data });
  } catch (error: any) {
    console.error('Recommendations error:', error?.message || error);
    res.status(500).json({ success: false, message: 'Failed to fetch recommendations' });
  }
};

// ─── Anikoto API Proxy ───────────────────────────────────
export const getAnikotoRecent = async (req: Request, res: Response) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const data = await getRecentAnime(page);
    res.json({ success: true, data });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const getAnikotoSeries = async (req: Request, res: Response) => {
  try {
    const id = req.params.id;
    const data = await getAnimeSeries(id);
    res.json({ success: true, data });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ─── Progress Tracking ───────────────────────────────────
export const postWatchProgress = async (req: Request, res: Response) => {
  try {
    const { mediaId, timestamp, duration } = req.body;
    if (!mediaId || timestamp === undefined || duration === undefined) {
      res.status(400).json({ success: false, message: 'Missing required fields' });
      return;
    }
    
    // In a real app, userId would come from JWT or session
    const userId = 'default_user';
    const progress = await updateProgress(userId, mediaId, timestamp, duration);
    
    res.json({ success: true, data: progress });
  } catch (error: any) {
    console.error('Progress tracking error:', error?.message);
    res.status(500).json({ success: false, message: 'Failed to update progress' });
  }
};
