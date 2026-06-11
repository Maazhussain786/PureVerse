import axios, { AxiosInstance } from 'axios';
import NodeCache from 'node-cache';
import { UnifiedMediaItem, MediaDetails, UnifiedEpisodeItem } from '../models/media';
import { searchTmdb } from './metadataService';

const JIKAN_BASE_URL = process.env.JIKAN_BASE_URL || 'https://api.jikan.moe/v4';
const TMDB_IMAGE_BASE = process.env.TMDB_IMAGE_BASE || 'https://image.tmdb.org/t/p';

const cache = new NodeCache({ stdTTL: 900 });

// Strict queue-based rate limiter: Jikan allows ~3 requests/sec
let queue: Promise<any> = Promise.resolve();
async function rateLimitedGet(client: AxiosInstance, url: string, params?: any) {
  const requestPromise = queue.then(async () => {
    try {
      return await client.get(url, { params });
    } finally {
      await new Promise(resolve => setTimeout(resolve, 350));
    }
  });
  queue = requestPromise.catch(() => {});
  return requestPromise;
}

const jikanApi = axios.create({
  baseURL: JIKAN_BASE_URL,
  headers: { 'Content-Type': 'application/json' },
  timeout: 8000, // 8-second timeout to prevent queue stalling
});

function mapJikanToUnified(item: any): UnifiedMediaItem {
  return {
    id: `mal_${item.mal_id}`,
    type: 'anime',
    source: 'mal',
    title: item.title_english || item.title || 'Untitled',
    posterUrl: item.images?.jpg?.large_image_url || item.images?.jpg?.image_url || '',
    bannerUrl: item.images?.jpg?.large_image_url || '',
    rating: item.score || 0,
    releaseYear: item.aired?.prop?.from?.year || item.year || 0,
    genres: (item.genres || []).map((g: any) => g.name),
    synopsis: item.synopsis || '',
  };
}

async function attachTmdbImages(items: UnifiedMediaItem[]) {
  await Promise.all(items.map(async (item) => {
    try {
      const tmdbResults = await searchTmdb(item.title);
      if (tmdbResults && tmdbResults.length > 0 && tmdbResults[0].posterUrl) {
        item.posterUrl = tmdbResults[0].posterUrl;
        item.bannerUrl = tmdbResults[0].bannerUrl || tmdbResults[0].posterUrl;
      }
    } catch {
      // fallback to original mal image
    }
  }));
  return items;
}

// ─── Trending / Top Anime ─────────────────────────────────
export async function fetchTrendingAnime(): Promise<UnifiedMediaItem[]> {
  const cacheKey = 'jikan_trending_anime';
  const cached = cache.get<UnifiedMediaItem[]>(cacheKey);
  if (cached) return cached;

  try {
    const response = await rateLimitedGet(jikanApi, '/top/anime', {
      filter: 'airing',
      limit: 20,
    });
    let results = response.data.data.map(mapJikanToUnified);
    results = await attachTmdbImages(results);
    cache.set(cacheKey, results);
    return results;
  } catch (error) {
    console.error('Jikan trending anime error:', error);
    return [];
  }
}

export async function fetchPopularAnime(): Promise<UnifiedMediaItem[]> {
  const cacheKey = 'jikan_popular_anime';
  const cached = cache.get<UnifiedMediaItem[]>(cacheKey);
  if (cached) return cached;

  try {
    const response = await rateLimitedGet(jikanApi, '/top/anime', {
      filter: 'bypopularity',
      limit: 20,
    });
    let results = response.data.data.map(mapJikanToUnified);
    results = await attachTmdbImages(results);
    cache.set(cacheKey, results);
    return results;
  } catch (error) {
    console.error('Jikan popular anime error:', error);
    return [];
  }
}

// ─── Search Anime ─────────────────────────────────────────
export async function searchAnime(query: string): Promise<UnifiedMediaItem[]> {
  const cacheKey = `jikan_search_${query}`;
  const cached = cache.get<UnifiedMediaItem[]>(cacheKey);
  if (cached) return cached;

  try {
    const response = await rateLimitedGet(jikanApi, '/anime', {
      q: query,
      limit: 20,
      sfw: true,
    });
    let results = response.data.data.map(mapJikanToUnified);
    results = await attachTmdbImages(results);
    cache.set(cacheKey, results, 600);
    return results;
  } catch (error) {
    console.error('Jikan search error:', error);
    return [];
  }
}

// ─── Anime Details ────────────────────────────────────────
export async function getAnimeDetails(malId: string): Promise<MediaDetails> {
  const cacheKey = `jikan_details_${malId}`;
  const cached = cache.get<MediaDetails>(cacheKey);
  if (cached) return cached;

  const response = await rateLimitedGet(jikanApi, `/anime/${malId}/full`);
  const data = response.data.data;

  // Extract trailer
  const trailerUrl = data.trailer?.embed_url || undefined;

  // Fetch characters for cast
  let cast: { name: string; character: string; profileUrl: string }[] = [];
  try {
    const charResponse = await rateLimitedGet(jikanApi, `/anime/${malId}/characters`);
    cast = (charResponse.data.data || []).slice(0, 15).map((c: any) => ({
      name: c.character?.name || '',
      character: c.role || '',
      profileUrl: c.character?.images?.jpg?.image_url || '',
    }));
  } catch {
    // Character fetch failed, continue
  }

  // Fetch episodes
  let episodes: UnifiedEpisodeItem[] = [];
  try {
    const epResponse = await rateLimitedGet(jikanApi, `/anime/${malId}/episodes`, { page: 1 });
    episodes = (epResponse.data.data || []).slice(0, 25).map((ep: any) => ({
      id: `mal_ep_${ep.mal_id}`,
      episodeNumber: ep.mal_id,
      title: ep.title || ep.title_japanese || `Episode ${ep.mal_id}`,
      thumbnailUrl: '',
      airDate: ep.aired || '',
      synopsis: '',
    }));
  } catch {
    // Episode fetch failed, continue
  }

  const details: MediaDetails = {
    id: `mal_${data.mal_id}`,
    type: 'anime',
    source: 'mal',
    title: data.title_english || data.title || 'Untitled',
    posterUrl: data.images?.jpg?.large_image_url || '',
    bannerUrl: data.images?.jpg?.large_image_url || '',
    rating: data.score || 0,
    releaseYear: data.aired?.prop?.from?.year || data.year || 0,
    genres: (data.genres || []).map((g: any) => g.name),
    synopsis: data.synopsis || '',
    cast,
    episodes,
    trailerUrl,
    runtime: data.duration ? parseInt(data.duration) || undefined : undefined,
    status: data.status || undefined,
    totalEpisodes: data.episodes || undefined,
    originalTitle: data.title_japanese || data.title || undefined,
    voteCount: data.scored_by || undefined,
    popularity: data.members || undefined,
    language: 'Japanese',
    studios: (data.studios || []).map((s: any) => s.name),
    ageRating: data.rating || undefined,
    releaseDate: data.aired?.from || undefined,
  };

  try {
    const tmdbResults = await searchTmdb(details.title);
    if (tmdbResults && tmdbResults.length > 0 && tmdbResults[0].posterUrl) {
      details.posterUrl = tmdbResults[0].posterUrl;
      details.bannerUrl = tmdbResults[0].bannerUrl || tmdbResults[0].posterUrl;
    }
  } catch {
    // fallback to original mal image
  }

  cache.set(cacheKey, details, 3600);
  return details;
}
