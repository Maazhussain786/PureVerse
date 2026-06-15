import 'dart:async';

import 'package:flutter_inappwebview/flutter_inappwebview.dart';

/// A direct stream pulled out of a provider embed page, ready for the native
/// player. [headers] carry the Referer/Origin/User-Agent the CDN expects.
class ExtractedStream {
  final String url; // .m3u8 (preferred) or .mp4
  final Map<String, String> headers;
  final List<ExtractedSubtitle> subtitles;
  const ExtractedStream({
    required this.url,
    required this.headers,
    this.subtitles = const [],
  });
}

class ExtractedSubtitle {
  final String label;
  final String language;
  final String url;
  const ExtractedSubtitle(this.label, this.language, this.url);
}

/// On-device stream extraction.
///
/// Loads a provider's embed page in a hidden (headless) WebView on the phone
/// and watches its network traffic for the actual `.m3u8` the player requests.
/// Runs on the device's residential IP — so it isn't data-center-blocked like
/// the old server-side attempts — and never touches our backend.
///
/// Returns the captured stream (or null on timeout / nothing playable, e.g. a
/// DRM/blob provider), so callers can fall back to the iframe player.
class StreamExtractor {
  static const _userAgent =
      'Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 '
      '(KHTML, like Gecko) Chrome/124.0.0.0 Mobile Safari/537.36';

  static Future<ExtractedStream?> extract(
    String embedUrl, {
    Duration timeout = const Duration(seconds: 25),
  }) async {
    final completer = Completer<ExtractedStream?>();
    final subtitles = <ExtractedSubtitle>[];
    final seenSubs = <String>{};
    HeadlessInAppWebView? webView;
    Timer? timer;
    Timer? settle;
    String? bestHls;

    final origin = Uri.tryParse(embedUrl);
    final referer =
        origin != null ? '${origin.scheme}://${origin.host}/' : embedUrl;
    final originHeader =
        origin != null ? '${origin.scheme}://${origin.host}' : '';

    Map<String, String> headers() => {
          'Referer': referer,
          if (originHeader.isNotEmpty) 'Origin': originHeader,
          'User-Agent': _userAgent,
        };

    void finish(ExtractedStream? result) {
      if (completer.isCompleted) return;
      timer?.cancel();
      settle?.cancel();
      completer.complete(result);
    }

    void finishWith(String url) => finish(ExtractedStream(
          url: url,
          headers: headers(),
          subtitles: List.of(subtitles),
        ));

    // A master HLS playlist is what exposes the 1080p/720p/480p/360p variants
    // in the quality menu; a media playlist only yields "Auto". Prefer a
    // master-looking manifest, falling back to the first seen if none appears.
    bool looksMaster(String u) =>
        u.contains('master') || u.contains('playlist') || u.contains('index.m3u8');

    void considerHls(String u) {
      if (completer.isCompleted) return;
      if (bestHls == null || (!looksMaster(bestHls!) && looksMaster(u))) {
        bestHls = u;
      }
      if (looksMaster(bestHls!)) {
        finishWith(bestHls!);
        return;
      }
      // Wait briefly for a master to appear, then commit to the best candidate.
      settle ??= Timer(const Duration(milliseconds: 1000), () {
        if (bestHls != null) finishWith(bestHls!);
      });
    }

    // Inspect every request the embed page makes.
    void inspect(String? raw) {
      final u = raw ?? '';
      if (u.isEmpty) return;
      final low = u.toLowerCase();

      // Collect subtitle tracks the page loads.
      if (low.contains('.vtt') || low.contains('.srt')) {
        if (seenSubs.add(u)) {
          final lang = _guessLang(low);
          subtitles.add(ExtractedSubtitle(lang.label, lang.code, u));
        }
        return;
      }

      // The prize: an HLS manifest (or a direct mp4). Ignore tiny ad/segment
      // noise by requiring the manifest/extension in the path.
      if (low.contains('.m3u8')) {
        considerHls(u);
        return;
      }
      if (low.contains('.mp4') && !low.contains('thumb')) {
        finishWith(u);
      }
    }

    webView = HeadlessInAppWebView(
      initialUrlRequest: URLRequest(url: WebUri(embedUrl)),
      initialSettings: InAppWebViewSettings(
        userAgent: _userAgent,
        javaScriptEnabled: true,
        // Allow autoplay so the player JS actually requests its manifest.
        mediaPlaybackRequiresUserGesture: false,
        // Kill popups/pop-unders the ad layer tries to open.
        javaScriptCanOpenWindowsAutomatically: false,
        supportMultipleWindows: false,
        // Enable the request/resource hooks below (Android).
        useShouldInterceptRequest: true,
        useOnLoadResource: true,
        cacheEnabled: true,
        clearCache: false,
      ),
      // Primary hook: sees every network request (incl. XHR/fetch) with URL.
      shouldInterceptRequest: (controller, request) async {
        inspect(request.url.toString());
        return null; // null => let the WebView load it normally
      },
      // Secondary hook (resource timing) in case the above misses anything.
      onLoadResource: (controller, resource) {
        inspect(resource.url?.toString());
      },
      // Never open new windows (popunder ads).
      onCreateWindow: (controller, action) async => false,
    );

    try {
      await webView.run();
      timer = Timer(timeout, () => finish(null));
      return await completer.future;
    } catch (_) {
      return null;
    } finally {
      timer?.cancel();
      settle?.cancel();
      await webView.dispose();
    }
  }

  static _Lang _guessLang(String url) {
    if (url.contains('eng') || url.contains('/en')) return const _Lang('English', 'en');
    if (url.contains('spa') || url.contains('/es')) return const _Lang('Spanish', 'es');
    if (url.contains('fre') || url.contains('/fr')) return const _Lang('French', 'fr');
    if (url.contains('ger') || url.contains('/de')) return const _Lang('German', 'de');
    if (url.contains('hin') || url.contains('/hi')) return const _Lang('Hindi', 'hi');
    if (url.contains('jpn') || url.contains('/ja')) return const _Lang('Japanese', 'ja');
    if (url.contains('ara') || url.contains('/ar')) return const _Lang('Arabic', 'ar');
    return const _Lang('Subtitle', 'und');
  }
}

class _Lang {
  final String label;
  final String code;
  const _Lang(this.label, this.code);
}
