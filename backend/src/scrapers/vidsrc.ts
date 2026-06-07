import { StreamPayload } from '../models/media';

/**
 * Generates embed URLs from multiple working providers.
 * The frontend renders these in an iframe.
 * Providers are ordered by reliability — most reliable first.
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
        server: 'VidSrc Pro',
        quality: 'Auto',
        url: `https://vidsrc.pro/embed/movie/${rawId}`,
        type: 'embed' as const,
      },
      {
        server: 'VidSrc CC',
        quality: 'Auto',
        url: `https://vidsrc.cc/v2/embed/movie/${rawId}`,
        type: 'embed' as const,
      },
      {
        server: 'SuperEmbed',
        quality: 'Auto',
        url: `https://multiembed.mov/?video_id=${rawId}&tmdb=1`,
        type: 'embed' as const,
      },
      {
        server: 'AutoEmbed',
        quality: 'Auto',
        url: `https://autoembed.cc/embed/movie/${rawId}`,
        type: 'embed' as const,
      },
      {
        server: 'NontonGo',
        quality: 'Auto',
        url: `https://www.nontongo.win/embed/movie/${rawId}`,
        type: 'embed' as const,
      }
    );
  } else if (type === 'tv') {
    const s = season || '1';
    const e = episode || '1';
    sources.push(
      {
        server: 'VidSrc Pro',
        quality: 'Auto',
        url: `https://vidsrc.pro/embed/tv/${rawId}/${s}/${e}`,
        type: 'embed' as const,
      },
      {
        server: 'VidSrc CC',
        quality: 'Auto',
        url: `https://vidsrc.cc/v2/embed/tv/${rawId}/${s}/${e}`,
        type: 'embed' as const,
      },
      {
        server: 'SuperEmbed',
        quality: 'Auto',
        url: `https://multiembed.mov/?video_id=${rawId}&tmdb=1&s=${s}&e=${e}`,
        type: 'embed' as const,
      },
      {
        server: 'AutoEmbed',
        quality: 'Auto',
        url: `https://autoembed.cc/embed/tv/${rawId}/${s}/${e}`,
        type: 'embed' as const,
      },
      {
        server: 'NontonGo',
        quality: 'Auto',
        url: `https://www.nontongo.win/embed/tv/${rawId}/${s}/${e}`,
        type: 'embed' as const,
      }
    );
  } else if (type === 'anime') {
    sources.push(
      {
        server: 'VidSrc Pro',
        quality: 'Auto',
        url: `https://vidsrc.pro/embed/tv/${rawId}`,
        type: 'embed' as const,
      },
      {
        server: 'SuperEmbed',
        quality: 'Auto',
        url: `https://multiembed.mov/?video_id=${rawId}&tmdb=1`,
        type: 'embed' as const,
      },
      {
        server: 'AutoEmbed',
        quality: 'Auto',
        url: `https://autoembed.cc/embed/tv/${rawId}`,
        type: 'embed' as const,
      }
    );
  }

  return {
    sources,
    subtitles: [],
  };
}
