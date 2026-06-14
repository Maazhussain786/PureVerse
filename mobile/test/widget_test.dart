// Smoke test: the app builds and mounts its shell without throwing.
//
// The real screens fetch from the backend through Dio, whose connection-timeout
// Timer outlives a bare pump() and trips the test framework's pending-timer
// check. We override the API client with an in-memory fake (and the token
// store, which would otherwise hit the unavailable secure-storage channel) so
// the shell mounts deterministically with no real I/O.
import 'package:flutter_test/flutter_test.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'package:mobile/main.dart';
import 'package:mobile/features/shell/main_shell.dart';
import 'package:mobile/core/models/media_item.dart';
import 'package:mobile/core/models/user_profile.dart';
import 'package:mobile/core/network/api_client.dart';
import 'package:mobile/core/storage/token_store.dart';
import 'package:mobile/shared/providers/api_providers.dart';

/// In-memory token store so the test never touches the platform secure store.
class _FakeTokenStore extends TokenStore {
  @override
  Future<String?> read() async => null;
  @override
  Future<void> write(String token) async {}
  @override
  Future<void> clear() async {}
}

/// API client that resolves every discovery call to an empty list with no Dio.
class _FakeApiClient extends ApiClient {
  @override
  Future<List<MediaItem>> getTrending() async => const [];
  @override
  Future<List<MediaItem>> getTrendingMovies() async => const [];
  @override
  Future<List<MediaItem>> getTrendingSeries() async => const [];
  @override
  Future<List<MediaItem>> getTrendingAnime() async => const [];
  @override
  Future<List<MediaItem>> getPopularAnime() async => const [];
  @override
  Future<List<MediaItem>> getTopRated(String type) async => const [];
  @override
  Future<List<MediaItem>> getNowPlaying() async => const [];
  @override
  Future<List<MediaItem>> getRecommendations(String type, String id) async =>
      const [];
  @override
  Future<List<MediaItem>> listEndpoint(String path) async => const [];
  @override
  Future<List<MediaItem>> discover(String category,
          {int? genre, String sort = 'popular', int page = 1}) async =>
      const [];
  @override
  Future<List<MediaItem>> search(String query) async => const [];
  @override
  Future<UserLibrary> getUserState() async => const UserLibrary();
}

void main() {
  testWidgets('App boots into the navigation shell', (WidgetTester tester) async {
    await tester.pumpWidget(
      ProviderScope(
        overrides: [
          tokenStoreProvider.overrideWithValue(_FakeTokenStore()),
          apiClientProvider.overrideWithValue(_FakeApiClient()),
        ],
        child: const PureVerseApp(),
      ),
    );
    // Let the overridden futures resolve and the loading spinners clear.
    await tester.pumpAndSettle();

    expect(find.byType(PureVerseApp), findsOneWidget);
    expect(find.byType(MainShell), findsOneWidget);
  });
}
