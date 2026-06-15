import { StreamPayload, StreamSource, Subtitle } from '../models/media';
import { getAnimeDetails } from '../services/animeService';
import { searchTmdb, getTmdbDetails } from '../services/metadataService';
import { fetchHiAnimeStream } from '../services/aniwatchService';

type Source = StreamSource;

/**
 * Generates embed URLs from multiple working providers.
 * The frontend renders these in an iframe and exposes a Server Selector
 * so the user can fall back if one provider is blocked or has no source.
 *
 * IMPORTANT: Providers are validated periodically. Dead domains (embed.su,
 * vidsrc.net, autoembed.cc, vidbinge.dev, smashy.stream) were removed in
 * 2026-06 after they started returning empty/blocked responses, which was
 * the root cause of the "anime stream unavailable" problem — the default
 * server was simply dead. Keep the most reliable provider FIRST.
 */
export async function resolveVidSrcStream(
  type: string,
  id: string,
  season?: string,
  episode?: string
): Promise<StreamPayload> {
  const rawId = id.replace('tmdb_', '').replace('mal_', '');
  const sources: Source[] = [];
  let subtitles: Subtitle[] = [];

  if (type === 'movie') {
    // ── MOVIE servers (film/TV catalogue providers — kept separate from anime) ──
    // Ordered ad-clean FIRST. VidLink/VidFast are "premium API" embeds that
    // play fine inside a sandboxed iframe (no popup/redirect ads). VidSrc,
    // 2Embed and MultiEmbed are ad-heavy and demand "Please Disable Sandbox",
    // so they sit lower — reachable via Switch Server + the Ad-Block toggle.
    sources.push(
      {
        server: 'VidLink',
        quality: 'Auto',
        url: `https://vidlink.pro/movie/${rawId}`,
        type: 'embed',
      },
      {
        server: 'VidFast',
        quality: 'Auto',
        url: `https://vidfast.pro/movie/${rawId}?autoPlay=true`,
        type: 'embed',
      },
      {
        server: 'VidSrc',
        quality: 'Auto',
        url: `https://vidsrc.to/embed/movie/${rawId}`,
        type: 'embed',
      },
      {
        server: '2Embed',
        quality: 'Auto',
        url: `https://www.2embed.cc/embed/${rawId}`,
        type: 'embed',
      },
      {
        server: 'MultiEmbed',
        quality: 'Auto',
        url: `https://multiembed.mov/?video_id=${rawId}&tmdb=1`,
        type: 'embed',
      }
    );
  } else if (type === 'tv') {
    // ── TV servers (film/TV catalogue providers — kept separate from anime) ──
    // Ad-clean providers first (see movie note above).
    const s = season || '1';
    const e = episode || '1';
    sources.push(
      {
        server: 'VidLink',
        quality: 'Auto',
        url: `https://vidlink.pro/tv/${rawId}/${s}/${e}`,
        type: 'embed',
      },
      {
        server: 'VidFast',
        quality: 'Auto',
        url: `https://vidfast.pro/tv/${rawId}/${s}/${e}?autoPlay=true`,
        type: 'embed',
      },
      {
        server: 'VidSrc',
        quality: 'Auto',
        url: `https://vidsrc.to/embed/tv/${rawId}/${s}/${e}`,
        type: 'embed',
      },
      {
        server: '2Embed',
        quality: 'Auto',
        url: `https://www.2embed.cc/embedtv/${rawId}&s=${s}&e=${e}`,
        type: 'embed',
      },
      {
        server: 'MultiEmbed',
        quality: 'Auto',
        url: `https://multiembed.mov/?video_id=${rawId}&tmdb=1&s=${s}&e=${e}`,
        type: 'embed',
      }
    );
  } else if (type === 'anime') {
    let tmdbId = rawId;
    let searchTitle = '';
    let altTitle = '';

    if (id.startsWith('mal_')) {
      try {
        const animeDetails = await getAnimeDetails(rawId);
        searchTitle = animeDetails?.title || '';
        altTitle = animeDetails?.originalTitle || '';
        // Map to a TMDB id for the iframe fallback servers.
        if (animeDetails && animeDetails.title) {
          const tmdbResults = await searchTmdb(animeDetails.title);
          const tvResult = tmdbResults.find(r => r.type === 'tv' || r.type === 'anime');
          if (tvResult) {
            tmdbId = tvResult.id.replace('tmdb_', '');
          }
        }
      } catch (e) {
        console.error('Failed to map Anime MAL ID to TMDB ID for streaming', e);
      }
    } else {
      // TMDB-sourced anime — pull the title for the HiAnime search.
      try {
        const d = await getTmdbDetails('tv', rawId);
        searchTitle = d?.title || '';
        altTitle = (d as any)?.originalTitle || '';
      } catch (e) {
        console.error('Failed to load TMDB anime title for streaming', e);
      }
    }

    // ── PRIMARY: HiAnime direct stream (real SUB + DUB + subtitle tracks) ──
    const epNum = parseInt(episode || '1', 10) || 1;
    let direct = searchTitle ? await fetchHiAnimeStream(searchTitle, epNum) : null;
    if (!direct && altTitle && altTitle.toLowerCase() !== searchTitle.toLowerCase()) {
      direct = await fetchHiAnimeStream(altTitle, epNum);
    }
    if (direct) {
      for (const s of direct.sources) {
        sources.push({
          server: `HiAnime ${s.category.toUpperCase()}`,
          quality: s.quality,
          url: s.url,
          type: 'direct',
          category: s.category,
          headers: direct.headers,
        });
      }
      if (direct.subtitles.length) {
        subtitles = direct.subtitles.map((t) => ({ lang: t.lang, url: t.url }));
      }
    }

    // ── FALLBACK: iframe embeds (always available; provider-side sub/dub) ──
    if (tmdbId) {
      const s = season || '1';
      const e = episode || '1';

      // ── ANIME servers (kept SEPARATE from movie/TV) ──
      // Anime is mapped onto a TMDB TV id, so these are the providers that
      // carry anime under their /tv/ endpoint with built-in sub/dub switching.
      // NOTE: a dedicated HiAnime/Vidstream-style player keys off AniList/MAL
      // ids (not TMDB) and needs a mapping layer — tracked as a follow-up.
      sources.push(
        {
          server: 'VidLink',
          quality: 'Auto',
          url: `https://vidlink.pro/tv/${tmdbId}/${s}/${e}`,
          type: 'embed',
          category: 'multi',
        },
        {
          server: '2Embed',
          quality: 'Auto',
          url: `https://www.2embed.cc/embedtv/${tmdbId}&s=${s}&e=${e}`,
          type: 'embed',
          category: 'sub',
        },
        {
          server: 'VidSrc',
          quality: 'Auto',
          url: `https://vidsrc.to/embed/tv/${tmdbId}/${s}/${e}`,
          type: 'embed',
          category: 'multi',
        },
        {
          server: 'MultiEmbed',
          quality: 'Auto',
          url: `https://multiembed.mov/?video_id=${tmdbId}&tmdb=1&s=${s}&e=${e}`,
          type: 'embed',
          category: 'multi',
        }
      );
    }
  }

  return {
    sources,
    subtitles,
  };
}
