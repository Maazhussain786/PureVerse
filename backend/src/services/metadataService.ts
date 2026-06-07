import axios from 'axios';
import NodeCache from 'node-cache';
import { UnifiedMediaItem, MediaDetails, UnifiedEpisodeItem } from '../models/media';

const TMDB_ACCESS_TOKEN = process.env.TMDB_ACCESS_TOKEN || '';
const TMDB_BASE_URL = process.env.TMDB_BASE_URL || 'https://api.themoviedb.org/3';
const TMDB_IMAGE_BASE = process.env.TMDB_IMAGE_BASE || 'https://image.tmdb.org/t/p';

// Cache: trending = 15 min, details = 1 hour
const cache = new NodeCache({ stdTTL: 900 });

const tmdbApi = axios.create({
  baseURL: TMDB_BASE_URL,
  headers: {
    Authorization: `Bearer ${TMDB_ACCESS_TOKEN}`,
    'Content-Type': 'application/json;charset=utf-8',
  },
});

function mapTmdbToUnified(item: any): UnifiedMediaItem {
  const mediaType = item.media_type || (item.first_air_date ? 'tv' : 'movie');
  return {
    id: `tmdb_${item.id}`,
    type: mediaType === 'anime' ? 'anime' : (mediaType === 'tv' ? 'tv' : 'movie'),
    source: 'tmdb',
    title: item.title || item.name || 'Untitled',
    posterUrl: item.poster_path
      ? `${TMDB_IMAGE_BASE}/w500${item.poster_path}`
      : '',
    bannerUrl: item.backdrop_path
      ? `${TMDB_IMAGE_BASE}/w1280${item.backdrop_path}`
      : '',
    rating: item.vote_average || 0,
    releaseYear: parseInt(
      (item.release_date || item.first_air_date || '0000').substring(0, 4)
    ),
    genres: (item.genres || []).map((g: any) => g.name),
    synopsis: item.overview || '',
  };
}

// ─── Trending ─────────────────────────────────────────────
export async function fetchTrendingMovies(): Promise<UnifiedMediaItem[]> {
  const cacheKey = 'tmdb_trending_movies';
  const cached = cache.get<UnifiedMediaItem[]>(cacheKey);
  if (cached) return cached;

  const response = await tmdbApi.get('/trending/movie/day');
  const results = response.data.results.map(mapTmdbToUnified);
  cache.set(cacheKey, results);
  return results;
}

export async function fetchTrendingSeries(): Promise<UnifiedMediaItem[]> {
  const cacheKey = 'tmdb_trending_series';
  const cached = cache.get<UnifiedMediaItem[]>(cacheKey);
  if (cached) return cached;

  const response = await tmdbApi.get('/trending/tv/day');
  const results = response.data.results.map(mapTmdbToUnified);
  cache.set(cacheKey, results);
  return results;
}

export async function fetchTrendingAll(): Promise<UnifiedMediaItem[]> {
  const cacheKey = 'tmdb_trending_all';
  const cached = cache.get<UnifiedMediaItem[]>(cacheKey);
  if (cached) return cached;

  const response = await tmdbApi.get('/trending/all/day');
  const results = response.data.results
    .filter((item: any) => item.media_type !== 'person')
    .map(mapTmdbToUnified);
  cache.set(cacheKey, results);
  return results;
}

// ─── Search ───────────────────────────────────────────────
export async function searchTmdb(query: string): Promise<UnifiedMediaItem[]> {
  const cacheKey = `tmdb_search_${query}`;
  const cached = cache.get<UnifiedMediaItem[]>(cacheKey);
  if (cached) return cached;

  const response = await tmdbApi.get('/search/multi', {
    params: { query, include_adult: false, page: 1 },
  });
  const results = response.data.results
    .filter((item: any) => item.media_type !== 'person')
    .map(mapTmdbToUnified);
  cache.set(cacheKey, results, 600); // 10 min cache for search
  return results;
}

