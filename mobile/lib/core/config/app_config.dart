/// App-wide configuration. The backend URL is injected at build/run time so the
/// same code targets the local dev server, the emulator, or the production
/// DigitalOcean backend without edits.
///
/// Dev (Android emulator → host machine):
///   flutter run
/// Production (DigitalOcean):
///   `flutter run --dart-define=API_URL=https://your-domain/api`
///   `flutter build apk --release --dart-define=API_URL=https://your-domain/api`
class AppConfig {
  AppConfig._();

  /// Base REST URL, e.g. https://pureverse.duckdns.org/api
  /// Defaults to the Android-emulator alias for the host's localhost:5000.
  static const String apiBaseUrl = String.fromEnvironment(
    'API_URL',
    defaultValue: 'http://10.0.2.2:5000/api',
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
