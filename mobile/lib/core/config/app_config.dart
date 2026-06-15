/// App-wide configuration. The backend URL is injected at build/run time so the
/// same code targets a local dev server, the emulator, or the production
/// DigitalOcean backend.
///
/// Override at build/run time (takes precedence over the default below):
///   `flutter run            --dart-define=API_URL=https://your-domain/api`
///   `flutter build apk --release --dart-define=API_URL=https://your-domain/api`
///
/// IMPORTANT: a plain `flutter build apk` (no --dart-define) now ships the
/// production URL below — that's what a real phone needs. If your DigitalOcean
/// domain is different, change `_defaultApiUrl` (one line) or pass --dart-define.
class AppConfig {
  AppConfig._();

  /// The production backend a real device hits when no API_URL is provided.
  /// ⬇️  CHANGE THIS if your DigitalOcean URL differs.
  static const String _defaultApiUrl = 'https://pureverse.duckdns.org/api';

  /// Base REST URL, e.g. https://pureverse.duckdns.org/api.
  static const String apiBaseUrl = String.fromEnvironment(
    'API_URL',
    defaultValue: _defaultApiUrl,
  );

  /// The **web** OAuth client ID, used as the Google Sign-In `serverClientId`
  /// so the ID token's audience matches what the backend verifies. The Android
  /// OAuth client (package + SHA-1) must also exist in the same Google Cloud
  /// project for native sign-in to succeed — see mobile/README auth notes.
  static const String googleServerClientId = String.fromEnvironment(
    'GOOGLE_SERVER_CLIENT_ID',
    defaultValue:
        '553856787593-itv0geik72fmkq7par00j8o4rljiqjl6.apps.googleusercontent.com',
  );

  /// socket.io root (REST base with the trailing /api stripped).
  static String get socketBaseUrl =>
      apiBaseUrl.replaceFirst(RegExp(r'/api/?$'), '');

  /// True when pointing at a real HTTPS backend (vs local dev).
  static bool get isProduction => apiBaseUrl.startsWith('https://');
}
