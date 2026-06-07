import { StreamPayload } from '../models/media';

/**
 * Generates embed URLs from multiple working providers.
 * The frontend renders these in an iframe.
 * Providers are ordered by reliability and UI/UX quality — best first.
 */
export async function resolveVidSrcStream(
  type: string,
  id: string,
  season?: string,
  episode?: string
): Promise<StreamPayload> {
  const rawId = id.replace('tmdb_', '').replace('mal_', '');
  const sources = [];

  if (type === 'movie') {
    sources.push(
      {
        server: 'VidLink (Best UI)',
        quality: 'Auto',
        url: `https://vidlink.pro/movie/${rawId}`,
        type: 'embed' as const,
      },
      {
        server: 'VidBinge (Ad-Free)',
        quality: 'Auto',
        url: `https://vidbinge.dev/embed/movie/${rawId}`,
        type: 'embed' as const,
      },
      {
        server: 'VidSrc',
        quality: 'Auto',
        url: `https://vidsrc.net/embed/movie?tmdb=${rawId}`,
        type: 'embed' as const,
      },
      {
        server: 'SmashyStream',
        quality: 'Auto',
        url: `https://player.smashy.stream/movie/${rawId}`,
        type: 'embed' as const,
      },
      {
        server: '2Embed',
        quality: 'Auto',
        url: `https://www.2embed.cc/embed/${rawId}`,
        type: 'embed' as const,
      }
    );
  } else if (type === 'tv') {
    const s = season || '1';
    const e = episode || '1';
    sources.push(
      {
        server: 'VidLink (Best UI)',
        quality: 'Auto',
        url: `https://vidlink.pro/tv/${rawId}/${s}/${e}`,
        type: 'embed' as const,
      },
      {
        server: 'VidBinge (Ad-Free)',
        quality: 'Auto',
        url: `https://vidbinge.dev/embed/tv/${rawId}/${s}/${e}`,
        type: 'embed' as const,
      },
      {
        server: 'VidSrc',
        quality: 'Auto',
        url: `https://vidsrc.net/embed/tv?tmdb=${rawId}&season=${s}&episode=${e}`,
        type: 'embed' as const,
      },
      {
        server: 'SmashyStream',
        quality: 'Auto',
        url: `https://player.smashy.stream/tv/${rawId}?s=${s}&e=${e}`,
        type: 'embed' as const,
      },
      {
        server: '2Embed',
        quality: 'Auto',
        url: `https://www.2embed.cc/embedtv/${rawId}&s=${s}&e=${e}`,
        type: 'embed' as const,
      }
    );
  } else if (type === 'anime') {
    // For anime using MAL ID
    sources.push(
      {
        server: 'VidLink (Best UI)',
        quality: 'Auto',
        url: `https://vidlink.pro/tv/${rawId}/1/1`,
        type: 'embed' as const,
      },
      {
        server: 'VidBinge (Ad-Free)',
        quality: 'Auto',
        url: `https://vidbinge.dev/embed/tv/${rawId}/1/1`,
        type: 'embed' as const,
      },
      {
        server: 'VidSrc',
        quality: 'Auto',
        url: `https://vidsrc.net/embed/tv?tmdb=${rawId}&season=1&episode=1`,
        type: 'embed' as const,
      },
      {
        server: 'SmashyStream',
        quality: 'Auto',
        url: `https://player.smashy.stream/tv/${rawId}?s=1&e=1`,
        type: 'embed' as const,
      }
    );
  }

  return {
    sources,
    subtitles: [],
  };
}
