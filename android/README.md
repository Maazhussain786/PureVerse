# PureVerse — Android app (ad-blocking WebView)

A thin native Android wrapper around the PureVerse website that **blocks ads and
popups at the WebView layer** — something the website itself cannot do, because
browser security forbids a page from reaching into a cross-origin `<iframe>`.

## What it blocks

| Ad type | How it's blocked |
| --- | --- |
| **Popup / popunder tabs** (the "5–6 tabs when I press play") | `setSupportMultipleWindows(false)` + `onCreateWindow → false` + popups disabled in `WebSettings` |
| **Tab-hijack redirects** (player navigates you to an ad site) | `shouldOverrideUrlLoading` blocks top-level navigation to any non-allowlisted host |
| **Ad-network requests** (incl. some inside the iframe) | `shouldInterceptRequest` drops requests to known ad/popunder/tracker hosts — see `AdBlocker.kt` |

It can't strip an ad that's literally encoded into the video stream, but those
embed providers rarely do that — their money is in the popups/redirects above,
which this kills.

## Before you build — set your site URL

Edit **`app/src/main/java/com/pureverse/app/MainActivity.kt`** and change:

```kotlin
private const val BASE_URL = "https://pure-verse.vercel.app"
```

to your real deployed web URL. If you use a custom domain, also add it to
`allowedHosts` in **`AdBlocker.kt`** (otherwise top-level navigation to it is
treated as an ad redirect and blocked).

## Getting the APK (no Android Studio needed)

This repo has a GitHub Actions workflow that compiles the APK for you:

1. Push these files to GitHub (the `android/` folder + `.github/workflows/android.yml`).
2. Go to the repo's **Actions** tab → **Build Android APK** → **Run workflow**.
3. When it finishes (~3–5 min), open the run and download the
   **`PureVerse-debug-apk`** artifact. Inside is `app-debug.apk`.
4. Copy it to your phone and install (enable "Install unknown apps" for your
   file manager/browser when prompted).

> The artifact is a **debug** APK — installable directly, no Play Store. For a
> Play Store release you'd switch to a signed release build.

## Build locally instead (optional)

If you have Android Studio / the SDK:

```bash
cd android
gradle assembleDebug      # or ./gradlew assembleDebug if you add the wrapper
# output: app/build/outputs/apk/debug/app-debug.apk
```

## Maintaining the ad blocklist

Ad networks rotate domains. When a new popup host slips through, add its domain
to `adHosts` in `AdBlocker.kt` and rebuild. No other changes needed.

## Notes / limitations

- **Google Sign-In**: Google often blocks OAuth inside WebViews
  (`disallowed_useragent`) regardless of this app. Guest sign-in works fine.
- Versions are pinned to a known-good set (AGP 8.2.2 · Gradle 8.6 · Kotlin
  1.9.22 · JDK 17 · compileSdk 34 · minSdk 26 = Android 8.0+).
