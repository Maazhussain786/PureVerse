import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/models/media_item.dart';
import '../../core/models/watch_history.dart';
import '../auth/auth_controller.dart';
import '../../shared/providers/api_providers.dart';

/// Synced user data — the Flutter counterpart of the web `UserStateContext`.
/// Holds watchlist, favorites, watch history and recent searches, with
/// optimistic mutations that fire-and-forget to the backend.
class UserState {
  final List<MediaItem> watchlist;
  final List<MediaItem> favorites;
  final List<WatchHistoryItem> history;
  final List<String> recentSearches;
  final bool loading;

  const UserState({
    this.watchlist = const [],
    this.favorites = const [],
    this.history = const [],
    this.recentSearches = const [],
    this.loading = false,
  });

  bool get isEmpty => watchlist.isEmpty && favorites.isEmpty;
  bool inWatchlist(String id) => watchlist.any((m) => m.id == id);
  bool inFavorites(String id) => favorites.any((m) => m.id == id);

  /// Newest-first, in-progress (under 95%) — matches web's derivation.
  List<WatchHistoryItem> get continueWatching {
    final list = history.where((h) => h.progress < 95).toList()
      ..sort((a, b) => b.lastWatched.compareTo(a.lastWatched));
    return list.take(20).toList();
  }

  UserState copyWith({
    List<MediaItem>? watchlist,
    List<MediaItem>? favorites,
    List<WatchHistoryItem>? history,
    List<String>? recentSearches,
    bool? loading,
  }) =>
      UserState(
        watchlist: watchlist ?? this.watchlist,
        favorites: favorites ?? this.favorites,
        history: history ?? this.history,
        recentSearches: recentSearches ?? this.recentSearches,
        loading: loading ?? this.loading,
      );
}

class UserStateController extends StateNotifier<UserState> {
  final Ref ref;
  UserStateController(this.ref) : super(const UserState()) {
    _load();
  }

  bool get _signedIn => ref.read(authControllerProvider).isSignedIn;

  Future<void> _load() async {
    if (!_signedIn) {
      state = const UserState();
      return;
    }
    state = state.copyWith(loading: true);
    try {
      final lib = await ref.read(apiClientProvider).getUserState();
      state = UserState(
        watchlist: lib.watchlist,
        favorites: lib.favorites,
        history: lib.history,
        recentSearches: lib.recentSearches,
      );
    } catch (_) {
      state = const UserState();
    }
  }

  /// Re-pull from the server (pull-to-refresh).
  Future<void> reload() => _load();

  // ─── Watchlist ───────────────────────────────────────────
  void addWatchlist(MediaItem m) {
    if (state.inWatchlist(m.id)) return;
    state = state.copyWith(watchlist: [m, ...state.watchlist]);
    if (_signedIn) _fire(() => ref.read(apiClientProvider).addWatchlist(m));
  }

  void removeWatchlist(String id) {
    state = state.copyWith(
        watchlist: state.watchlist.where((m) => m.id != id).toList());
    if (_signedIn) _fire(() => ref.read(apiClientProvider).removeWatchlist(id));
  }

  // ─── Favorites ───────────────────────────────────────────
  void addFavorite(MediaItem m) {
    if (state.inFavorites(m.id)) return;
    state = state.copyWith(favorites: [m, ...state.favorites]);
    if (_signedIn) _fire(() => ref.read(apiClientProvider).addFavorite(m));
  }

  void removeFavorite(String id) {
    state = state.copyWith(
        favorites: state.favorites.where((m) => m.id != id).toList());
    if (_signedIn) _fire(() => ref.read(apiClientProvider).removeFavorite(id));
  }

  // ─── Watch history ───────────────────────────────────────
  void addToHistory(WatchHistoryItem item) {
    final updated = [
      item,
      ...state.history.where((h) => h.key != item.key),
    ].take(200).toList();
    state = state.copyWith(history: updated);
    if (_signedIn) _fire(() => ref.read(apiClientProvider).upsertHistory(item));
  }

  void removeFromHistory(String key) {
    state = state.copyWith(
        history: state.history.where((h) => h.key != key).toList());
    if (_signedIn) _fire(() => ref.read(apiClientProvider).removeHistory(key));
  }

  void clearHistory() {
    state = state.copyWith(history: const []);
    if (_signedIn) _fire(() => ref.read(apiClientProvider).clearHistory());
  }

  // ─── Recent searches ─────────────────────────────────────
  void addRecentSearch(String q) {
    final clean = q.trim();
    if (clean.isEmpty) return;
    final updated = [
      clean,
      ...state.recentSearches
          .where((s) => s.toLowerCase() != clean.toLowerCase()),
    ].take(10).toList();
    state = state.copyWith(recentSearches: updated);
    if (_signedIn) _fire(() => ref.read(apiClientProvider).addRecentSearch(clean));
  }

  void clearRecentSearches() {
    state = state.copyWith(recentSearches: const []);
    if (_signedIn) _fire(() => ref.read(apiClientProvider).clearRecentSearches());
  }

  // Fire-and-forget: optimistic UI never blocks (or fails) on the network.
  void _fire(Future<void> Function() op) {
    op().catchError((_) {});
  }
}

/// Recreated whenever the signed-in user changes so state re-syncs on
/// sign-in / sign-out / account switch.
final userStateProvider =
    StateNotifierProvider<UserStateController, UserState>((ref) {
  ref.watch(authControllerProvider.select((a) => a.user?.id));
  return UserStateController(ref);
});
