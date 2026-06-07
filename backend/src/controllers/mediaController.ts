import { Request, Response } from 'express';
import {
  fetchTrendingAll,
  fetchTrendingMovies,
  fetchTrendingSeries,
  searchTmdb,
  getTmdbDetails,
} from '../services/metadataService';
import {
  fetchTrendingAnime,
  fetchPopularAnime,
  searchAnime,
  getAnimeDetails,
} from '../services/animeService';
import { resolveVidSrcStream } from '../scrapers/vidsrc';

// Deduplicate items by ID
function deduplicateItems(items: any[]): any[] {
  const seen = new Set<string>();
  return items.filter((item) => {
    if (seen.has(item.id)) return false;
    seen.add(item.id);
    return true;
  });
}

// ─── Trending (Combined) ─────────────────────────────────
export const getTrending = async (req: Request, res: Response) => {
  try {
    const [tmdbResults, animeResults] = await Promise.allSettled([
      fetchTrendingAll(),
      fetchTrendingAnime(),
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
    const data = await fetchTrendingAnime();
    res.json({ success: true, data });
  } catch (error: any) {
    console.error('Trending anime error:', error?.message || error);
    res.status(500).json({ success: false, message: 'Failed to fetch trending anime' });
  }
};

// ─── Popular Anime ───────────────────────────────────────
export const getPopularAnime = async (req: Request, res: Response) => {
  try {
    const data = await fetchPopularAnime();
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
      searchAnime(query),
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
