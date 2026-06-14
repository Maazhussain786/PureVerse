import 'package:flutter_secure_storage/flutter_secure_storage.dart';

/// Persists the session bearer token in the platform secure store
/// (Keystore on Android), so it survives app restarts.
class TokenStore {
  static const _key = 'pureverse_token';
  final FlutterSecureStorage _storage;

  TokenStore([FlutterSecureStorage? storage])
      : _storage = storage ?? const FlutterSecureStorage();

  Future<String?> read() => _storage.read(key: _key);
  Future<void> write(String token) => _storage.write(key: _key, value: token);
  Future<void> clear() => _storage.delete(key: _key);
}
