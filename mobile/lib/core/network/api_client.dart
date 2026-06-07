import 'package:dio/dio.dart';

class ApiClient {
  // For Android emulator use 10.0.2.2, for real device use your machine's IP
  static const String baseUrl = 'http://10.0.2.2:5000/api';
  final Dio _dio;

  ApiClient() : _dio = Dio(BaseOptions(baseUrl: baseUrl, connectTimeout: const Duration(seconds: 10), receiveTimeout: const Duration(seconds: 10))) {
    _dio.interceptors.add(LogInterceptor(responseBody: true));
  }

  Future<List<dynamic>> getTrending() async {
    try {
      final response = await _dio.get('/trending');
      return response.data['data'] as List<dynamic>;
    } catch (e) {
      rethrow;
    }
  }

  Future<List<dynamic>> getTrendingMovies() async {
    try {
      final response = await _dio.get('/trending/movies');
      return response.data['data'] as List<dynamic>;
    } catch (e) {
      rethrow;
    }
  }

  Future<List<dynamic>> getTrendingSeries() async {
    try {
      final response = await _dio.get('/trending/series');
      return response.data['data'] as List<dynamic>;
    } catch (e) {
      rethrow;
    }
  }

  Future<List<dynamic>> getTrendingAnime() async {
    try {
      final response = await _dio.get('/trending/anime');
      return response.data['data'] as List<dynamic>;
    } catch (e) {
      rethrow;
    }
  }

  Future<List<dynamic>> searchMedia(String query) async {
    try {
      final response = await _dio.get('/search', queryParameters: {'q': query});
      return response.data['data'] as List<dynamic>;
    } catch (e) {
      rethrow;
    }
  }

  Future<Map<String, dynamic>> getMediaDetails(String type, String id) async {
    try {
      final response = await _dio.get('/media/details/$type/$id');
      return response.data['data'] as Map<String, dynamic>;
    } catch (e) {
      rethrow;
    }
  }

  Future<Map<String, dynamic>> getMediaStream(String type, String id, {String? season, String? episode}) async {
    try {
      final query = <String, dynamic>{};
      if (season != null) query['season'] = season;
      if (episode != null) query['episode'] = episode;

      final response = await _dio.get('/media/stream/$type/$id', queryParameters: query);
      return response.data['data'] as Map<String, dynamic>;
    } catch (e) {
      rethrow;
    }
  }
}