// ─── Details ──────────────────────────────────────────────
export async function getTmdbDetails(
  type: 'movie' | 'tv',
  tmdbId: string
): Promise<MediaDetails> {
  const cacheKey = `tmdb_details_${type}_${tmdbId}`;
  const cached = cache.get<MediaDetails>(cacheKey);
  if (cached) return cached;

  const response = await tmdbApi.get(`/${type}/${tmdbId}`, {
    params: { append_to_response: 'credits,videos' },
  });

  const data = response.data;

  // Extract YouTube trailer
  const trailer = (data.videos?.results || []).find(
    (v: any) => v.type === 'Trailer' && v.site === 'YouTube'
  );

  // Map cast
  const cast = (data.credits?.cast || []).slice(0, 15).map((c: any) => ({
    name: c.name,
    character: c.character || '',
    profileUrl: c.profile_path
      ? `${TMDB_IMAGE_BASE}/w185${c.profile_path}`
      : '',
  }));

  // Fetch episodes for TV shows
  let episodes: UnifiedEpisodeItem[] = [];
  if (type === 'tv' && data.number_of_seasons) {
    try {
      // Fetch latest season episodes
      const latestSeason = data.number_of_seasons;
      const seasonResponse = await tmdbApi.get(
        `/tv/${tmdbId}/season/${latestSeason}`
      );
      episodes = (seasonResponse.data.episodes || []).map((ep: any) => ({
        id: `tmdb_ep_${ep.id}`,
        seasonNumber: ep.season_number,
        episodeNumber: ep.episode_number,
        title: ep.name || `Episode ${ep.episode_number}`,
        thumbnailUrl: ep.still_path
          ? `${TMDB_IMAGE_BASE}/w300${ep.still_path}`
          : '',
        airDate: ep.air_date || '',
        synopsis: ep.overview || '',
      }));
    } catch {
      // Season fetch failed, continue with empty episodes
    }
  }

  const details: MediaDetails = {
    id: `tmdb_${data.id}`,
    type: type === 'tv' ? 'tv' : 'movie',
    source: 'tmdb',
    title: data.title || data.name || 'Untitled',
    posterUrl: data.poster_path
      ? `${TMDB_IMAGE_BASE}/w500${data.poster_path}`
      : '',
    bannerUrl: data.backdrop_path
      ? `${TMDB_IMAGE_BASE}/w1280${data.backdrop_path}`
      : '',
    rating: data.vote_average || 0,
    releaseYear: parseInt(
      (data.release_date || data.first_air_date || '0000').substring(0, 4)
    ),
    genres: (data.genres || []).map((g: any) => g.name),
    synopsis: data.overview || '',
    cast,
    episodes,
    trailerUrl: trailer
      ? `https://www.youtube.com/embed/${trailer.key}`
      : undefined,
    runtime: data.runtime || data.episode_run_time?.[0] || undefined,
    status: data.status || undefined,
    totalSeasons: data.number_of_seasons || undefined,
    totalEpisodes: data.number_of_episodes || undefined,
  };

  cache.set(cacheKey, details, 3600); // 1 hour cache
  return details;
}

// ─── Season Episodes ──────────────────────────────────────
export async function fetchSeasonEpisodes(
  tmdbId: string,
  seasonNumber: number
): Promise<UnifiedEpisodeItem[]> {
  const cacheKey = `tmdb_season_${tmdbId}_${seasonNumber}`;
  const cached = cache.get<UnifiedEpisodeItem[]>(cacheKey);
  if (cached) return cached;

  const response = await tmdbApi.get(`/tv/${tmdbId}/season/${seasonNumber}`);
  const episodes = (response.data.episodes || []).map((ep: any) => ({
    id: `tmdb_ep_${ep.id}`,
    seasonNumber: ep.season_number,
    episodeNumber: ep.episode_number,
    title: ep.name || `Episode ${ep.episode_number}`,
    thumbnailUrl: ep.still_path
      ? `${TMDB_IMAGE_BASE}/w300${ep.still_path}`
      : '',
    airDate: ep.air_date || '',
    synopsis: ep.overview || '',
  }));
  cache.set(cacheKey, episodes, 3600);
  return episodes;
}

// ─── Top Rated ────────────────────────────────────────────
export async function fetchTopRatedMovies(): Promise<UnifiedMediaItem[]> {
  const cacheKey = 'tmdb_top_rated_movies';
  const cached = cache.get<UnifiedMediaItem[]>(cacheKey);
  if (cached) return cached;

  const response = await tmdbApi.get('/movie/top_rated');
  const results = response.data.results.map((item: any) =>
    mapTmdbToUnified({ ...item, media_type: 'movie' })
  );
  cache.set(cacheKey, results);
  return results;
}

