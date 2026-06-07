import 'package:dio/dio.dart';

class ApiClient {
  static const String baseUrl = 'http://localhost:5000/api';
  final Dio _dio;

  ApiClient() : _dio = Dio(BaseOptions(baseUrl: baseUrl)) {
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

  Future<List<dynamic>> searchMedia(String query) async {
    try {
      final response = await _dio.get('/search', queryParameters: {'q': query});
      return response.data['data'] as List<dynamic>;
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
