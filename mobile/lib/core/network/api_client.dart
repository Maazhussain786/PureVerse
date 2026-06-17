import 'package:dio/dio.dart';

import '../config/app_config.dart';
import '../storage/token_store.dart';
import '../models/media_item.dart';
import '../models/media_details.dart';
import '../models/stream_source.dart';
import '../models/user_profile.dart';
import '../models/watch_history.dart';

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
/// A request interceptor attaches the stored bearer token automatically.
class ApiClient {
  final Dio _dio;
  final TokenStore _tokenStore;

  ApiClient({Dio? dio, TokenStore? tokenStore})
      : _tokenStore = tokenStore ?? TokenStore(),
        _dio = dio ??
            Dio(BaseOptions(
              baseUrl: AppConfig.apiBaseUrl,
              connectTimeout: const Duration(seconds: 15),
              receiveTimeout: const Duration(seconds: 20),
            )) {
    _dio.interceptors.add(InterceptorsWrapper(
      onRequest: (options, handler) async {
        final token = await _tokenStore.read();
        if (token != null && token.isNotEmpty) {
          options.headers['Authorization'] = 'Bearer $token';
        }
        handler.next(options);
      },
    ));
  }

  // ─── Discovery ──────────────────────────────────────────
  Future<List<MediaItem>> getTrending() => _list('/trending');
  Future<List<MediaItem>> getTrendingMovies() => _list('/trending/movies');
  Future<List<MediaItem>> getTrendingSeries() => _list('/trending/series');
  Future<List<MediaItem>> getTrendingAnime() => _list('/trending/anime');
  Future<List<MediaItem>> getPopularAnime() => _list('/popular/anime');
  Future<List<MediaItem>> getTopRated(String type) => _list('/top-rated/$type');
  Future<List<MediaItem>> getNowPlaying() => _list('/now-playing');
  Future<List<MediaItem>> getRecommendations(String type, String id) =>
      _list('/media/recommendations/$type/$id');

  /// Fetch any discovery endpoint by raw path (used by genre rails).
  Future<List<MediaItem>> listEndpoint(String path) => _list(path);

  /// Catalogue discovery — genre / sort / pagination (browse grid).
  Future<List<MediaItem>> discover(
    String category, {
    int? genre,
    String sort = 'popular',
    int page = 1,
  }) {
    final query = <String, dynamic>{'sort': sort, 'page': page};
    if (genre != null) query['genre'] = genre;
    return _list('/discover/$category', query: query);
  }

  Future<List<MediaItem>> search(String query) =>
      _list('/search', query: {'q': query});

  // ─── Details & stream ───────────────────────────────────
  Future<MediaDetails> getDetails(String type, String id) async {
    final data = await _get('/media/details/$type/$id');
    return MediaDetails.fromJson(_asMap(data));
  }

  Future<StreamPayload> getStream(String type, String id,
      {int? season, int? episode}) async {
    final query = <String, dynamic>{};
    if (season != null) query['season'] = season;
    if (episode != null) query['episode'] = episode;
    final data = await _get('/media/stream/$type/$id', query: query);
    return StreamPayload.fromJson(_asMap(data));
  }

  /// External subtitle tracks for movies / TV (OpenSubtitles, proxied as VTT).
  Future<List<Subtitle>> getSubtitles(String type, String id,
      {int? season, int? episode}) async {
    final query = <String, dynamic>{};
    if (season != null) query['season'] = season;
    if (episode != null) query['episode'] = episode;
    final data = await _get('/subtitles/$type/$id', query: query);
    if (data is! List) return const [];
    return data
        .whereType<Map<String, dynamic>>()
        .map(Subtitle.fromJson)
        .toList();
  }

  Future<List<Episode>> getSeasonEpisodes(String tvId, int season) async {
    final data = await _get('/tv/$tvId/season/$season');
    if (data is! List) return const [];
    return data
        .whereType<Map<String, dynamic>>()
        .map(Episode.fromJson)
        .toList();
  }

  // ─── Auth ───────────────────────────────────────────────
  Future<AuthSession> signInGuest(String name) async {
    final data = await _post('/auth/guest', {'name': name});
    return AuthSession.fromJson(_asMap(data));
  }

  Future<AuthSession> signInGoogle(String idToken) async {
    final data = await _post('/auth/google', {'credential': idToken});
    return AuthSession.fromJson(_asMap(data));
  }

  Future<UserProfile> getSession() async {
    final data = await _get('/auth/session');
    return UserProfile.fromJson(_asMap(data)['user'] as Map<String, dynamic>? ??
        _asMap(data));
  }

