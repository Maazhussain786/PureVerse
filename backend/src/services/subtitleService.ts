import axios from 'axios';
import zlib from 'zlib';
import NodeCache from 'node-cache';
import { getImdbId } from './metadataService';

/**
 * Keyless subtitle lookup via the legacy OpenSubtitles REST API, used to give
 * movies / TV English (+ other) subtitles in the native player. Results are
 * proxied + converted to WebVTT by [fetchVtt] so the player can load them
 * directly. Best-effort: any failure returns an empty list.
 */
const OS_BASE = 'https://rest.opensubtitles.org/search';
const cache = new NodeCache({ stdTTL: 3600, checkperiod: 600 });

const os = axios.create({
  timeout: 8000,
  maxRedirects: 3,
  // OpenSubtitles requires a non-default User-Agent.
  headers: { 'User-Agent': 'TemporaryUserAgent' },
});

export interface SubCandidate {
  lang: string;
  downloadLink: string;
}

/** One best subtitle per language (English first), keyed by tmdb id. */
export async function fetchSubtitleCandidates(
  type: 'movie' | 'tv',
  tmdbId: string,
  season?: number,
  episode?: number
): Promise<SubCandidate[]> {
  const imdb = await getImdbId(type, tmdbId);
  if (!imdb) return [];
  const digits = imdb.replace(/\D/g, '');
  if (!digits) return [];

  const key = `os_${type}_${digits}_${season || 0}_${episode || 0}`;
  const cached = cache.get<SubCandidate[]>(key);
  if (cached) return cached;

  const path =
    type === 'tv' && season && episode
      ? `/episode-${episode}/imdbid-${digits}/season-${season}`
      : `/imdbid-${digits}`;

  try {
    const res = await os.get(`${OS_BASE}${path}`);
    const list: any[] = Array.isArray(res.data) ? res.data : [];

    // Keep the most-downloaded SRT per language.
    const byLang = new Map<string, { link: string; count: number }>();
    for (const s of list) {
      if (s.SubFormat !== 'srt' || !s.SubDownloadLink) continue;
      const lang = (s.LanguageName as string) || 'Unknown';
      const count = parseInt(s.SubDownloadsCnt || '0', 10) || 0;
      const cur = byLang.get(lang);
      if (!cur || count > cur.count) {
        byLang.set(lang, { link: s.SubDownloadLink, count });
      }
    }

    const out: SubCandidate[] = [...byLang.entries()]
      .map(([lang, v]) => ({ lang, downloadLink: v.link }))
      .sort(
        (a, b) =>
          (b.lang === 'English' ? 1 : 0) - (a.lang === 'English' ? 1 : 0) ||
          a.lang.localeCompare(b.lang)
      )
      .slice(0, 12);

    cache.set(key, out);
    return out;
  } catch {
    return [];
  }
}

/** Download a subtitle (.gz), gunzip and convert SRT → WebVTT. Cached. */
export async function fetchVtt(downloadLink: string): Promise<string | null> {
  const key = `vtt_${downloadLink}`;
  const cached = cache.get<string>(key);
  if (cached) return cached;
  try {
    const res = await os.get(downloadLink, { responseType: 'arraybuffer' });
    const buf = Buffer.from(res.data);
    let text: string;
    try {
      text = zlib.gunzipSync(buf).toString('utf8');
    } catch {
      text = buf.toString('utf8'); // already plain
    }
    const vtt = srtToVtt(text);
    cache.set(key, vtt, 86400);
    return vtt;
  } catch {
    return null;
  }
}

function srtToVtt(srt: string): string {
  const body = srt
    .replace(/﻿/g, '')
    .replace(/\r+/g, '')
    // 00:00:06,000 --> 00:00:12,074  →  use a dot for the millisecond sep
    .replace(/(\d{2}:\d{2}:\d{2}),(\d{3})/g, '$1.$2');
  return `WEBVTT\n\n${body}`;
}

/** Only proxy OpenSubtitles links (prevents the proxy being an open relay). */
export function isAllowedSubLink(url: string): boolean {
  try {
    return new URL(url).hostname.endsWith('opensubtitles.org');
  } catch {
    return false;
  }
}
