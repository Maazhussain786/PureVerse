import 'media_item.dart';

/// Stable identity for a history entry — mirrors the backend/web key:
/// `${id}:${season ?? 0}:${episode ?? 0}`.
String historyKey(String id, int? season, int? episode) =>
    '$id:${season ?? 0}:${episode ?? 0}';

/// One watched (or in-progress) title. Mirrors the backend `WatchHistoryItem`
/// returned by GET /user/state and accepted by POST /user/history.
class WatchHistoryItem {
  final String key;
  final String id;
  final String type; // movie | tv | anime
  final String title;
  final String posterUrl;
  final double rating;
  final int releaseYear;
  final int? season;
  final int? episode;
  final String? episodeTitle;
  final int progress; // 0-100
  final int? positionSec;
  final int? durationSec;
  final int lastWatched; // epoch ms

  const WatchHistoryItem({
    required this.key,
    required this.id,
    required this.type,
    required this.title,
    required this.posterUrl,
    required this.rating,
    required this.releaseYear,
    this.season,
    this.episode,
    this.episodeTitle,
    this.progress = 0,
    this.positionSec,
    this.durationSec,
    required this.lastWatched,
  });

  /// Build a fresh entry (used when the user starts playback). `lastWatched`
  /// and `key` are derived so callers only supply the title metadata.
  factory WatchHistoryItem.create({
    required String id,
    required String type,
    required String title,
    required String posterUrl,
    required double rating,
    required int releaseYear,
    int? season,
    int? episode,
    String? episodeTitle,
    int progress = 0,
    int? positionSec,
    int? durationSec,
  }) =>
      WatchHistoryItem(
        key: historyKey(id, season, episode),
        id: id,
        type: type,
        title: title,
        posterUrl: posterUrl,
        rating: rating,
        releaseYear: releaseYear,
        season: season,
        episode: episode,
        episodeTitle: episodeTitle,
        progress: progress,
        positionSec: positionSec,
        durationSec: durationSec,
        lastWatched: DateTime.now().millisecondsSinceEpoch,
      );

  factory WatchHistoryItem.fromJson(Map<String, dynamic> j) {
    final id = (j['id'] ?? '').toString();
    final season = (j['season'] as num?)?.toInt();
    final episode = (j['episode'] as num?)?.toInt();
    return WatchHistoryItem(
      key: (j['key'] as String?)?.isNotEmpty == true
          ? j['key'] as String
          : historyKey(id, season, episode),
      id: id,
      type: (j['type'] ?? 'movie').toString(),
      title: (j['title'] ?? 'Untitled').toString(),
      posterUrl: (j['posterUrl'] ?? '').toString(),
      rating: (j['rating'] as num?)?.toDouble() ?? 0.0,
      releaseYear: (j['releaseYear'] as num?)?.toInt() ?? 0,
      season: season,
      episode: episode,
      episodeTitle: (j['episodeTitle'] as String?)?.isNotEmpty == true
          ? j['episodeTitle'] as String
          : null,
      progress: (j['progress'] as num?)?.toInt().clamp(0, 100) ?? 0,
      positionSec: (j['positionSec'] as num?)?.toInt(),
      durationSec: (j['durationSec'] as num?)?.toInt(),
      lastWatched: (j['lastWatched'] as num?)?.toInt() ??
          DateTime.now().millisecondsSinceEpoch,
    );
  }

  /// Body shape the backend's POST /user/history expects.
  Map<String, dynamic> toJson() => {
        'id': id,
        'type': type,
        'title': title,
        'posterUrl': posterUrl,
        'rating': rating,
        'releaseYear': releaseYear,
        if (season != null) 'season': season,
        if (episode != null) 'episode': episode,
        if (episodeTitle != null) 'episodeTitle': episodeTitle,
        'progress': progress,
        if (positionSec != null) 'positionSec': positionSec,
        if (durationSec != null) 'durationSec': durationSec,
      };

  /// A [MediaItem] view for navigating to the details screen.
  MediaItem toMediaItem() => MediaItem(
        id: id,
        type: type,
        source: type == 'anime' ? 'mal' : 'tmdb',
        title: title,
        posterUrl: posterUrl,
        bannerUrl: '',
        rating: rating,
        releaseYear: releaseYear,
        genres: const [],
        synopsis: '',
      );

  static List<WatchHistoryItem> listFrom(dynamic data) {
    if (data is! List) return const [];
    return data
        .whereType<Map<String, dynamic>>()
        .map(WatchHistoryItem.fromJson)
        .toList();
  }
}
