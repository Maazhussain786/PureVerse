import 'media_item.dart';
import 'watch_history.dart';

class UserPreferences {
  final bool autoplayNext;
  final String preferredAudio; // 'sub' | 'dub'
  final bool notifyNewEpisodes;
  final bool notifyPartyInvites;
  final bool notifyAnnouncements;

  const UserPreferences({
    this.autoplayNext = true,
    this.preferredAudio = 'sub',
    this.notifyNewEpisodes = true,
    this.notifyPartyInvites = true,
    this.notifyAnnouncements = true,
  });

  factory UserPreferences.fromJson(Map<String, dynamic>? j) {
    j ??= const {};
    return UserPreferences(
      autoplayNext: j['autoplayNext'] != false,
      preferredAudio: j['preferredAudio'] == 'dub' ? 'dub' : 'sub',
      notifyNewEpisodes: j['notifyNewEpisodes'] != false,
      notifyPartyInvites: j['notifyPartyInvites'] != false,
      notifyAnnouncements: j['notifyAnnouncements'] != false,
    );
  }
}

class UserCounts {
  final int watchlist;
  final int favorites;
  final int history;
  const UserCounts({this.watchlist = 0, this.favorites = 0, this.history = 0});

  factory UserCounts.fromJson(Map<String, dynamic>? j) {
    j ??= const {};
    return UserCounts(
      watchlist: (j['watchlist'] as num?)?.toInt() ?? 0,
      favorites: (j['favorites'] as num?)?.toInt() ?? 0,
      history: (j['history'] as num?)?.toInt() ?? 0,
    );
  }
}

/// Mirrors the backend `toPublicUser` shape.
class UserProfile {
  final String id;
  final String email;
  final String name;
  final String avatar;
  final bool isGuest;
  final int createdAt;
  final UserPreferences preferences;
  final UserCounts counts;

  const UserProfile({
    required this.id,
    required this.email,
    required this.name,
    required this.avatar,
    required this.isGuest,
    required this.createdAt,
    required this.preferences,
    required this.counts,
  });

  factory UserProfile.fromJson(Map<String, dynamic> j) => UserProfile(
        id: (j['id'] ?? '').toString(),
        email: (j['email'] ?? '').toString(),
        name: (j['name'] ?? '').toString(),
        avatar: (j['avatar'] ?? '').toString(),
        isGuest: j['isGuest'] == true,
        createdAt: (j['createdAt'] as num?)?.toInt() ?? 0,
        preferences:
            UserPreferences.fromJson(j['preferences'] as Map<String, dynamic>?),
        counts: UserCounts.fromJson(j['counts'] as Map<String, dynamic>?),
      );
}

/// Result of a sign-in: bearer token + the authenticated user.
class AuthSession {
  final String token;
  final UserProfile user;
  const AuthSession({required this.token, required this.user});

  factory AuthSession.fromJson(Map<String, dynamic> j) => AuthSession(
        token: (j['token'] ?? '').toString(),
        user: UserProfile.fromJson(
            (j['user'] as Map<String, dynamic>?) ?? const {}),
      );
}

/// Synced watchlist + favorites + history + recent searches (GET /user/state).
class UserLibrary {
  final List<MediaItem> watchlist;
  final List<MediaItem> favorites;
  final List<WatchHistoryItem> history;
  final List<String> recentSearches;
  const UserLibrary({
    this.watchlist = const [],
    this.favorites = const [],
    this.history = const [],
    this.recentSearches = const [],
  });

  bool get isEmpty => watchlist.isEmpty && favorites.isEmpty;

  bool inWatchlist(String id) => watchlist.any((m) => m.id == id);
  bool inFavorites(String id) => favorites.any((m) => m.id == id);

  factory UserLibrary.fromState(Map<String, dynamic> j) => UserLibrary(
        watchlist: MediaItem.listFrom(j['watchlist']),
        favorites: MediaItem.listFrom(j['favorites']),
        history: WatchHistoryItem.listFrom(j['history']),
        recentSearches: (j['recentSearches'] as List?)
                ?.map((e) => e.toString())
                .where((e) => e.isNotEmpty)
                .toList() ??
            const [],
      );
}
