export interface UnifiedMediaItem {
  id: string; // e.g., tmdb_1234 or anilist_5678
  type: 'movie' | 'tv' | 'anime';
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
}

export interface StreamSource {
  server: string;
  quality: string;
  url: string; // .m3u8 link
}

export interface Subtitle {
  lang: string;
  url: string; // .vtt or .srt
}

export interface StreamPayload {
  sources: StreamSource[];
  subtitles: Subtitle[];
}
