import axios from 'axios';
import { UnifiedMediaItem } from '../models/media';

const TMDB_API_KEY = process.env.TMDB_API_KEY || 'demo_key';
const TMDB_BASE_URL = 'https://api.themoviedb.org/3';

export async function fetchTrendingMedia(): Promise<UnifiedMediaItem[]> {
  try {
    // In a full implementation, this uses Promise.all for TMDb and AniList
    const response = await axios.get(`${TMDB_BASE_URL}/trending/all/day?api_key=${TMDB_API_KEY}`);
    
    return response.data.results.map((item: any) => ({
      id: `tmdb_${item.id}`,
      type: item.media_type === 'tv' ? 'tv' : 'movie',
      title: item.title || item.name,
      posterUrl: `https://image.tmdb.org/t/p/w500${item.poster_path}`,
      bannerUrl: `https://image.tmdb.org/t/p/w1280${item.backdrop_path}`,
      rating: item.vote_average,
      releaseYear: parseInt((item.release_date || item.first_air_date || '0000').substring(0, 4)),
      genres: [],
      synopsis: item.overview
    }));
  } catch (error) {
    console.error('TMDB API Key missing or invalid. Returning mock data instead.');
    // Fallback Mock Data so the UI can be tested without a real API Key
    return [
      {
        id: 'tmdb_mock_1',
        type: 'movie',
        title: 'Cyberpunk: Edgerunners (Mock)',
        posterUrl: 'https://image.tmdb.org/t/p/w500/7JWWxiW22i3GDrJcWkP2pS11RXY.jpg',
        bannerUrl: 'https://image.tmdb.org/t/p/w1280/5rZqF0Gq5eB20o2Fm7NntP73JmN.jpg',
        rating: 9.5,
        releaseYear: 2022,
        genres: ['Action', 'Sci-Fi'],
        synopsis: 'A street kid trying to survive in a technology and body modification-obsessed city of the future.'
      },
      {
        id: 'tmdb_mock_2',
        type: 'movie',
        title: 'Interstellar (Mock)',
        posterUrl: 'https://image.tmdb.org/t/p/w500/gEU2QlsUUHXjNpeEYaQ0QzL5I58.jpg',
        bannerUrl: 'https://image.tmdb.org/t/p/w1280/rAiYTfKGqDCRIIqo664sY9XZIvQ.jpg',
        rating: 8.6,
        releaseYear: 2014,
        genres: ['Adventure', 'Sci-Fi'],
        synopsis: 'A team of explorers travel through a wormhole in space in an attempt to ensure humanity\'s survival.'
      },
      {
        id: 'tmdb_mock_3',
        type: 'tv',
        title: 'Arcane (Mock)',
        posterUrl: 'https://image.tmdb.org/t/p/w500/fqldf2t8ztc9aiwn3k6mlX3tvRT.jpg',
        bannerUrl: 'https://image.tmdb.org/t/p/w1280/rkB4LyZHo1NHXFodQlO2CtGQ2xQ.jpg',
        rating: 9.1,
        releaseYear: 2021,
        genres: ['Animation', 'Action'],
        synopsis: 'Set in utopian Piltover and the oppressed underground of Zaun, the story follows the origins of two iconic League champions.'
      },
      {
        id: 'tmdb_mock_4',
        type: 'movie',
        title: 'Dune: Part Two (Mock)',
        posterUrl: 'https://image.tmdb.org/t/p/w500/1pdfLvkbY9ohJlCjQH2JGjjcNsV.jpg',
        bannerUrl: 'https://image.tmdb.org/t/p/w1280/8ZTVqvKDQ8emSGUEMjsS4yHAwrp.jpg',
        rating: 8.8,
        releaseYear: 2024,
        genres: ['Science Fiction', 'Adventure'],
        synopsis: 'Paul Atreides unites with Chani and the Fremen while on a warpath of revenge against the conspirators who destroyed his family.'
      }
    ];
  }
}
