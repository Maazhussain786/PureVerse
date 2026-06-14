import 'media_item.dart';

/// Mirrors `UnifiedEpisodeItem` (backend/src/models/media.ts).
class Episode {
  final String id;
  final int? seasonNumber;
  final int episodeNumber;
  final String title;
  final String thumbnailUrl;
  final String airDate;
  final String synopsis;
  final int? runtime;

  const Episode({
    required this.id,
    required this.seasonNumber,
    required this.episodeNumber,
    required this.title,
    required this.thumbnailUrl,
    required this.airDate,
    required this.synopsis,
    required this.runtime,
  });

  factory Episode.fromJson(Map<String, dynamic> j) => Episode(
        id: (j['id'] ?? '').toString(),
        seasonNumber: (j['seasonNumber'] as num?)?.toInt(),
        episodeNumber: (j['episodeNumber'] as num?)?.toInt() ?? 0,
        title: (j['title'] ?? '').toString(),
        thumbnailUrl: (j['thumbnailUrl'] ?? '').toString(),
        airDate: (j['airDate'] ?? '').toString(),
        synopsis: (j['synopsis'] ?? '').toString(),
        runtime: (j['runtime'] as num?)?.toInt(),
      );
}

class CastMember {
  final String name;
  final String character;
  final String profileUrl;

  const CastMember({
    required this.name,
    required this.character,
    required this.profileUrl,
  });

  factory CastMember.fromJson(Map<String, dynamic> j) => CastMember(
        name: (j['name'] ?? '').toString(),
        character: (j['character'] ?? '').toString(),
        profileUrl: (j['profileUrl'] ?? '').toString(),
      );
}

/// Mirrors `MediaDetails` (extends UnifiedMediaItem).
class MediaDetails {
  final MediaItem base;
  final List<Episode> episodes;
  final List<CastMember> cast;
  final String? trailerUrl;
  final int? runtime;
  final String? status;
  final int? totalSeasons;
  final int? totalEpisodes;
  final String? originalTitle;
  final String? tagline;
  final String? language;
  final List<String> studios;
  final String? ageRating;
  final String? releaseDate;

  const MediaDetails({
    required this.base,
    required this.episodes,
    required this.cast,
    this.trailerUrl,
    this.runtime,
    this.status,
    this.totalSeasons,
    this.totalEpisodes,
    this.originalTitle,
    this.tagline,
    this.language,
    this.studios = const [],
    this.ageRating,
    this.releaseDate,
  });

  // Convenience pass-throughs
  String get id => base.id;
  String get type => base.type;
  String get title => base.title;
  String get posterUrl => base.posterUrl;
  String get bannerUrl => base.bannerUrl;
  String get synopsis => base.synopsis;
  double get rating => base.rating;
  int get releaseYear => base.releaseYear;
  List<String> get genres => base.genres;

  factory MediaDetails.fromJson(Map<String, dynamic> j) => MediaDetails(
        base: MediaItem.fromJson(j),
        episodes: (j['episodes'] as List?)
                ?.whereType<Map<String, dynamic>>()
                .map(Episode.fromJson)
                .toList() ??
            const [],
        cast: (j['cast'] as List?)
                ?.whereType<Map<String, dynamic>>()
                .map(CastMember.fromJson)
                .toList() ??
            const [],
        trailerUrl: j['trailerUrl']?.toString(),
        runtime: (j['runtime'] as num?)?.toInt(),
        status: j['status']?.toString(),
        totalSeasons: (j['totalSeasons'] as num?)?.toInt(),
        totalEpisodes: (j['totalEpisodes'] as num?)?.toInt(),
        originalTitle: j['originalTitle']?.toString(),
        tagline: j['tagline']?.toString(),
        language: j['language']?.toString(),
        studios: (j['studios'] as List?)
                ?.map((e) => e.toString())
                .where((e) => e.isNotEmpty)
                .toList() ??
            const [],
        ageRating: j['ageRating']?.toString(),
        releaseDate: j['releaseDate']?.toString(),
      );
}
