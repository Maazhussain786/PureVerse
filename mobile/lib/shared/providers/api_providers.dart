import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/network/api_client.dart';
import '../../core/storage/token_store.dart';
import '../../core/models/media_item.dart';
import '../../core/models/media_details.dart';

/// Secure store for the session token.
final tokenStoreProvider = Provider<TokenStore>((ref) => TokenStore());

/// Single shared API client (auto-attaches the stored bearer token).
final apiClientProvider = Provider<ApiClient>(
    (ref) => ApiClient(tokenStore: ref.read(tokenStoreProvider)));

// ─── Home rails ───────────────────────────────────────────
final trendingProvider = FutureProvider<List<MediaItem>>(
    (ref) => ref.read(apiClientProvider).getTrending());

final trendingMoviesProvider = FutureProvider<List<MediaItem>>(
    (ref) => ref.read(apiClientProvider).getTrendingMovies());

final trendingSeriesProvider = FutureProvider<List<MediaItem>>(
    (ref) => ref.read(apiClientProvider).getTrendingSeries());

final trendingAnimeProvider = FutureProvider<List<MediaItem>>(
    (ref) => ref.read(apiClientProvider).getTrendingAnime());

final popularAnimeProvider = FutureProvider<List<MediaItem>>(
    (ref) => ref.read(apiClientProvider).getPopularAnime());

final topRatedMoviesProvider = FutureProvider<List<MediaItem>>(
    (ref) => ref.read(apiClientProvider).getTopRated('movies'));

final topRatedSeriesProvider = FutureProvider<List<MediaItem>>(
    (ref) => ref.read(apiClientProvider).getTopRated('series'));

final nowPlayingProvider = FutureProvider<List<MediaItem>>(
    (ref) => ref.read(apiClientProvider).getNowPlaying());

/// Any discovery endpoint by raw path (browse genre rails / category rows).
final endpointListProvider =
    FutureProvider.family<List<MediaItem>, String>((ref, path) {
  return ref.read(apiClientProvider).listEndpoint(path);
});

/// Per-title recommendations, keyed by "type/id".
final recommendationsProvider =
    FutureProvider.family<List<MediaItem>, String>((ref, key) {
  final i = key.indexOf('/');
  final type = key.substring(0, i);
  final id = key.substring(i + 1);
  return ref.read(apiClientProvider).getRecommendations(type, id);
});

// ─── Details (keyed by "type/id") ─────────────────────────
final mediaDetailsProvider =
    FutureProvider.family<MediaDetails, String>((ref, key) {
  final i = key.indexOf('/');
  final type = key.substring(0, i);
  final id = key.substring(i + 1);
  return ref.read(apiClientProvider).getDetails(type, id);
});

/// Episodes for one season, keyed by "id:season" (id may carry a tmdb_/mal_
/// prefix — it's stripped before hitting `/tv/:id/season/:n`).
final seasonEpisodesProvider =
    FutureProvider.family<List<Episode>, String>((ref, key) {
  final i = key.lastIndexOf(':');
  final rawId =
      key.substring(0, i).replaceFirst('tmdb_', '').replaceFirst('mal_', '');
  final season = int.tryParse(key.substring(i + 1)) ?? 1;
  return ref.read(apiClientProvider).getSeasonEpisodes(rawId, season);
});

// ─── Search ───────────────────────────────────────────────
final searchQueryProvider = StateProvider<String>((ref) => '');

final searchResultsProvider = FutureProvider<List<MediaItem>>((ref) async {
  final q = ref.watch(searchQueryProvider).trim();
  if (q.length < 2) return const [];
  return ref.read(apiClientProvider).search(q);
});
