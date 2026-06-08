import axios from 'axios';
import NodeCache from 'node-cache';

const ANIKOTO_BASE_URL = 'http://anikotoapi.site';

// 1-hour TTL (3600 seconds) cache to prevent rate-limiting (60 req / 120s max)
const cache = new NodeCache({ stdTTL: 3600, checkperiod: 600 });

const anikotoApi = axios.create({
  baseURL: ANIKOTO_BASE_URL,
  timeout: 10000, // 10-second timeout
  headers: {
    'Accept': 'application/json',
    'User-Agent': 'Aniverse-Backend-Proxy/1.0',
  },
});

/**
 * Securely fetches and caches recent anime releases from Anikoto API.
 */
export async function getRecentAnime(page: number = 1): Promise<any> {
  const cacheKey = `anikoto_recent_${page}`;
  const cachedData = cache.get(cacheKey);
  if (cachedData) {
    return cachedData;
  }

  try {
    const response = await anikotoApi.get('/recent-anime', { params: { page } });
    const data = response.data;
    cache.set(cacheKey, data);
    return data;
  } catch (error: any) {
    console.error(`[AnikotoService] Error fetching recent anime (page ${page}):`, error?.message);
    throw new Error('Failed to fetch recent anime from Anikoto');
  }
}

/**
 * Securely fetches and caches details/episodes for a specific anime series from Anikoto API.
 */
export async function getAnimeSeries(id: string): Promise<any> {
  const cacheKey = `anikoto_series_${id}`;
  const cachedData = cache.get(cacheKey);
  if (cachedData) {
    return cachedData;
  }

  try {
    const response = await anikotoApi.get(`/series/${id}`);
    const data = response.data;
    cache.set(cacheKey, data);
    return data;
  } catch (error: any) {
    console.error(`[AnikotoService] Error fetching series ${id}:`, error?.message);
    throw new Error(`Failed to fetch series details for ${id} from Anikoto`);
  }
}
