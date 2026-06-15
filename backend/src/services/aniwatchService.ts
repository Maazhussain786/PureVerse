import { HiAnime } from 'aniwatch';
import NodeCache from 'node-cache';

/**
 * In-process HiAnime (aniwatch) scraper. Returns a DIRECT HLS stream for anime
 * with separate SUB / DUB sources, subtitle tracks (English first) and the
 * HTTP headers the MegaCloud CDN requires.
 *
 * This intentionally never throws: any failure (HiAnime down, Cloudflare block,
 * title not found, episode mismatch) returns null so the caller falls back to
 * the iframe embeds. HiAnime breaks periodically — bump the `aniwatch` version
 * and redeploy when that happens.
 */
const hianime = new HiAnime.Scraper();

// Stream URLs from MegaCloud expire quickly, so keep stream entries short-lived;
// resolved anime ids are stable, so cache those longer.
const cache = new NodeCache({ stdTTL: 900, checkperiod: 120 });

const CALL_TIMEOUT_MS = 9000;

export interface AnimeDirectSource {
  url: string;
  quality: string;
  isM3U8: boolean;
  category: 'sub' | 'dub';
}

export interface AnimeDirectResult {
  sources: AnimeDirectSource[];
  subtitles: { lang: string; url: string }[];
  headers: Record<string, string>;
  provider: string;
}

function withTimeout<T>(p: Promise<T>, label: string): Promise<T> {
  return Promise.race([
    p,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error(`${label} timeout`)), CALL_TIMEOUT_MS)
    ),
  ]);
}

/** Resolve a HiAnime animeId for a title, preferring an exact non-movie match. */
async function resolveAnimeId(title: string): Promise<string | null> {
  const key = `hianime_id_${title.toLowerCase()}`;
  const cached = cache.get<string>(key);
  if (cached) return cached;

  const res: any = await withTimeout(hianime.search(title), 'search');
  const animes: any[] = res?.animes ?? [];
  if (!animes.length) return null;

  const lower = title.toLowerCase();
  const pick =
    animes.find(
      (a) =>
        (a.name || '').toLowerCase() === lower &&
        String(a.type).toUpperCase() !== 'MOVIE'
    ) ||
    animes.find((a) => (a.jname || '').toLowerCase() === lower) ||
    animes.find(
      (a) =>
        String(a.type).toUpperCase() === 'TV' ||
        String(a.type).toUpperCase() === 'ONA'
    ) ||
    animes[0];

  if (pick?.id) cache.set(key, pick.id, 86400); // ids are stable: 1 day
  return pick?.id ?? null;
}

/**
 * Fetch a direct stream for `title` episode `episodeNum`. Returns null on any
 * failure so the caller can fall back to iframe embeds.
 */
export async function fetchHiAnimeStream(
  title: string,
  episodeNum: number
): Promise<AnimeDirectResult | null> {
  if (!title?.trim()) return null;
  const cacheKey = `hianime_stream_${title.toLowerCase()}_${episodeNum}`;
  const cached = cache.get<AnimeDirectResult>(cacheKey);
  if (cached) return cached;

  try {
    const animeId = await resolveAnimeId(title);
    if (!animeId) return null;

    const epData: any = await withTimeout(
      hianime.getEpisodes(animeId),
      'episodes'
    );
    const episodes: any[] = epData?.episodes ?? [];
    if (!episodes.length) return null;
    const ep =
      episodes.find((e) => Number(e.number) === episodeNum) ??
      episodes[episodeNum - 1];
    if (!ep?.episodeId) return null;

    const sources: AnimeDirectSource[] = [];
    const subtitles: { lang: string; url: string }[] = [];
    const seenSub = new Set<string>();
    let headers: Record<string, string> = {};

    for (const category of ['sub', 'dub'] as const) {
      try {
        const data: any = await withTimeout(
          hianime.getEpisodeSources(ep.episodeId, 'hd-1' as any, category),
          `sources-${category}`
        );
        const list: any[] = data?.sources ?? [];
        const hls =
          list.find(
            (s) => s.type === 'hls' || String(s.url).includes('.m3u8')
          ) || list[0];
        if (!hls?.url) continue;

        sources.push({
          url: hls.url,
          quality: 'Auto',
          isM3U8: String(hls.url).includes('.m3u8'),
          category,
        });

        if (data?.headers && Object.keys(data.headers).length) {
          headers = data.headers;
        }

        for (const t of data?.tracks ?? []) {
          const lang = t.lang || t.label;
          const url = t.url || t.file;
          if (!url || !lang) continue;
          const kind = String(t.kind || '').toLowerCase();
          if (kind === 'thumbnails' || String(lang).toLowerCase() === 'thumbnails') {
            continue;
          }
          if (seenSub.has(url)) continue;
          seenSub.add(url);
          subtitles.push({ lang, url });
        }
      } catch {
        /* try the other category */
      }
    }

    if (!sources.length) return null;

    // MegaCloud streams need a Referer/Origin; provide a sane default if the
    // scraper didn't return one.
    if (!headers.Referer && !headers.referer) {
      headers = { ...headers, Referer: 'https://megacloud.tv/' };
    }

    // English first so the player can auto-select it.
    subtitles.sort(
      (a, b) =>
        (b.lang.toLowerCase().startsWith('eng') ? 1 : 0) -
        (a.lang.toLowerCase().startsWith('eng') ? 1 : 0)
    );

    const result: AnimeDirectResult = {
      sources,
      subtitles,
      headers,
      provider: 'HiAnime',
    };
    cache.set(cacheKey, result); // default 15-min TTL (urls expire)
    return result;
  } catch (e: any) {
    console.error('[aniwatchService] failed:', e?.message || e);
    return null;
  }
}
