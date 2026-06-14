/// Mirrors the backend `UnifiedMediaItem` (backend/src/models/media.ts).
class MediaItem {
  final String id; // e.g. tmdb_1234 / mal_5678
  final String type; // 'movie' | 'tv' | 'anime'
  final String source; // 'tmdb' | 'mal'
  final String title;
  final String posterUrl;
  final String bannerUrl;
  final double rating;
  final int releaseYear;
  final List<String> genres;
  final String synopsis;

  const MediaItem({
    required this.id,
    required this.type,
    required this.source,
    required this.title,
    required this.posterUrl,
    required this.bannerUrl,
    required this.rating,
    required this.releaseYear,
    required this.genres,
    required this.synopsis,
  });

  bool get isAnime => type == 'anime';

  factory MediaItem.fromJson(Map<String, dynamic> j) => MediaItem(
        id: (j['id'] ?? '').toString(),
        type: (j['type'] ?? 'movie').toString(),
        source: (j['source'] ?? 'tmdb').toString(),
        title: (j['title'] ?? '').toString(),
        posterUrl: (j['posterUrl'] ?? '').toString(),
        bannerUrl: (j['bannerUrl'] ?? '').toString(),
        rating: (j['rating'] as num?)?.toDouble() ?? 0.0,
        releaseYear: (j['releaseYear'] as num?)?.toInt() ?? 0,
        genres: (j['genres'] as List?)
                ?.map((e) => e.toString())
                .where((e) => e.isNotEmpty)
                .toList() ??
            const [],
        synopsis: (j['synopsis'] ?? '').toString(),
      );

  /// Body shape the backend's watchlist/favorites endpoints expect (ListItem).
  Map<String, dynamic> toListItemJson() => {
        'id': id,
        'type': type,
        'title': title,
        'posterUrl': posterUrl,
        'rating': rating,
        'releaseYear': releaseYear,
      };

  static List<MediaItem> listFrom(dynamic data) {
    if (data is! List) return const [];
    return data
        .whereType<Map<String, dynamic>>()
        .map(MediaItem.fromJson)
        .toList();
  }
}
