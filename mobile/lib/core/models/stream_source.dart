/// Mirrors `StreamSource` / `StreamPayload` (backend/src/models/media.ts).
class StreamSource {
  final String server;
  final String quality;
  final String url; // embed URL or .m3u8 link
  final String type; // 'embed' | 'direct'
  final String? category; // 'sub' | 'dub' | 'multi'

  const StreamSource({
    required this.server,
    required this.quality,
    required this.url,
    required this.type,
    this.category,
  });

  bool get isEmbed => type == 'embed';

  factory StreamSource.fromJson(Map<String, dynamic> j) => StreamSource(
        server: (j['server'] ?? '').toString(),
        quality: (j['quality'] ?? '').toString(),
        url: (j['url'] ?? '').toString(),
        type: (j['type'] ?? 'embed').toString(),
        category: j['category']?.toString(),
      );
}

class Subtitle {
  final String lang;
  final String url;

  const Subtitle({required this.lang, required this.url});

  factory Subtitle.fromJson(Map<String, dynamic> j) => Subtitle(
        lang: (j['lang'] ?? '').toString(),
        url: (j['url'] ?? '').toString(),
      );
}

class StreamPayload {
  final List<StreamSource> sources;
  final List<Subtitle> subtitles;

  const StreamPayload({required this.sources, required this.subtitles});

  bool get isEmpty => sources.isEmpty;

  factory StreamPayload.fromJson(Map<String, dynamic> j) => StreamPayload(
        sources: (j['sources'] as List?)
                ?.whereType<Map<String, dynamic>>()
                .map(StreamSource.fromJson)
                .toList() ??
            const [],
        subtitles: (j['subtitles'] as List?)
                ?.whereType<Map<String, dynamic>>()
                .map(Subtitle.fromJson)
                .toList() ??
            const [],
      );
}