export async function fetchTopRatedSeries(): Promise<UnifiedMediaItem[]> {
  const cacheKey = 'tmdb_top_rated_series';
  const cached = cache.get<UnifiedMediaItem[]>(cacheKey);
  if (cached) return cached;

  const response = await tmdbApi.get('/tv/top_rated');
  const results = response.data.results.map((item: any) =>
    mapTmdbToUnified({ ...item, media_type: 'tv' })
  );
  cache.set(cacheKey, results);
  return results;
}

// ─── Now Playing / New Releases ───────────────────────────
export async function fetchNowPlayingMovies(): Promise<UnifiedMediaItem[]> {
  const cacheKey = 'tmdb_now_playing';
  const cached = cache.get<UnifiedMediaItem[]>(cacheKey);
  if (cached) return cached;

  const response = await tmdbApi.get('/movie/now_playing');
  const results = response.data.results.map((item: any) =>
    mapTmdbToUnified({ ...item, media_type: 'movie' })
  );
  cache.set(cacheKey, results);
  return results;
}

// ─── Recommendations ─────────────────────────────────────
export async function fetchRecommendations(
  type: 'movie' | 'tv',
  tmdbId: string
): Promise<UnifiedMediaItem[]> {
  const cacheKey = `tmdb_recs_${type}_${tmdbId}`;
  const cached = cache.get<UnifiedMediaItem[]>(cacheKey);
  if (cached) return cached;

  const response = await tmdbApi.get(`/${type}/${tmdbId}/recommendations`);
  const results = (response.data.results || []).slice(0, 12).map((item: any) =>
    mapTmdbToUnified({ ...item, media_type: type })
  );
  cache.set(cacheKey, results, 3600);
  return results;
}

// ─── Anime (via TMDB to bypass Jikan rate limits) ─────────
export async function fetchTrendingAnimeTmdb(): Promise<UnifiedMediaItem[]> {
  const cacheKey = 'tmdb_trending_anime';
  const cached = cache.get<UnifiedMediaItem[]>(cacheKey);
  if (cached) return cached;

  // TMDB Discover for Anime (Genre 16 = Animation, Original Lang = Japanese)
  // Sorted by popularity for currently airing or recent
  const dateStr = new Date();
  dateStr.setFullYear(dateStr.getFullYear() - 1);
  const minDate = dateStr.toISOString().split('T')[0];

  const response = await tmdbApi.get('/discover/tv', {
    params: {
      with_genres: '16',
      with_original_language: 'ja',
      sort_by: 'popularity.desc',
      'first_air_date.gte': minDate,
    },
  });
  const results = response.data.results.map((item: any) =>
    mapTmdbToUnified({ ...item, media_type: 'anime' })
  );
  cache.set(cacheKey, results);
  return results;
}

export async function fetchPopularAnimeTmdb(): Promise<UnifiedMediaItem[]> {
  const cacheKey = 'tmdb_popular_anime';
  const cached = cache.get<UnifiedMediaItem[]>(cacheKey);
  if (cached) return cached;

  const response = await tmdbApi.get('/discover/tv', {
    params: {
      with_genres: '16',
      with_original_language: 'ja',
      sort_by: 'vote_count.desc', // All-time popular
    },
  });
  const results = response.data.results.map((item: any) =>
    mapTmdbToUnified({ ...item, media_type: 'anime' })
  );
  cache.set(cacheKey, results);
  return results;
}

export async function searchAnimeTmdb(query: string): Promise<UnifiedMediaItem[]> {
  const cacheKey = `tmdb_search_anime_${query}`;
  const cached = cache.get<UnifiedMediaItem[]>(cacheKey);
  if (cached) return cached;

  const response = await tmdbApi.get('/search/tv', {
    params: { query, include_adult: false },
  });
  
  // Filter for Japanese Animation
  const results = response.data.results
    .filter((item: any) => 
      item.original_language === 'ja' && 
      (item.genre_ids || []).includes(16)
    )
    .map((item: any) => mapTmdbToUnified({ ...item, media_type: 'anime' }));
    
  cache.set(cacheKey, results, 600);
  return results;
}
