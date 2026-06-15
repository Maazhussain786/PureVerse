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

// Common ISO-639-1 → human-readable language names (fallback: uppercased code)
const LANGUAGE_NAMES: Record<string, string> = {
  en: 'English', ja: 'Japanese', ko: 'Korean', zh: 'Chinese', fr: 'French',
  es: 'Spanish', de: 'German', it: 'Italian', pt: 'Portuguese', ru: 'Russian',
  hi: 'Hindi', ar: 'Arabic', th: 'Thai', tr: 'Turkish', id: 'Indonesian',
};

function languageName(code?: string): string | undefined {
  if (!code) return undefined;
  return LANGUAGE_NAMES[code] || code.toUpperCase();
}

// Extract the US (or first available) age certification from TMDB append data.
function extractCertification(type: 'movie' | 'tv', data: any): string | undefined {
  if (type === 'tv') {
    const results = data.content_ratings?.results || [];
    const us = results.find((r: any) => r.iso_3166_1 === 'US');
    const pick = us || results[0];
    return pick?.rating || undefined;
  }
  const results = data.release_dates?.results || [];
  const us = results.find((r: any) => r.iso_3166_1 === 'US');
  const pick = us || results[0];
  const cert = (pick?.release_dates || []).map((d: any) => d.certification).find((c: string) => c);
  return cert || undefined;
}

// Static TMDB genre-id → name map (movie + TV ids combined; list endpoints
// only return genre_ids, full names only appear on detail responses).
const TMDB_GENRE_NAMES: Record<number, string> = {
  28: 'Action', 12: 'Adventure', 16: 'Animation', 35: 'Comedy', 80: 'Crime',
  99: 'Documentary', 18: 'Drama', 10751: 'Family', 14: 'Fantasy', 36: 'History',
  27: 'Horror', 10402: 'Music', 9648: 'Mystery', 10749: 'Romance',
  878: 'Sci-Fi', 10770: 'TV Movie', 53: 'Thriller', 10752: 'War', 37: 'Western',
  10759: 'Action & Adventure', 10762: 'Kids', 10763: 'News', 10764: 'Reality',
  10765: 'Sci-Fi & Fantasy', 10766: 'Soap', 10767: 'Talk', 10768: 'War & Politics',
};

function mapTmdbToUnified(item: any): UnifiedMediaItem {
  const mediaType = item.media_type || (item.first_air_date ? 'tv' : 'movie');
  const genres: string[] =
    item.genres?.length
      ? item.genres.map((g: any) => g.name)
      : (item.genre_ids || []).map((id: number) => TMDB_GENRE_NAMES[id]).filter(Boolean);
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
    genres,
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
    params: { append_to_response: 'credits,videos,content_ratings,release_dates' },
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
        runtime: ep.runtime || undefined,
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
    originalTitle: data.original_title || data.original_name || undefined,
    tagline: data.tagline || undefined,
    voteCount: data.vote_count || undefined,
    popularity: data.popularity || undefined,
    language:
      languageName(data.original_language) ||
      data.spoken_languages?.[0]?.english_name ||
      undefined,
    studios: (data.production_companies || []).slice(0, 3).map((c: any) => c.name),
    ageRating: extractCertification(type, data),
    releaseDate: data.release_date || data.first_air_date || undefined,
  };

  cache.set(cacheKey, details, 3600); // 1 hour cache
  return details;
}

// ─── IMDB id (for subtitle lookup) ────────────────────────
export async function getImdbId(
  type: 'movie' | 'tv',
  tmdbId: string
): Promise<string | null> {
  const cacheKey = `imdb_${type}_${tmdbId}`;
  const cached = cache.get<string>(cacheKey);
  if (cached !== undefined) return cached || null;
  try {
    const res = await tmdbApi.get(`/${type}/${tmdbId}/external_ids`);
    const imdb = (res.data?.imdb_id as string) || '';
    cache.set(cacheKey, imdb, 86400);
    return imdb || null;
  } catch {
    cache.set(cacheKey, '', 3600);
    return null;
  }
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

// ─── Discover (genre browsing + sorting + pagination) ─────
export type DiscoverCategory = 'movies' | 'series' | 'anime';
export type DiscoverSort = 'popular' | 'top_rated' | 'newest';

export async function fetchDiscover(
  category: DiscoverCategory,
  opts: { genreId?: number; sort?: DiscoverSort; page?: number } = {}
): Promise<UnifiedMediaItem[]> {
  const { genreId, sort = 'popular', page = 1 } = opts;
  const isMovie = category === 'movies';
  const tmdbType = isMovie ? 'movie' : 'tv';

  const cacheKey = `tmdb_discover_${category}_${genreId || 'all'}_${sort}_${page}`;
  const cached = cache.get<UnifiedMediaItem[]>(cacheKey);
  if (cached) return cached;

  const params: Record<string, any> = { page, include_adult: false };

  if (sort === 'top_rated') {
    params.sort_by = 'vote_average.desc';
    // Require a sensible vote floor so obscure 10/10s don't dominate
    params['vote_count.gte'] = isMovie ? 300 : 150;
  } else if (sort === 'newest') {
    params.sort_by = isMovie ? 'primary_release_date.desc' : 'first_air_date.desc';
    params['vote_count.gte'] = 20;
  } else {
    params.sort_by = 'popularity.desc';
  }

  const genres: number[] = [];
  if (category === 'anime') {
    genres.push(16); // Animation
    params.with_original_language = 'ja';
  }
  if (genreId && !genres.includes(genreId)) genres.push(genreId);
  if (genres.length > 0) params.with_genres = genres.join(',');

  const response = await tmdbApi.get(`/discover/${tmdbType}`, { params });
  const mediaType = category === 'anime' ? 'anime' : tmdbType;
  const results = response.data.results.map((item: any) =>
    mapTmdbToUnified({ ...item, media_type: mediaType })
  );
  cache.set(cacheKey, results, 1800); // 30 min
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

// ─── Episode air info (notification generator) ────────────
export interface TvAirInfo {
  id: string;
  name: string;
  status?: string;
  posterUrl: string;
  lastEpisode?: { season: number; episode: number; name?: string; airDate?: string };
  nextEpisode?: { season: number; episode: number; name?: string; airDate?: string };
  lastSeasonNumber?: number;
}

export async function fetchTvAirInfo(rawId: string): Promise<TvAirInfo | null> {
  const cacheKey = `tmdb_air_${rawId}`;
  const cached = cache.get<TvAirInfo | null>(cacheKey);
  if (cached !== undefined) return cached;

  try {
    const response = await tmdbApi.get(`/tv/${rawId}`);
    const d = response.data;
    const mapEp = (ep: any) =>
      ep
        ? {
            season: ep.season_number,
            episode: ep.episode_number,
            name: ep.name,
            airDate: ep.air_date,
          }
        : undefined;
    const info: TvAirInfo = {
      id: `tmdb_${d.id}`,
      name: d.name || 'Untitled',
      status: d.status,
      posterUrl: d.poster_path ? `${TMDB_IMAGE_BASE}/w300${d.poster_path}` : '',
      lastEpisode: mapEp(d.last_episode_to_air),
      nextEpisode: mapEp(d.next_episode_to_air),
      lastSeasonNumber: d.number_of_seasons,
    };
    cache.set(cacheKey, info, 1800); // 30 min
    return info;
  } catch {
    cache.set(cacheKey, null, 1800);
    return null;
  }
}
