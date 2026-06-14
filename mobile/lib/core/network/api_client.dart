import 'package:dio/dio.dart';

import '../config/app_config.dart';
import '../models/media_item.dart';
import '../models/media_details.dart';
import '../models/stream_source.dart';

/// Friendly error surfaced to the UI instead of a raw DioException.
class ApiException implements Exception {
  final String message;
  final int? statusCode;
  ApiException(this.message, {this.statusCode});
  @override
  String toString() => message;
}

/// Thin REST client over the PureVerse backend. Base URL comes from
/// [AppConfig.apiBaseUrl] so the same build can target dev or DigitalOcean.
class ApiClient {
  final Dio _dio;

  ApiClient({Dio? dio})
      : _dio = dio ??
            Dio(BaseOptions(
              baseUrl: AppConfig.apiBaseUrl,
              connectTimeout: const Duration(seconds: 15),
              receiveTimeout: const Duration(seconds: 20),
            ));

  // ─── Discovery ──────────────────────────────────────────
  Future<List<MediaItem>> getTrending() => _list('/trending');
  Future<List<MediaItem>> getTrendingMovies() => _list('/trending/movies');
  Future<List<MediaItem>> getTrendingSeries() => _list('/trending/series');
  Future<List<MediaItem>> getTrendingAnime() => _list('/trending/anime');
  Future<List<MediaItem>> getPopularAnime() => _list('/popular/anime');

  // ─── Search ─────────────────────────────────────────────
  Future<List<MediaItem>> search(String query) =>
      _list('/search', query: {'q': query});

  // ─── Details & stream ───────────────────────────────────
  Future<MediaDetails> getDetails(String type, String id) async {
    final data = await _get('/media/details/$type/$id');
    return MediaDetails.fromJson(_asMap(data));
  }

  Future<StreamPayload> getStream(
    String type,
    String id, {
    int? season,
    int? episode,
  }) async {
    final query = <String, dynamic>{};
    if (season != null) query['season'] = season;
    if (episode != null) query['episode'] = episode;
    final data = await _get('/media/stream/$type/$id', query: query);
    return StreamPayload.fromJson(_asMap(data));
  }

  Future<List<Episode>> getSeasonEpisodes(String tvId, int season) async {
    final data = await _get('/tv/$tvId/season/$season');
    if (data is! List) return const [];
    return data
        .whereType<Map<String, dynamic>>()
        .map(Episode.fromJson)
        .toList();
  }

  // ─── Internals ──────────────────────────────────────────
  Future<List<MediaItem>> _list(String path,
      {Map<String, dynamic>? query}) async {
    final data = await _get(path, query: query);
    return MediaItem.listFrom(data);
  }

  Future<dynamic> _get(String path, {Map<String, dynamic>? query}) async {
    try {
      final res = await _dio.get(path, queryParameters: query);
      final body = res.data;
      if (body is Map && body['success'] == false) {
        throw ApiException(
          (body['message'] ?? 'Request failed').toString(),
          statusCode: res.statusCode,
        );
      }
      return (body is Map && body.containsKey('data')) ? body['data'] : body;
    } on DioException catch (e) {
      throw ApiException(_friendly(e), statusCode: e.response?.statusCode);
    }
  }

  Map<String, dynamic> _asMap(dynamic data) =>
      data is Map<String, dynamic> ? data : <String, dynamic>{};

  String _friendly(DioException e) {
    switch (e.type) {
      case DioExceptionType.connectionTimeout:
      case DioExceptionType.receiveTimeout:
      case DioExceptionType.sendTimeout:
        return 'The server took too long to respond.';
      case DioExceptionType.connectionError:
        return 'Cannot reach the server. Check your connection.';
      default:
        final code = e.response?.statusCode;
        return code != null
            ? 'Server error ($code).'
            : 'Something went wrong. Please try again.';
    }
  }
}
