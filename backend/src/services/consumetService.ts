import { ANIME } from '@consumet/extensions';
import { createStealthClient } from './stealthClient';

// Inject the stealth client with TLS spoofing and proxy routing
const stealthAxios = createStealthClient();
const hianime = new ANIME.Hianime(undefined, stealthAxios as any);
const animepahe = new ANIME.AnimePahe(undefined, stealthAxios as any);

export async function fetchAnimeStream(title: string, episodeNum: number, type: 'sub' | 'dub') {
  const timeoutMs = 8000;
  const timeoutPromise = new Promise<never>((_, reject) => 
    setTimeout(() => reject(new Error("Scraper Timeout")), timeoutMs)
  );

  try {
    return await Promise.race([
      extractStream(hianime, title, episodeNum, type, "HiAnime Engine (MegaCloud)"),
      timeoutPromise
    ]);
  } catch (err: any) {
    console.error("HiAnime stream extraction failed:", err.message, "Falling back to AnimePahe...");
    
    try {
      return await Promise.race([
        extractStream(animepahe, title, episodeNum, type, "Server Beta (AnimePahe)"),
        timeoutPromise
      ]);
    } catch (fallbackErr: any) {
      console.error("AnimePahe stream extraction failed:", fallbackErr.message);
      throw new Error("Both Primary and Backup Anime Servers failed.");
    }
  }
}

async function extractStream(provider: any, title: string, episodeNum: number, type: 'sub' | 'dub', providerName: string) {
  // 1. Search for the anime
  const searchResults = await provider.search(title);
  if (!searchResults.results || searchResults.results.length === 0) {
    throw new Error(`Anime not found on ${providerName}`);
  }

  // Smart Match: Avoid movies, prioritize exact title matches
  let selectedAnime = searchResults.results[0];
  
  const exactMatch = searchResults.results.find((r: any) => 
    r.title && r.title.toLowerCase() === title.toLowerCase() && String(r.type).toUpperCase() !== 'MOVIE'
  );
  
  if (exactMatch) {
    selectedAnime = exactMatch;
  } else {
    const nonMovieMatch = searchResults.results.find((r: any) => 
      String(r.type).toUpperCase() === 'TV' || String(r.type).toUpperCase() === 'ONA'
    );
    if (nonMovieMatch) {
      selectedAnime = nonMovieMatch;
    } else {
      const partialMatch = searchResults.results.find((r: any) => 
        r.title && r.title.toLowerCase().includes(title.toLowerCase()) && String(r.type).toUpperCase() !== 'MOVIE'
      );
      if (partialMatch) {
        selectedAnime = partialMatch;
      }
    }
  }

  const animeId = selectedAnime.id;

  // 2. Fetch anime info (episodes list)
  const info = await provider.fetchAnimeInfo(animeId);
  
  // 3. Find the matching episode
  const episode = info.episodes?.find((ep: any) => ep.number === episodeNum);
  if (!episode) {
    throw new Error(`Episode ${episodeNum} not found`);
  }

  // 4. Fetch the sources
  let sources;
  if (providerName.includes("HiAnime")) {
    sources = await provider.fetchEpisodeSources(episode.id, undefined, type);
  } else {
    // AnimePahe doesn't always use sub/dub string in fetchEpisodeSources, but we can pass it
    sources = await provider.fetchEpisodeSources(episode.id);
  }

  // 5. Format payload to match the exact schema requested
  const formattedSources = sources.sources?.map((src: any) => ({
    url: src.url,
    quality: src.quality || 'Auto',
    isM3U8: src.isM3U8 !== undefined ? src.isM3U8 : src.url.includes('.m3u8')
  })) || [];

  const formattedSubtitles = (sources.subtitles || []).map((sub: any) => ({
    lang: sub.lang || 'English',
    url: sub.url
  }));

  return {
    status: "success",
    provider: providerName,
    activeFormat: "HLS",
    sources: formattedSources,
    subtitles: formattedSubtitles
  };
}
