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
  fetchLatestSeries,
  fetchRecommendations,
  fetchTrendingAnimeTmdb,
  fetchPopularAnimeTmdb,
  searchAnimeTmdb,
  fetchDiscover,
  DiscoverCategory,
  DiscoverSort,
} from '../services/metadataService';
import { getAnimeDetails } from '../services/animeService';
import { resolveVidSrcStream } from '../scrapers/vidsrc';
import {
  fetchSubtitleCandidates,
  fetchVtt,
  isAllowedSubLink,
} from '../services/subtitleService';
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

// ─── Discover (genre browsing, sorting, pagination) ──────
export const discoverMedia = async (req: Request, res: Response) => {
  try {
    const category = req.params.category as string;
    if (!['movies', 'series', 'anime'].includes(category)) {
      res.status(400).json({ success: false, message: 'Invalid category' });
      return;
    }
    const genreId = req.query.genre ? parseInt(req.query.genre as string, 10) : undefined;
    const sortRaw = req.query.sort as string;
    const sort: DiscoverSort = ['popular', 'top_rated', 'newest'].includes(sortRaw)
      ? (sortRaw as DiscoverSort)
      : 'popular';
    const page = Math.max(1, parseInt(req.query.page as string, 10) || 1);

    const data = await fetchDiscover(category as DiscoverCategory, { genreId, sort, page });
    res.json({ success: true, data });
  } catch (error: any) {
    console.error('Discover error:', error?.message || error);
    res.status(500).json({ success: false, message: 'Failed to discover media' });
  }
};

// ─── Search (Combined, with filters) ─────────────────────
// Query params: q (required), type (movie|tv|anime), genre (name),
// yearFrom / yearTo, minRating, limit.
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
    let combined = deduplicateItems([...tmdb, ...anime]);

    const type = (req.query.type as string) || '';
    if (['movie', 'tv', 'anime'].includes(type)) {
      combined = combined.filter((i: any) => i.type === type);
    }

    const genre = ((req.query.genre as string) || '').toLowerCase();
    if (genre) {
      combined = combined.filter((i: any) =>
        (i.genres || []).some((g: string) => g.toLowerCase().includes(genre))
      );
    }

    const yearFrom = parseInt(req.query.yearFrom as string, 10);
    if (!isNaN(yearFrom)) {
      combined = combined.filter((i: any) => i.releaseYear >= yearFrom);
    }
    const yearTo = parseInt(req.query.yearTo as string, 10);
    if (!isNaN(yearTo)) {
      combined = combined.filter((i: any) => i.releaseYear > 0 && i.releaseYear <= yearTo);
    }

    const minRating = parseFloat(req.query.minRating as string);
    if (!isNaN(minRating) && minRating > 0) {
      combined = combined.filter((i: any) => i.rating >= minRating);
    }

    const limit = parseInt(req.query.limit as string, 10);
    if (!isNaN(limit) && limit > 0) {
      combined = combined.slice(0, limit);
    }

    res.json({ success: true, data: combined });
  } catch (error: any) {
    console.error('Search error:', error?.message || error);
    res.status(500).json({ success: false, message: 'Search failed' });
  }
};

// ─── Search suggestions (top-8, lightweight payload) ─────
export const searchSuggest = async (req: Request, res: Response) => {
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
    const combined = deduplicateItems([...anime.slice(0, 3), ...tmdb]).slice(0, 8);
    res.json({
      success: true,
      data: combined.map((i: any) => ({
        id: i.id,
        type: i.type,
        title: i.title,
        posterUrl: i.posterUrl,
        releaseYear: i.releaseYear,
        rating: i.rating,
      })),
    });
  } catch (error: any) {
    console.error('Suggest error:', error?.message || error);
    res.status(500).json({ success: false, message: 'Suggest failed' });
  }
};

// ─── Trending searches (chips on the search page) ────────
export const searchTrending = async (_req: Request, res: Response) => {
  try {
    const items = await fetchTrendingAll();
    res.json({
      success: true,
      data: items.slice(0, 12).map((i: any) => ({
        id: i.id,
        type: i.type,
        title: i.title,
        posterUrl: i.posterUrl,
      })),
    });
  } catch (error: any) {
    console.error('Trending searches error:', error?.message || error);
    res.status(500).json({ success: false, message: 'Failed' });
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

// ─── Subtitles (movies / TV, via OpenSubtitles) ──────────
// Returns a list of { lang, url } where url proxies to getSubtitleFile (VTT).
// Called by the player AFTER playback starts so the stream call stays fast.
export const getSubtitles = async (req: Request, res: Response) => {
  try {
    const type = req.params.type as string;
    if (type !== 'movie' && type !== 'tv') {
      res.json({ success: true, data: [] });
      return;
    }
    const tmdbId = (req.params.id as string).replace('tmdb_', '');
    const season = req.query.season ? parseInt(req.query.season as string, 10) : undefined;
    const episode = req.query.episode ? parseInt(req.query.episode as string, 10) : undefined;

    const candidates = await fetchSubtitleCandidates(
      type as 'movie' | 'tv',
      tmdbId,
      season,
      episode
    );
    const proto = (req.get('x-forwarded-proto') || req.protocol).split(',')[0];
    const base = `${proto}://${req.get('host')}`;
    const data = candidates.map((c) => ({
      lang: c.lang,
      url: `${base}/api/subtitles/file?u=${encodeURIComponent(c.downloadLink)}`,
    }));
    res.json({ success: true, data });
  } catch (error: any) {
    console.error('Subtitles error:', error?.message || error);
    res.json({ success: true, data: [] }); // never block playback on subs
  }
};

// Proxy: download the OpenSubtitles .gz, gunzip + convert to WebVTT, serve it.
export const getSubtitleFile = async (req: Request, res: Response) => {
  try {
    const url = req.query.u as string;
    if (!url || !isAllowedSubLink(url)) {
      res.status(400).send('Invalid subtitle url');
      return;
    }
    const vtt = await fetchVtt(url);
    if (!vtt) {
      res.status(502).send('Could not fetch subtitle');
      return;
    }
    res.setHeader('Content-Type', 'text/vtt; charset=utf-8');
    res.setHeader('Cache-Control', 'public, max-age=86400');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.send(vtt);
  } catch (error: any) {
    console.error('Subtitle file error:', error?.message || error);
    res.status(502).send('Subtitle error');
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

// ─── Latest / Now Airing Series ──────────────────────────
export const getLatestSeries = async (_req: Request, res: Response) => {
  try {
    const data = await fetchLatestSeries();
    res.json({ success: true, data });
  } catch (error: any) {
    console.error('Latest series error:', error?.message || error);
    res.status(500).json({ success: false, message: 'Failed to fetch latest series' });
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
    const id = req.params.id as string;
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
