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
}

export interface MediaDetails extends UnifiedMediaItem {
  cast: { name: string; character: string; profileUrl: string }[];
  episodes: UnifiedEpisodeItem[];
  trailerUrl?: string;
  runtime?: number;
  status?: string;
  totalSeasons?: number;
  totalEpisodes?: number;
}

export interface StreamSource {
  server: string;
  quality: string;
  url: string; // embed URL or .m3u8 link
  type: 'embed' | 'direct';
}

export interface Subtitle {
  lang: string;
  url: string; // .vtt or .srt
}

export interface StreamPayload {
  sources: StreamSource[];
  subtitles: Subtitle[];
}
