import { StreamPayload, StreamSource, Subtitle } from '../models/media';
import { getAnimeDetails, resolveMalId } from '../services/animeService';
import { searchTmdb, getTmdbDetails } from '../services/metadataService';
import { fetchHiAnimeStream } from '../services/aniwatchService';
import { getAnikotoEmbeds } from '../services/anikotoStreamService';

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
    // VidLink is the DEFAULT web player (first); the rest are Switch-Server
    // fallbacks the client auto-advances to if one is blocked or has no source.
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
        // Different infra from vidsrc.to — often has newer releases first.
        server: 'VidSrc.cc',
        quality: 'Auto',
        url: `https://vidsrc.cc/v2/embed/movie/${rawId}`,
        type: 'embed',
      },
      {
        server: 'Videasy',
        quality: 'Auto',
        url: `https://player.videasy.net/movie/${rawId}`,
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
    // VidLink is the DEFAULT web player (first); the rest are Switch-Server fallbacks.
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
        // Different infra from vidsrc.to — often has newer episodes first.
        server: 'VidSrc.cc',
        quality: 'Auto',
        url: `https://vidsrc.cc/v2/embed/tv/${rawId}/${s}/${e}`,
        type: 'embed',
      },
      {
        server: 'Videasy',
        quality: 'Auto',
        url: `https://player.videasy.net/tv/${rawId}/${s}/${e}`,
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
    let malId: string | null = null;
    let searchTitle = '';
    let altTitle = '';
    const s = season || '1';
    const e = episode || '1';
    const epNum = parseInt(episode || '1', 10) || 1;

    // HiAnime (aniwatch) is currently broken upstream, so it's OFF by default —
    // skipping it keeps anime fast and avoids error-log noise. Flip
    // ENABLE_HIANIME=true once aniwatch can parse the live site again, and the
    // native SUB/DUB path lights up automatically.
    const hiAnimeEnabled = process.env.ENABLE_HIANIME === 'true';

    if (id.startsWith('mal_')) {
      // Already a MyAnimeList id — the ideal input for the SUB/DUB anime embeds.
      malId = rawId;
      try {
        const animeDetails = await getAnimeDetails(rawId);
        searchTitle = animeDetails?.title || '';
        altTitle = animeDetails?.originalTitle || '';
        // Map to a TMDB id for the fallback iframe servers.
        if (searchTitle) {
          const tmdbResults = await searchTmdb(searchTitle);
          const tvResult = tmdbResults.find(r => r.type === 'tv' || r.type === 'anime');
          if (tvResult) {
            tmdbId = tvResult.id.replace('tmdb_', '');
          }
        }
      } catch (e) {
        console.error('Failed to map Anime MAL ID to TMDB ID for streaming', e);
      }
    } else {
      // TMDB-based anime — fetch the title so we can resolve a MyAnimeList id
      // for the SUB/DUB anime embeds (and for the optional HiAnime search).
      try {
        const d = await getTmdbDetails('tv', rawId);
        searchTitle = d?.title || '';
        altTitle = (d as any)?.originalTitle || '';
      } catch (e: any) {
        console.error(
          '[anime] TMDB title lookup failed:',
          e?.response?.status || e?.message
        );
      }
      malId = await resolveMalId(searchTitle, altTitle);
    }

    // ── PRIMARY: PureVerse's own servers (megaplay.buzz) — real Japanese audio +
    // English subtitles (SUB) and an English DUB. The provider is branded
    // "PureVerse" in the UI (its VidPlay-1 / HD-1 / Vidstream-2 / VidCloud-1 /
    // Kiwi-Stream menu lives inside this player). Listed FIRST so subbed anime
    // is the default. Best-effort: if it can't be resolved we fall back below.
    try {
      const ak = await getAnikotoEmbeds(searchTitle, altTitle, malId, epNum);
      if (ak?.sub) {
        sources.push({
          server: 'PureVerse · SUB',
          quality: 'Auto',
          url: ak.sub,
          type: 'embed',
          category: 'sub',
        });
      }
      if (ak?.dub) {
        sources.push({
          server: 'PureVerse · DUB',
          quality: 'Auto',
          url: ak.dub,
          type: 'embed',
          category: 'dub',
        });
      }
    } catch {
      /* best-effort — fall back to the embeds below */
    }

    // ── HiAnime direct stream (optional, gated): real SUB + DUB + subtitles ──
    let direct = hiAnimeEnabled && searchTitle
        ? await fetchHiAnimeStream(searchTitle, epNum)
        : null;
    if (hiAnimeEnabled && !direct && altTitle &&
        altTitle.toLowerCase() !== searchTitle.toLowerCase()) {
      direct = await fetchHiAnimeStream(altTitle, epNum);
    }
    if (direct) {
      for (const src of direct.sources) {
        sources.push({
          server: `HiAnime ${src.category.toUpperCase()}`,
          quality: src.quality,
          url: src.url,
          type: 'direct',
          category: src.category,
          headers: direct.headers,
        });
      }
      if (direct.subtitles.length) {
        subtitles = direct.subtitles.map((t) => ({ lang: t.lang, url: t.url }));
      }
    }

    // ── ANIME SUB / DUB embeds (MyAnimeList-based — the real subbed experience) ──
    // VidLink's /anime/ route plays the ORIGINAL JAPANESE audio with English
    // subtitles (SUB) — what most fans want — plus a separate English DUB, each
    // in VidLink's own player with its subtitle selector. SUB is listed FIRST so
    // it's the anime default. Requires a MAL id; when one can't be resolved we
    // fall back to the TMDB embeds below. Episode numbers are absolute within
    // the MAL entry (exact for mal_ ids; season-1 accurate for TMDB ids — use
    // Switch Server for later cours).
    if (malId) {
      sources.push(
        {
          server: 'VidLink · SUB',
          quality: 'Auto',
          url: `https://vidlink.pro/anime/${malId}/${epNum}/sub`,
          type: 'embed',
          category: 'sub',
        },
        {
          server: 'Vidnest · SUB',
          quality: 'Auto',
          url: `https://vidnest.fun/anime/${malId}/${epNum}/sub`,
          type: 'embed',
          category: 'sub',
        },
        {
          server: 'VidLink · DUB',
          quality: 'Auto',
          url: `https://vidlink.pro/anime/${malId}/${epNum}/dub`,
          type: 'embed',
          category: 'dub',
        }
      );
    }

    // ── FALLBACK: TMDB-based embeds (always available; provider-side audio) ──
    // Anime is mapped onto a TMDB TV id. These are multi-audio Switch-Server
    // fallbacks for when the MAL-based SUB/DUB embeds above are unavailable.
    if (tmdbId) {
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
          category: 'multi',
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