  Future<void> logout() async {
    await _post('/auth/logout', null);
  }

  Future<UserProfile> updateProfile(Map<String, dynamic> patch) async {
    final data = await _patch('/user/me', patch);
    return UserProfile.fromJson(_asMap(data)['user'] as Map<String, dynamic>? ??
        _asMap(data));
  }

  // ─── Synced user state ──────────────────────────────────
  Future<UserLibrary> getUserState() async {
    final data = await _get('/user/state');
    return UserLibrary.fromState(_asMap(data));
  }

  Future<void> addWatchlist(MediaItem m) =>
      _post('/user/watchlist', m.toListItemJson());
  Future<void> removeWatchlist(String id) => _delete('/user/watchlist/$id');
  Future<void> addFavorite(MediaItem m) =>
      _post('/user/favorites', m.toListItemJson());
  Future<void> removeFavorite(String id) => _delete('/user/favorites/$id');

  // ─── Watch history ──────────────────────────────────────
  Future<void> upsertHistory(WatchHistoryItem item) =>
      _post('/user/history', item.toJson());
  Future<void> removeHistory(String key) =>
      _delete('/user/history/${Uri.encodeComponent(key)}');
  Future<void> clearHistory() => _delete('/user/history');

  // ─── Recent searches ────────────────────────────────────
  Future<void> addRecentSearch(String q) =>
      _post('/user/searches', {'q': q});
  Future<void> clearRecentSearches() => _delete('/user/searches');

  /// WebRTC ICE servers for party voice (STUN + any server-configured TURN).
  /// Lets TURN be added on the backend without rebuilding the app.
  Future<List<Map<String, dynamic>>> getIceServers() async {
    final data = await _get('/rtc/ice');
    final list = data is Map ? data['iceServers'] : null;
    if (list is! List) return const [];
    return list
        .whereType<Map>()
        .map((e) => e.cast<String, dynamic>())
        .toList();
  }

  // ─── Watch party (REST; live state flows over Socket.IO) ─
  /// Public room browser (GET /party/rooms). Returns raw summaries; the party
  /// layer maps them to PublicRoom so core stays decoupled from feature models.
  Future<List<Map<String, dynamic>>> listPartyRooms() async {
    final data = await _get('/party/rooms');
    if (data is! List) return const [];
    return data.whereType<Map<String, dynamic>>().toList();
  }

  /// Meta for the join gate (GET /party/rooms/:code), or null if it's gone.
  Future<Map<String, dynamic>?> getPartyRoomMeta(String code) async {
    try {
      final data = await _get('/party/rooms/$code');
      return data is Map<String, dynamic> ? data : null;
    } on ApiException {
      return null;
    }
  }

  /// Notify another PureVerse user with a room invite (POST /party/invite).
  Future<void> invitePartyUser(String to, String roomCode) =>
      _post('/party/invite', {'to': to, 'roomCode': roomCode});

  // ─── Internals ──────────────────────────────────────────
  Future<List<MediaItem>> _list(String path,
      {Map<String, dynamic>? query}) async {
    final data = await _get(path, query: query);
    return MediaItem.listFrom(data);
  }

  Future<dynamic> _get(String path, {Map<String, dynamic>? query}) =>
      _send('GET', path, query: query);
  Future<dynamic> _post(String path, Object? body) =>
      _send('POST', path, body: body);
  Future<dynamic> _patch(String path, Object? body) =>
      _send('PATCH', path, body: body);
  Future<dynamic> _delete(String path) => _send('DELETE', path);

  Future<dynamic> _send(String method, String path,
      {Object? body, Map<String, dynamic>? query}) async {
    try {
      final res = await _dio.request(
        path,
        data: body,
        queryParameters: query,
        options: Options(method: method),
      );
      final data = res.data;
      if (data is Map && data['success'] == false) {
        throw ApiException(
          (data['message'] ?? 'Request failed').toString(),
          statusCode: res.statusCode,
        );
      }
      return (data is Map && data.containsKey('data')) ? data['data'] : data;
    } on DioException catch (e) {
      throw ApiException(_friendly(e), statusCode: e.response?.statusCode);
    }
  }

  Map<String, dynamic> _asMap(dynamic data) =>
      data is Map<String, dynamic> ? data : <String, dynamic>{};

  String _friendly(DioException e) {
    final serverMsg = e.response?.data is Map
        ? (e.response?.data as Map)['message']?.toString()
        : null;
    if (serverMsg != null && serverMsg.isNotEmpty) return serverMsg;
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
