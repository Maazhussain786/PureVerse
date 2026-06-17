import axios from 'axios';
import NodeCache from 'node-cache';

/**
 * Resolves the SAME anime servers anikoto.cz uses — real Japanese-audio + English
 * subtitle (SUB) and English DUB streams, served by megaplay.buzz (the embed
 * behind anikoto's VidPlay-1 / HD-1 / Vidstream-2 / VidCloud-1 / Kiwi-Stream
 * server menu).
 *
 * anikoto's public API (anikotoapi.site) exposes `/series/{numericId}` with each
 * episode's `embed_url.sub` / `embed_url.dub` (megaplay.buzz), but has NO search
 * endpoint — so we map a title → numeric series id via the anikoto SITE:
 *   1. GET  /search?keyword=<title>   → candidate `/watch/<slug>` links
 *   2. GET  /watch/<slug>             → `data-id="<numericId>"`
 *   3. GET  api/series/<numericId>    → episodes + megaplay embed_url{sub,dub}
 * When a MAL id is known we verify the candidate's `mal_id` matches, so we land
 * on the exact entry/cour. Everything is best-effort + cached + never throws:
 * a miss returns null and the caller falls back to the other anime embeds.
 */

const SITE = 'https://anikototv.to';
const API = 'https://anikotoapi.site';
const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36';

const http = axios.create({
  timeout: 9000,
  headers: {
    'User-Agent': UA,
    Accept: 'text/html,application/json,*/*',
    'Accept-Language': 'en-US,en;q=0.9',
  },
  // Don't throw on 4xx/5xx — we inspect status ourselves.
  validateStatus: () => true,
});

// title → anikoto numeric series id (stable: cache a week). Series episodes are
// cached 6h (megaplay ids are stable; only the listing grows). Negative lookups
// are cached 1h so a missing title doesn't re-scrape on every play.
const idCache = new NodeCache({ stdTTL: 7 * 24 * 3600, checkperiod: 3600 });
const seriesCache = new NodeCache({ stdTTL: 6 * 3600, checkperiod: 600 });
const negCache = new NodeCache({ stdTTL: 3600, checkperiod: 600 });

export interface AnikotoEmbeds {
  sub?: string;
  dub?: string;
}

async function fetchSeries(id: number): Promise<any | null> {
  const key = `series_${id}`;
  const cached = seriesCache.get<any>(key);
  if (cached) return cached;
  try {
    const res = await http.get(`${API}/series/${id}`);
    if (res.status === 200 && res.data?.ok && res.data.data) {
      seriesCache.set(key, res.data.data);
      return res.data.data;
    }
  } catch {
    /* network/parse — treat as miss */
  }
  return null;
}

/** Scrape `data-id` (the anikoto numeric series id) from a /watch/<slug> page. */
async function idFromWatchSlug(slug: string): Promise<number | null> {
  try {
    const res = await http.get(`${SITE}/watch/${slug}`);
    if (res.status !== 200 || typeof res.data !== 'string') return null;
    const m = res.data.match(/data-id="(\d+)"/);
    return m ? parseInt(m[1], 10) : null;
  } catch {
    return null;
  }
}

/** Resolve the anikoto numeric series id for a title (verify mal_id if known). */
async function resolveSeriesId(
  title: string,
  malId?: string | null
): Promise<number | null> {
  const cleaned = title.trim();
  if (!cleaned) return null;
  const key = `anikoto_id_${malId ? `mal:${malId}` : cleaned.toLowerCase()}`;

  const cached = idCache.get<number>(key);
  if (cached !== undefined) return cached;
  if (negCache.get(key)) return null;

  try {
    const res = await http.get(`${SITE}/search`, { params: { keyword: cleaned } });
    if (res.status !== 200 || typeof res.data !== 'string') {
      negCache.set(key, true);
      return null;
    }
    const slugs = [
      ...new Set(
        [...res.data.matchAll(/\/watch\/([a-z0-9-]+)/gi)].map((m) => m[1])
      ),
    ].slice(0, 4);

    let firstId: number | null = null;
    for (const slug of slugs) {
      const id = await idFromWatchSlug(slug);
      if (id == null) continue;
      if (firstId == null) firstId = id;
      if (!malId) {
        idCache.set(key, id);
        return id;
      }
      // Verify we landed on the right MAL entry/cour.
      const series = await fetchSeries(id);
      if (series && String(series.anime?.mal_id) === String(malId)) {
        idCache.set(key, id);
        return id;
      }
    }
    // No mal_id match — fall back to the best title match we saw.
    if (firstId != null) {
      idCache.set(key, firstId);
      return firstId;
    }
  } catch {
    /* swallow */
  }
  negCache.set(key, true);
  return null;
}

/**
 * Get megaplay.buzz SUB / DUB embed URLs for an anime episode, the same way
 * anikoto does. Returns null on any failure (caller falls back to other embeds).
 */
export async function getAnikotoEmbeds(
  title: string,
  altTitle: string | undefined,
  malId: string | null,
  episodeNum: number
): Promise<AnikotoEmbeds | null> {
  if (!title?.trim() && !altTitle?.trim()) return null;
  try {
    let id = await resolveSeriesId(title, malId);
    if (id == null && altTitle && altTitle.toLowerCase() !== title.toLowerCase()) {
      id = await resolveSeriesId(altTitle, malId);
    }
    if (id == null) return null;

    const series = await fetchSeries(id);
    const episodes: any[] = series?.episodes ?? [];
    if (!episodes.length) return null;

    const ep =
      episodes.find((e) => Number(e.number) === episodeNum) ??
      episodes[episodeNum - 1];
    const embed = ep?.embed_url;
    if (!embed || (!embed.sub && !embed.dub)) return null;

    return {
      sub: typeof embed.sub === 'string' ? embed.sub : undefined,
      dub: typeof embed.dub === 'string' ? embed.dub : undefined,
    };
  } catch {
    return null;
  }
}
