import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/network/api_client.dart';
import '../../core/models/media_item.dart';
import '../../core/models/media_details.dart';

/// Single shared API client.
final apiClientProvider = Provider<ApiClient>((ref) => ApiClient());

// ─── Home rails ───────────────────────────────────────────
final trendingProvider = FutureProvider<List<MediaItem>>(
    (ref) => ref.read(apiClientProvider).getTrending());

final trendingMoviesProvider = FutureProvider<List<MediaItem>>(
    (ref) => ref.read(apiClientProvider).getTrendingMovies());

final trendingSeriesProvider = FutureProvider<List<MediaItem>>(
    (ref) => ref.read(apiClientProvider).getTrendingSeries());

final trendingAnimeProvider = FutureProvider<List<MediaItem>>(
    (ref) => ref.read(apiClientProvider).getTrendingAnime());

// ─── Details (keyed by "type/id") ─────────────────────────
final mediaDetailsProvider =
    FutureProvider.family<MediaDetails, String>((ref, key) {
  final i = key.indexOf('/');
  final type = key.substring(0, i);
  final id = key.substring(i + 1);
  return ref.read(apiClientProvider).getDetails(type, id);
});

// ─── Search ───────────────────────────────────────────────
final searchQueryProvider = StateProvider<String>((ref) => '');

final searchResultsProvider = FutureProvider<List<MediaItem>>((ref) async {
  final q = ref.watch(searchQueryProvider).trim();
  if (q.length < 2) return const [];
  return ref.read(apiClientProvider).search(q);
});
