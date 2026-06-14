# PureVerse — Native App (Flutter)

The real native app (not the WebView shortcut under `android/`). Shares the
PureVerse backend and design system. Android + iOS from one codebase.

## Architecture
- **State**: Riverpod
- **HTTP**: Dio (`core/network/api_client.dart`) — auto-attaches the bearer token
- **Auth token**: stored in the platform secure store (`core/storage/token_store.dart`)
- **Playback**: *hybrid* — `EmbedPlayerScreen` loads the provider embed in a
  hardened `flutter_inappwebview`. (Native custom player = a later phase.)
- **Screens**: `features/<area>/presentation/screens/…`

## Run / build
The backend URL is injected at build time:

```bash
# Dev against a local backend (Android emulator → host localhost:5000)
flutter run

# Against the DigitalOcean backend
flutter run --dart-define=API_URL=https://<your-domain>/api
flutter build apk --release --dart-define=API_URL=https://<your-domain>/api
```

No Android SDK locally? Push to `main` (or run the **Build Flutter App** GitHub
Action). It builds the APK and publishes it to the `flutter-latest` Release.
Set the backend URL once in **Settings → Secrets and variables → Actions →
Variables**: `API_URL = https://<your-domain>/api`.

## Google Sign-In setup (required for the Google button)
Guest sign-in works with no setup. Native Google sign-in needs an **Android
OAuth client** in the *same* Google Cloud project as the web client:

1. Get your signing SHA-1:
   - Debug: `cd android && ./gradlew signingReport` (look for the `debug` SHA-1)
   - Release: from your upload keystore (see below)
2. Google Cloud Console → **Credentials → Create OAuth client ID → Android**
   - Package name: `com.aniverse.mobile`
   - SHA-1: the value from step 1
3. The app already uses the **web** client ID as `serverClientId`
   (`core/config/app_config.dart`) so the ID token's audience matches what the
   backend's `/auth/google` verifies. No code change needed.

> Each build variant has a different SHA-1. Register the debug SHA-1 for debug
> APKs and the release/upload SHA-1 for store builds.

## Release signing
Release builds are debug-signed until you add a keystore:

1. Generate one:
   ```bash
   keytool -genkey -v -keystore upload.jks -keyalg RSA -keysize 2048 \
     -validity 10000 -alias upload
   ```
2. Create `android/key.properties` (gitignored):
   ```
   storePassword=…
   keyPassword=…
   keyAlias=upload
   storeFile=/absolute/path/to/upload.jks
   ```
3. `flutter build apk --release` (or `appbundle`) now signs with it.

## Status
Done: shell, Home/Details/Search, hybrid player, auth (guest + Google),
synced watchlist/favorites. Not done: native custom player, watch party
(needs the custom player for playback sync).
