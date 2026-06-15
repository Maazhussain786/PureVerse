export interface UnifiedMediaItem {
  id: string; // e.g., tmdb_1234 or mal_5678
  type: 'movie' | 'tv' | 'anime';
  source: 'tmdb' | 'mal';
  title: string;
  posterUrl: string;
  bannerUrl: string;
  rating: number;
  releaseYear: number;
  genres: string[];
  synopsis: string;
}

export interface UnifiedEpisodeItem {
  id: string;
  seasonNumber?: number;
  episodeNumber: number;
  title: string;
  thumbnailUrl: string;
  airDate: string;
  synopsis: string;
  runtime?: number; // minutes
}

export interface MediaDetails extends UnifiedMediaItem {
  cast: { name: string; character: string; profileUrl: string }[];
  episodes: UnifiedEpisodeItem[];
  trailerUrl?: string;
  runtime?: number;
  status?: string;
  totalSeasons?: number;
  totalEpisodes?: number;
  // Extended metadata for the premium details page
  originalTitle?: string;
  tagline?: string;
  voteCount?: number;
  popularity?: number;
  language?: string;        // human-readable, e.g. "Japanese"
  studios?: string[];       // production companies / studios
  ageRating?: string;       // certification, e.g. "TV-MA" / "PG-13"
  releaseDate?: string;     // full ISO date
}

export interface StreamSource {
  server: string;
  quality: string;
  url: string; // embed URL or .m3u8 link
  type: 'embed' | 'direct';
  // Audio category for grouped server pickers (anime SUB/DUB sections).
  // 'multi' = provider has in-player audio switching.
  category?: 'sub' | 'dub' | 'multi';
  // HTTP headers a direct (.m3u8) source needs (Referer/Origin/User-Agent).
  // Only set for `type: 'direct'` streams scraped server-side.
  headers?: Record<string, string>;
}

export interface Subtitle {
  lang: string;
  url: string; // .vtt or .srt
}

export interface StreamPayload {
  sources: StreamSource[];
  subtitles: Subtitle[];
}
